import { getIkas } from '@/helpers/api-helpers';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateRequest } from '@/lib/validation';
import { prisma } from '@/lib/prisma';
import {
  parseScriptIds,
  toPopupSummary,
  type PopupSummary,
} from '@/lib/popup';

export type GetPopupResponse = {
  popup: PopupSummary | null;
};

export type SavePopupResponse = {
  popup: PopupSummary;
};

const popupConfigSchema = z.object({
  template: z.enum(['modal', 'banner', 'corner']),
  title: z.string().max(120, 'Başlık en fazla 120 karakter olabilir'),
  body: z.string().max(1000, 'Metin en fazla 1000 karakter olabilir'),
  ctaLabel: z.string().max(60).nullable(),
  ctaUrl: z.string().max(500).nullable(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$/, 'Renk #RRGGBB biçiminde olmalı'),
  surface: z.enum(['light', 'dark', 'glass']),
  startAt: z.string().nullable(),
  endAt: z.string().nullable(),
  targetDevices: z.enum(['all', 'mobile', 'desktop']),
  targetPaths: z.array(z.string().max(200)).max(20),
  frequency: z.enum(['always', 'once_per_day', 'once_per_session', 'once_ever']),
});

function parseDateOrNull(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function summaryUrl(merchantId: string, updatedAt: Date): string {
  return `/api/public/popup/${merchantId}/image?t=${updatedAt.getTime()}`;
}

/**
 * GET /api/ikas/popup
 * Loads this merchant's announcement popup (null before the first save).
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const row = await prisma.announcementPopup.findUnique({ where: { merchantId: user.merchantId } });
    const popup: PopupSummary | null = row
      ? toPopupSummary(row, row.image ? summaryUrl(user.merchantId, row.updatedAt) : null)
      : null;

    return NextResponse.json({ data: { popup } });
  } catch (error) {
    console.error('Error loading popup:', error);
    return NextResponse.json({ error: { statusCode: 500, message: 'Duyuru yüklenemedi' } }, { status: 500 });
  }
}

/**
 * PUT /api/ikas/popup
 * Saves the popup design (upsert). Image and publish state are separate.
 */
export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = validateRequest(popupConfigSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const input = validation.data;
    const startAt = parseDateOrNull(input.startAt);
    const endAt = parseDateOrNull(input.endAt);
    if (input.startAt && !startAt) {
      return NextResponse.json({ error: 'Geçersiz başlangıç tarihi' }, { status: 400 });
    }
    if (input.endAt && !endAt) {
      return NextResponse.json({ error: 'Geçersiz bitiş tarihi' }, { status: 400 });
    }
    if (startAt && endAt && startAt >= endAt) {
      return NextResponse.json({ error: 'Bitiş tarihi başlangıçtan sonra olmalı' }, { status: 400 });
    }

    const data = {
      template: input.template,
      title: input.title,
      body: input.body,
      ctaLabel: input.ctaLabel || null,
      ctaUrl: input.ctaUrl || null,
      accentColor: input.accentColor,
      surface: input.surface,
      startAt,
      endAt,
      targetDevices: input.targetDevices,
      targetPaths: JSON.stringify(input.targetPaths),
      frequency: input.frequency,
    };

    const row = await prisma.announcementPopup.upsert({
      where: { merchantId: user.merchantId },
      create: { merchantId: user.merchantId, ...data },
      update: data,
    });

    return NextResponse.json({
      data: { popup: toPopupSummary(row, row.image ? summaryUrl(user.merchantId, row.updatedAt) : null) },
    });
  } catch (error) {
    console.error('Error saving popup:', error);
    return NextResponse.json({ error: { statusCode: 500, message: 'Duyuru kaydedilemedi' } }, { status: 500 });
  }
}

/**
 * DELETE /api/ikas/popup
 * Removes the popup from the storefront entirely: deletes the app's injected
 * JS scripts (v2 deletes them on every storefront) and resets the row to draft.
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) {
      return NextResponse.json({ error: { statusCode: 404, message: 'Auth token not found' } }, { status: 404 });
    }

    const row = await prisma.announcementPopup.findUnique({ where: { merchantId: user.merchantId } });
    if (!row) {
      return NextResponse.json({ data: { success: true } });
    }

    if (Object.keys(parseScriptIds(row.scriptIds)).length > 0) {
      const ikasClient = getIkas(authToken);
      const result = await ikasClient.mutations.deleteStorefrontJSScript();
      if (!result.isSuccess) {
        console.error('deleteStorefrontJSScript failed:', result.error);
        return NextResponse.json(
          { error: { statusCode: 502, message: 'Vitrin scripti kaldırılamadı. Uygulamayı yeniden yetkilendirmeyi deneyin.' } },
          { status: 502 },
        );
      }
    }

    await prisma.announcementPopup.update({
      where: { id: row.id },
      data: { status: 'draft', scriptIds: '{}' },
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Error deleting popup:', error);
    return NextResponse.json({ error: { statusCode: 500, message: 'Duyuru kaldırılamadı' } }, { status: 500 });
  }
}
