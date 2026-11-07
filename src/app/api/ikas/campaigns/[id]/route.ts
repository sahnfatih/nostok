import { getIkas } from '@/helpers/api-helpers';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateRequest } from '@/lib/validation';
import { prisma } from '@/lib/prisma';
import { removeClearanceCampaign, updateClearanceCampaign } from '@/lib/clearance/campaigns';

export type UpdateCampaignResponse = {
  success: boolean;
  discountPercent: number;
  title: string;
};

const updateCampaignSchema = z.object({
  discountPercent: z.number().min(1).max(90, 'İndirim %1-%90 arası olmalı').optional(),
  title: z.string().min(1, 'Kampanya başlığı gerekli').optional(),
});

/**
 * DELETE /api/ikas/campaigns/[id]
 * Removes a clearance campaign: restores the variants' pre-campaign prices and
 * marks the tracking row deleted.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const ikasClient = getIkas(authToken);
    await removeClearanceCampaign(ikasClient, row);

    await prisma.clearanceCampaign.update({
      where: { id: row.id },
      data: { status: 'deleted' },
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    return NextResponse.json({ error: { statusCode: 500, message: 'Failed to delete campaign' } }, { status: 500 });
  }
}

/**
 * PATCH /api/ikas/campaigns/[id]
 * Updates a running campaign's discount rate and/or title. Variant prices are
 * rewritten from their untouched sell prices.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authToken = await AuthTokenManager.get(user.authorizedAppId);
    if (!authToken) {
      return NextResponse.json({ error: { statusCode: 404, message: 'Auth token not found' } }, { status: 404 });
    }

    const body = await request.json();
    const validation = validateRequest(updateCampaignSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    if (validation.data.discountPercent === undefined && validation.data.title === undefined) {
      return NextResponse.json(
        { error: { statusCode: 400, message: 'Güncellenecek bir alan gerekli' } },
        { status: 400 },
      );
    }

    const { id } = await params;
    const row = await prisma.clearanceCampaign.findFirst({
      where: { id, merchantId: user.merchantId, status: 'active' },
    });
    if (!row) {
      return NextResponse.json({ error: { statusCode: 404, message: 'Campaign not found' } }, { status: 404 });
    }

    const ikasClient = getIkas(authToken);
    await updateClearanceCampaign(ikasClient, row, validation.data);

    return NextResponse.json({
      data: {
        success: true,
        discountPercent: validation.data.discountPercent ?? row.discountPercent,
        title: validation.data.title ?? row.title,
      },
    });
  } catch (error) {
    console.error('Error updating campaign:', error);
    return NextResponse.json({ error: { statusCode: 500, message: 'Failed to update campaign' } }, { status: 500 });
  }
}
