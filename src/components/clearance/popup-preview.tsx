'use client';

import React from 'react';
import type { PopupConfigInput } from '@/lib/popup';

type PreviewConfig = PopupConfigInput & { imageUrl?: string | null };

interface PopupPreviewProps {
  config: PreviewConfig;
  device: 'desktop' | 'mobile';
}

type Skin = {
  card: string;
  text: string;
  muted: string;
  border: string;
  backdrop: string;
  xBg: string;
  xFg: string;
  xBorder: string;
};

const SURFACE_STYLES: Record<string, Skin> = {
  light: {
    card: 'bg-white',
    text: 'text-[#111827]',
    muted: 'text-[#6b7280]',
    border: 'border-black/10',
    backdrop: 'bg-[#111827]/45',
    xBg: 'bg-white/90',
    xFg: 'text-[#111827]',
    xBorder: 'border-black/15',
  },
  dark: {
    card: 'bg-[#111827]',
    text: 'text-[#f9fafb]',
    muted: 'text-[#9ca3af]',
    border: 'border-white/12',
    backdrop: 'bg-black/60',
    xBg: 'bg-white/15',
    xFg: 'text-[#f9fafb]',
    xBorder: 'border-white/25',
  },
  glass: {
    card: 'bg-white/75 backdrop-blur-md',
    text: 'text-[#111827]',
    muted: 'text-[#4b5563]',
    border: 'border-white/55',
    backdrop: 'bg-[#111827]/45',
    xBg: 'bg-white/70',
    xFg: 'text-[#111827]',
    xBorder: 'border-white/60',
  },
};

function CloseChip({ skin, className = '' }: { skin: Skin; className?: string }) {
  return (
    <span
      aria-hidden
      className={`absolute z-10 flex size-8 items-center justify-center rounded-full border backdrop-blur-[4px] ${skin.xBg} ${skin.xFg} ${skin.xBorder} ${className}`}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" focusable="false">
        <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </svg>
    </span>
  );
}

/**
 * Designer-side replica of the storefront popup rendered by
 * src/lib/popup-script.ts. Keep the two in sync when changing the look.
 */
export default function PopupPreview({ config, device }: PopupPreviewProps) {
  const skin = SURFACE_STYLES[config.surface] ?? SURFACE_STYLES.light;
  const isBanner = config.template === 'banner';
  const isCorner = config.template === 'corner';

  const cta = config.ctaLabel ? (
    <span
      className="mt-[18px] inline-flex h-[42px] items-center justify-center rounded-[10px] px-5 text-sm font-semibold text-white"
      style={{ backgroundColor: config.accentColor }}
    >
      {config.ctaLabel}
    </span>
  ) : null;

  const body = (
    <div className={isBanner ? 'min-w-0 flex-1' : 'pt-[22px] pr-[52px] pb-6 pl-[22px]'}>
      {config.title && <h3 className="m-0 text-[18px] leading-snug font-bold">{config.title}</h3>}
      {config.body && <p className={`mt-2 text-sm leading-[1.6] ${skin.muted}`}>{config.body}</p>}
      {cta}
    </div>
  );

  const image = config.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={config.imageUrl}
      alt=""
      className={
        isBanner ? 'h-16 w-[84px] flex-none rounded-[10px] object-cover' : 'block max-h-[200px] w-full object-cover'
      }
    />
  ) : null;

  const card = (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border shadow-[0_24px_60px_rgba(0,0,0,0.28)] ${skin.card} ${skin.text} ${skin.border}`}
    >
      {isBanner ? (
        <>
          <div className="flex items-center gap-4 py-4 pr-[60px] pl-[18px]">
            {image}
            {body}
          </div>
          <CloseChip skin={skin} className="top-1/2 right-3 -translate-y-1/2" />
        </>
      ) : (
        <>
          {image}
          {body}
          <CloseChip skin={skin} className="top-3 right-3" />
        </>
      )}
    </div>
  );

  return (
    <div
      className={`relative h-[380px] overflow-hidden rounded-xl border bg-[#f4f4f5] ${
        device === 'mobile' ? 'mx-auto w-[320px]' : 'w-full'
      }`}
    >
      {/* Fake storefront page */}
      <div className="absolute inset-0 space-y-2 p-4 opacity-40">
        <div className="h-6 w-1/2 rounded bg-black/10" />
        <div className="h-24 rounded bg-black/10" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-20 rounded bg-black/10" />
          <div className="h-20 rounded bg-black/10" />
        </div>
      </div>

      {/* Popup layer */}
      {isCorner ? (
        <div className="absolute right-5 bottom-5 left-5 sm:left-auto sm:max-w-[340px]">{card}</div>
      ) : isBanner ? (
        <div className={`absolute inset-x-0 bottom-0 flex justify-center p-3 ${skin.backdrop}`}>
          <div className="w-full max-w-[920px]">{card}</div>
        </div>
      ) : (
        <div className={`absolute inset-0 flex items-center justify-center p-4 ${skin.backdrop}`}>{card}</div>
      )}
    </div>
  );
}
