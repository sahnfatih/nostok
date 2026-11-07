import { getIkas } from '@/helpers/api-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { validateIkasWebhookSignature, WebhookScope, type IkasWebhook } from '@ikas/admin-api-client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { removePopupScripts, withTimeout } from '@/lib/popup-install';

const webhookSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  scope: z.string(),
  merchantId: z.string(),
  authorizedAppId: z.string(),
  data: z.string(),
  signature: z.string(),
});

/**
 * POST /api/webhooks/ikas
 * Lifecycle webhook receiver (Partner panel › Bildirim Adresi). Handles:
 * - `store/app/deleted`: removes the storefront scripts this app injected,
 *   invalidates the stored token and resets the popup row. ikas does NOT revoke
 *   the access token on uninstall, so the local invalidation is the real
 *   control that stops post-removal data access.
 * - `store/app/payment`: acknowledged; the app is free and grants nothing.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { statusCode: 400, message: 'invalid payload' } }, { status: 400 });
  }

  const validation = webhookSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: { statusCode: 400, message: 'invalid payload' } }, { status: 400 });
  }
  const webhook = validation.data as IkasWebhook;

  // Fail closed when the secret is not configured.
  const clientSecret = process.env.CLIENT_SECRET;
  if (!clientSecret) {
    console.error('CLIENT_SECRET is not configured — refusing webhook');
    return NextResponse.json({ error: { statusCode: 500, message: 'server misconfigured' } }, { status: 500 });
  }

  // Signature is verified before any work.
  if (!validateIkasWebhookSignature(webhook, clientSecret)) {
    return NextResponse.json({ error: { statusCode: 401, message: 'invalid signature' } }, { status: 401 });
  }

  if (webhook.scope === WebhookScope.APP_DELETED) {
    return handleAppDeleted(webhook);
  }

  // The Bildirim Adresi only receives the lifecycle scopes; nothing to grant
  // from store/app/payment on a free plan.
  return NextResponse.json({ data: { ok: true, ignored: true } });
}

async function handleAppDeleted(webhook: IkasWebhook) {
  const tokenRow = await prisma.authToken.findUnique({ where: { authorizedAppId: webhook.authorizedAppId } });
  if (!tokenRow || tokenRow.deleted) {
    // Second delivery (ikas retries) — nothing to do.
    return NextResponse.json({ data: { ok: true, skipped: true } });
  }

  // Cleanup runs with the EXISTING access token only (a refresh against a dead
  // refresh token can hang) and is time-boxed; local invalidation below always
  // completes even if the Admin API cleanup fails.
  try {
    const token = await AuthTokenManager.get(webhook.authorizedAppId);
    if (token) {
      await withTimeout(removePopupScripts(getIkas(token)), 10_000);
    }
  } catch (error) {
    console.error('Storefront script cleanup failed (continuing):', error);
  }

  await AuthTokenManager.delete(webhook.authorizedAppId);
  await prisma.announcementPopup.updateMany({
    where: { merchantId: webhook.merchantId },
    data: { status: 'draft', scriptIds: '{}' },
  });

  return NextResponse.json({ data: { ok: true } });
}
