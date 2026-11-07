import { getIkas, getPublicBaseUrl } from '@/helpers/api-helpers';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ensurePopupScripts } from '@/lib/popup-install';
import { toPopupSummary, type PopupSummary } from '@/lib/popup';

export type PublishPopupResponse = {
  popup: PopupSummary;
  storefrontCount: number;
};

/**
 * POST /api/ikas/popup/publish
 * Makes the popup live: injects (or refreshes) the bootstrap script on every
 * storefront of the merchant and marks the popup published. The script itself
 * fetches its config from /api/public/popup/[merchantId] on each page view, so
 * later design edits need no re-injection.
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

    const row = await prisma.announcementPopup.findUnique({ where: { merchantId: user.merchantId } });
    if (!row) {
      return NextResponse.json(
        { error: { statusCode: 400, message: 'Önce duyuru tasarımını kaydedin' } },
        { status: 400 },
      );
    }

    const ikasClient = getIkas(authToken);

    const base = getPublicBaseUrl(request.headers.get('host') ?? '');
    // A localhost script URL is useless to storefront visitors — publish must
    // happen through the panel (tunnel/deploy host), never a local dev tab.
    if (base.includes('localhost') || base.includes('127.0.0.1')) {
      return NextResponse.json(
        {
          error: {
            statusCode: 400,
            message:
              'Duyuruyu vitrine yayınlamak için uygulamayı ikas paneli üzerinden açın; yerel adresten yapılan yayınlarda ziyaretçiler görmez.',
          },
        },
        { status: 400 },
      );
    }

    let scriptIds: Record<string, string>;
    let storefrontCount: number;
    try {
      const result = await ensurePopupScripts(ikasClient, user.merchantId, row.scriptIds, base);
      scriptIds = result.scriptIds;
      storefrontCount = result.storefrontCount;
    } catch (error) {
      console.error('Popup script injection failed:', error);
      return NextResponse.json(
        { error: { statusCode: 502, message: 'Vitrin scripti eklenemedi. Uygulamayı yeniden yetkilendirmeyi deneyin.' } },
        { status: 502 },
      );
    }

    const updated = await prisma.announcementPopup.update({
      where: { id: row.id },
      data: { status: 'published', scriptIds: JSON.stringify(scriptIds) },
    });

    return NextResponse.json({
      data: {
        popup: toPopupSummary(updated, updated.image ? `/api/public/popup/${user.merchantId}/image?t=${updated.updatedAt.getTime()}` : null),
        storefrontCount,
      },
    });
  } catch (error) {
    console.error('Error publishing popup:', error);
    return NextResponse.json({ error: { statusCode: 500, message: 'Duyuru yayınlanamadı' } }, { status: 500 });
  }
}

/**
 * DELETE /api/ikas/popup/publish
 * Pauses the popup without touching the injected scripts — publishing again is
 * instant. ("Duyuru tamamen kaldır" uses DELETE /api/ikas/popup.)
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const row = await prisma.announcementPopup.findUnique({ where: { merchantId: user.merchantId } });
    if (!row) {
      return NextResponse.json({ error: { statusCode: 404, message: 'Duyuru bulunamadı' } }, { status: 404 });
    }

    const updated = await prisma.announcementPopup.update({
      where: { id: row.id },
      data: { status: 'paused' },
    });

    return NextResponse.json({
      data: {
        popup: toPopupSummary(updated, updated.image ? `/api/public/popup/${user.merchantId}/image?t=${updated.updatedAt.getTime()}` : null),
      },
    });
  } catch (error) {
    console.error('Error pausing popup:', error);
    return NextResponse.json({ error: { statusCode: 500, message: 'Duyuru durdurulamadı' } }, { status: 500 });
  }
}
