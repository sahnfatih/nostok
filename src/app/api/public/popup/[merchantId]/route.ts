import { NextRequest, NextResponse } from 'next/server';
import { getPublicBaseUrl } from '@/helpers/api-helpers';
import { prisma } from '@/lib/prisma';
import { toPublicPopupConfig } from '@/lib/popup';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=60',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/public/popup/[merchantId]
 * Public storefront config for the announcement popup. Returns only a popup
 * that is published and inside its schedule window (`active: true`); anything
 * else yields `active: false` and the storefront script renders nothing.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ merchantId: string }> }) {
  try {
    const { merchantId } = await params;
    const row = await prisma.announcementPopup.findUnique({ where: { merchantId } });
    if (!row) {
      return NextResponse.json({ active: false }, { headers: CORS_HEADERS });
    }

    // Absolute URL: the storefront script runs on the store's origin and would
    // otherwise resolve a relative path against the wrong host.
    const imageUrl = row.image ? `${getPublicBaseUrl(request.headers.get('host') ?? '')}/api/public/popup/${merchantId}/image` : null;
    return NextResponse.json(toPublicPopupConfig(row, imageUrl), { headers: CORS_HEADERS });
  } catch (error) {
    console.error('Error serving popup config:', error);
    return NextResponse.json({ active: false }, { headers: CORS_HEADERS });
  }
}
