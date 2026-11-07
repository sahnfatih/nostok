import { getUserFromRequest } from '@/lib/auth-helpers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateRequest } from '@/lib/validation';
import { prisma } from '@/lib/prisma';
import { POPUP_IMAGE_MAX_BYTES, POPUP_IMAGE_MIMES, toPopupSummary } from '@/lib/popup';

const uploadSchema = z.object({
  /** data URL: "data:image/png;base64,...." */
  dataUrl: z.string().min(1),
});

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array<ArrayBuffer> } | null {
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1];
  if (!(POPUP_IMAGE_MIMES as readonly string[]).includes(mime)) return null;
  const bytes = base64ToBytes(match[2]);
  if (bytes.length === 0 || bytes.length > POPUP_IMAGE_MAX_BYTES) return null;
  return { mime, bytes };
}

/**
 * POST /api/ikas/popup/image
 * Uploads (or replaces) the popup image from a data URL produced in the
 * designer. Size and type are validated server-side too.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = validateRequest(uploadSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const parsed = parseDataUrl(validation.data.dataUrl);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Görsel PNG, JPEG, WEBP veya GIF olmalı ve 2,5 MB\'ı aşmamalı' },
        { status: 400 },
      );
    }

    const row = await prisma.announcementPopup.upsert({
      where: { merchantId: user.merchantId },
      create: {
        merchantId: user.merchantId,
        image: parsed.bytes,
        imageMime: parsed.mime,
      },
      update: {
        image: parsed.bytes,
        imageMime: parsed.mime,
      },
    });

    return NextResponse.json({
      data: {
        popup: toPopupSummary(row, `/api/public/popup/${user.merchantId}/image?t=${row.updatedAt.getTime()}`),
      },
    });
  } catch (error) {
    console.error('Error uploading popup image:', error);
    return NextResponse.json({ error: { statusCode: 500, message: 'Görsel yüklenemedi' } }, { status: 500 });
  }
}

/**
 * DELETE /api/ikas/popup/image
 * Removes the popup image.
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const row = await prisma.announcementPopup.update({
      where: { merchantId: user.merchantId },
      data: { image: null, imageMime: null },
    });

    return NextResponse.json({ data: { popup: toPopupSummary(row, null) } });
  } catch (error) {
    console.error('Error deleting popup image:', error);
    return NextResponse.json({ error: { statusCode: 500, message: 'Görsel silinemedi' } }, { status: 500 });
  }
}
