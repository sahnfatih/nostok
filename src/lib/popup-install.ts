import { getIkas } from '@/helpers/api-helpers';
import { StorefrontJSScriptContentTypeEnum } from '@/lib/ikas-client/generated/graphql';
import { parseScriptIds } from '@/lib/popup';

type IkasClient = ReturnType<typeof getIkas>;

export const POPUP_SCRIPT_NAME = 'Stok Erime Duyuru Popupı';

/** The bootstrap tag injected into every storefront; it loads the renderer JS. */
export function buildBootstrapTag(base: string, merchantId: string): string {
  return `<script defer src="${base}/api/public/popup-script/${merchantId}"></script>`;
}

/**
 * Creates or refreshes the popup bootstrap script on every storefront of the
 * merchant and returns the updated storefrontId -> scriptId map plus the
 * storefront count.
 *
 * Idempotent: existing script ids are updated in place, so calling this on
 * every dashboard load is safe. Used by the auto-install path (preflight B2)
 * and by "Yayınla".
 */
export async function ensurePopupScripts(
  ikasClient: IkasClient,
  merchantId: string,
  storedScriptIds: string | null,
  base: string,
): Promise<{ scriptIds: Record<string, string>; storefrontCount: number }> {
  const storefrontsResult = await ikasClient.queries.listStorefront();
  const storefronts = storefrontsResult.data?.listStorefront ?? [];
  if (!storefrontsResult.isSuccess || storefronts.length === 0) {
    throw new Error('Online mağaza bulunamadı');
  }

  const scriptContent = buildBootstrapTag(base, merchantId);
  const scriptIds = parseScriptIds(storedScriptIds);

  for (const storefront of storefronts) {
    const existingId = scriptIds[storefront.id];
    if (existingId) {
      const updated = await ikasClient.mutations.updateStorefrontJSScript({
        input: { id: existingId, name: POPUP_SCRIPT_NAME, scriptContent, storefrontId: storefront.id },
      });
      if (!updated.isSuccess) {
        throw new Error('Vitrin scripti güncellenemedi');
      }
    } else {
      const created = await ikasClient.mutations.createStorefrontJSScript({
        input: {
          storefrontId: storefront.id,
          name: POPUP_SCRIPT_NAME,
          contentType: StorefrontJSScriptContentTypeEnum.SCRIPT,
          isHighPriority: false,
          scriptContent,
        },
      });
      const createdScript = created.data?.createStorefrontJSScript;
      if (!created.isSuccess || !createdScript?.id) {
        throw new Error('Vitrin scripti eklenemedi');
      }
      scriptIds[storefront.id] = createdScript.id;
    }
  }

  return { scriptIds, storefrontCount: storefronts.length };
}

/**
 * Best-effort removal of every storefront script this app has injected.
 * ikas reports "script not found" once the list is empty — that counts as done.
 */
export async function removePopupScripts(ikasClient: IkasClient): Promise<void> {
  const result = await ikasClient.mutations.deleteStorefrontJSScript();
  if (result.isSuccess) return;
  const detail = JSON.stringify(result.errors ?? result.error ?? '');
  if (detail.includes('storefront_sf_script') || detail.includes('STOREFRONT_SF_SCRIPT')) return;
  throw new Error(`Vitrin scripti kaldırılamadı: ${detail.slice(0, 200)}`);
}

/** Guards a cleanup call against a hanging token refresh (dead refresh token). */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
      timer.unref?.();
    }),
  ]);
}
