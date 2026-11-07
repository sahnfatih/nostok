import { getIkas } from '@/helpers/api-helpers';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { restoreClearanceCampaign } from '@/lib/clearance/campaigns';

/**
 * POST /api/ikas/campaigns/[id]/restore
 * Undoes an accidental campaign end: re-applies the stored clearance discount
 * and marks the row active again.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) {
      return NextResponse.json({ error: { statusCode: 404, message: 'Auth token not found' } }, { status: 404 });
    }

    const { id } = await params;
    const row = await prisma.clearanceCampaign.findFirst({
      where: { id, merchantId: user.merchantId },
    });
    if (!row) {
      return NextResponse.json({ error: { statusCode: 404, message: 'Campaign not found' } }, { status: 404 });
    }
    if (row.status === 'active') {
      return NextResponse.json({
        error: { statusCode: 400, message: 'Campaign is already active' },
      }, { status: 400 });
    }

    const ikasClient = getIkas(authToken);
    await restoreClearanceCampaign(ikasClient, row);

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Error restoring campaign:', error);
    return NextResponse.json({ error: { statusCode: 500, message: 'Failed to restore campaign' } }, { status: 500 });
  }
}
