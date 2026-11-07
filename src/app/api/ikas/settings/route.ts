import { getUserFromRequest } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateRequest } from '@/lib/validation';
import { prisma } from '@/lib/prisma';

export type MerchantSettings = {
  stockThreshold: number;
  thresholdTouched: boolean;
  deadStockDays: number;
};

export type GetSettingsResponse = {
  settings: MerchantSettings;
};

const DEFAULTS: MerchantSettings = {
  stockThreshold: 5,
  thresholdTouched: false,
  deadStockDays: 30,
};

const saveSettingsSchema = z.object({
  stockThreshold: z.number().min(0).max(1000).optional(),
  thresholdTouched: z.boolean().optional(),
  deadStockDays: z.number().min(7).max(365).optional(),
});

function toSettings(row: {
  stockThreshold: number;
  thresholdTouched: boolean;
  deadStockDays: number;
}): MerchantSettings {
  return {
    stockThreshold: row.stockThreshold,
    thresholdTouched: row.thresholdTouched,
    deadStockDays: row.deadStockDays,
  };
}

/**
 * GET /api/ikas/settings
 * Loads the merchant's persistent app settings (thresholds etc.).
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const row = await prisma.merchantSetting.findUnique({ where: { merchantId: user.merchantId } });
    return NextResponse.json({ data: { settings: row ? toSettings(row) : DEFAULTS } });
  } catch (error) {
    console.error('Error loading settings:', error);
    return NextResponse.json({ error: { statusCode: 500, message: 'Ayarlar yüklenemedi' } }, { status: 500 });
  }
}

/**
 * PUT /api/ikas/settings
 * Saves (upserts) the merchant's persistent app settings.
 */
export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = validateRequest(saveSettingsSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const row = await prisma.merchantSetting.upsert({
      where: { merchantId: user.merchantId },
      create: { merchantId: user.merchantId, ...validation.data },
      update: validation.data,
    });

    return NextResponse.json({ data: { settings: toSettings(row) } });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: { statusCode: 500, message: 'Ayarlar kaydedilemedi' } }, { status: 500 });
  }
}
