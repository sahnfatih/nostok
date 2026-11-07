import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=300',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/public/popup/[merchantId]/image
 * The popup's uploaded image, served to storefront visitors.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ merchantId: string }> }) {
  try {
    const { merchantId } = await params;
    const row = await prisma.announcementPopup.findUnique({ where: { merchantId } });
    if (!row?.image) {
      return new NextResponse(null, { status: 404, headers: CORS_HEADERS });
    }
    return new NextResponse(new Uint8Array(row.image), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': row.imageMime || 'image/png',
      },
    });
  } catch (error) {
    console.error('Error serving popup image:', error);
    return new NextResponse(null, { status: 500, headers: CORS_HEADERS });
  }
}
