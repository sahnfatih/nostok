import { getUserFromRequest } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateRequest } from '@/lib/validation';

export type ClearanceRuleType = {
  id: string;
  name: string;
  stockThreshold: number;
  discountPercent: number;
  isActive: boolean;
  autoApply: boolean;
  categoryFilter?: string;
  createdAt: string;
  updatedAt: string;
};

export type ListRulesResponse = {
  rules: ClearanceRuleType[];
};

const createRuleSchema = z.object({
  name: z.string().min(1, 'Kural adı gerekli'),
  stockThreshold: z.number().min(0).max(1000),
  discountPercent: z.number().min(1).max(90),
  autoApply: z.boolean().optional().default(false),
  categoryFilter: z.string().optional(),
});

/**
 * GET /api/ikas/rules
 * Lists all clearance rules for the authenticated merchant.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rules = await prisma.clearanceRule.findMany({
      where: { merchantId: user.merchantId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: { rules } });
  } catch (error) {
    console.error('Error listing rules:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: { statusCode: 500, message: 'Failed to list rules' } },
      { status: 500 },
    );
  }
}

/**
 * POST /api/ikas/rules
 * Creates a new clearance rule.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = validateRequest(createRuleSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const rule = await prisma.clearanceRule.create({
      data: {
        merchantId: user.merchantId,
        name: validation.data.name,
        stockThreshold: validation.data.stockThreshold,
        discountPercent: validation.data.discountPercent,
        autoApply: validation.data.autoApply,
        categoryFilter: validation.data.categoryFilter || null,
      },
    });

    return NextResponse.json({ data: { rule } });
  } catch (error) {
    console.error('Error creating rule:', error);
    return NextResponse.json({ error: { statusCode: 500, message: 'Failed to create rule' } }, { status: 500 });
  }
}
