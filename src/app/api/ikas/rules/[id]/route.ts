import { getUserFromRequest } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateRequest } from '@/lib/validation';

const updateRuleSchema = z.object({
  name: z.string().min(1).optional(),
  stockThreshold: z.number().min(0).max(1000).optional(),
  discountPercent: z.number().min(1).max(90).optional(),
  isActive: z.boolean().optional(),
  autoApply: z.boolean().optional(),
  categoryFilter: z.string().nullable().optional(),
});

/**
 * PATCH /api/ikas/rules/[id]
 * Updates a clearance rule.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validation = validateRequest(updateRuleSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const rule = await prisma.clearanceRule.updateMany({
      where: { id, merchantId: user.merchantId },
      data: validation.data,
    });

    if (rule.count === 0) {
      return NextResponse.json({ error: { statusCode: 404, message: 'Rule not found' } }, { status: 404 });
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Error updating rule:', error);
    return NextResponse.json({ error: { statusCode: 500, message: 'Failed to update rule' } }, { status: 500 });
  }
}

/**
 * DELETE /api/ikas/rules/[id]
 * Deletes a clearance rule.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await prisma.clearanceRule.deleteMany({
      where: { id, merchantId: user.merchantId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: { statusCode: 404, message: 'Rule not found' } }, { status: 404 });
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    console.error('Error deleting rule:', error);
    return NextResponse.json({ error: { statusCode: 500, message: 'Failed to delete rule' } }, { status: 500 });
  }
}
