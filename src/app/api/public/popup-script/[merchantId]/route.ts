import { NextRequest, NextResponse } from 'next/server';
import { getPublicBaseUrl } from '@/helpers/api-helpers';
import { buildPopupScript } from '@/lib/popup-script';

/**
 * GET /api/public/popup-script/[merchantId]
 * The storefront bootstrap script referenced by the injected
 * `<script defer src=...>` tag. Served as JS so the renderer can be updated
 * without touching the ikas storefront script again.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  const base = getPublicBaseUrl(request.headers.get('host') ?? '');
  const script = buildPopupScript(`${base}/api/public/popup/${merchantId}`, merchantId);
  return new NextResponse(script, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
