import { getIkas, getPublicBaseUrl } from '@/helpers/api-helpers';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensurePopupScripts } from '@/lib/popup-install';
import { emptyPopupConfig, parseScriptIds } from '@/lib/popup';

export type InstallPopupScriptResponse = {
  installed: boolean;
  reason?: 'localhost' | 'already';
};

/**
 * POST /api/ikas/popup/install
 * Injects the (inert) popup bootstrap script on every storefront — called
 * automatically on first dashboard load so the storefront lifecycle matches
 * the ikas review expectation (R5): the script exists from install onward and
 * is removed on uninstall. Until a popup is published the script renders
 * nothing, because the public config reports `active: false`.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) {
      return NextResponse.json({ error: { statusCode: 404, message: 'Auth token not found' } }, { status: 404 });
    }

    const base = getPublicBaseUrl(request.headers.get('host') ?? '');
    // A localhost script URL is useless to visitors — skip silently in local
    // dev tabs; the panel (tunnel host) triggers the real install.
    if (base.includes('localhost') || base.includes('127.0.0.1')) {
      return NextResponse.json({ data: { installed: false, reason: 'localhost' } });
    }

    const defaults = emptyPopupConfig();
    const row = await prisma.announcementPopup.upsert({
      where: { merchantId: user.merchantId },
      create: {
        merchantId: user.merchantId,
        template: defaults.template,
        title: defaults.title,
        body: defaults.body,
        ctaLabel: defaults.ctaLabel,
        ctaUrl: defaults.ctaUrl,
        accentColor: defaults.accentColor,
        surface: defaults.surface,
        targetDevices: defaults.targetDevices,
        targetPaths: JSON.stringify(defaults.targetPaths),
        frequency: defaults.frequency,
      },
      update: {},
    });

    if (Object.keys(parseScriptIds(row.scriptIds)).length > 0) {
      return NextResponse.json({ data: { installed: true, reason: 'already' } });
    }

    const ikasClient = getIkas(authToken);
    try {
      const { scriptIds } = await ensurePopupScripts(ikasClient, user.merchantId, row.scriptIds, base);
      await prisma.announcementPopup.update({
        where: { id: row.id },
        data: { scriptIds: JSON.stringify(scriptIds) },
      });
    } catch (error) {
      console.error('Popup script auto-install failed:', error);
      return NextResponse.json(
        { error: { statusCode: 502, message: 'Vitrin scripti eklenemedi' } },
        { status: 502 },
      );
    }

    return NextResponse.json({ data: { installed: true } });
  } catch (error) {
    console.error('Error installing popup script:', error);
    return NextResponse.json({ error: { statusCode: 500, message: 'Vitrin scripti kurulamadı' } }, { status: 500 });
  }
}
