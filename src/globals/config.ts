// Trailing slashes would produce "//api/..." and break the byte-identical
// match with the Partner-panel Redirect Address. A missing scheme would send
// "host/path" as redirect_uri and ikas answers "redirect_uri is not
// whitelisted" — so bare hosts are upgraded to https:// automatically.
const rawDeployUrl = process.env.NEXT_PUBLIC_DEPLOY_URL?.replace(/\/+$/, '') ?? '';
const deployUrl = rawDeployUrl && !/^https?:\/\//i.test(rawDeployUrl) ? `https://${rawDeployUrl}` : rawDeployUrl;

/**
 * Required server secrets fail fast at boot: a missing secret must never fall
 * back to '' — tokens would then be signed/verified with an empty key.
 */
function requireEnv(name: string, value: string | undefined, minLength = 1): string {
  if (!value || value.length < minLength) {
    throw new Error(`Missing or invalid required environment variable: ${name} (min length ${minLength})`);
  }
  return value;
}

const clientSecretName = 'CLIENT_SECRET';
const cookiePasswordName = 'SECRET_COOKIE_PASSWORD';

export const config = {
  // Graph API and Store config
  graphApiUrl: process.env.NEXT_PUBLIC_GRAPH_API_URL,
  adminUrl: process.env.NEXT_PUBLIC_ADMIN_URL,

  /**
   * Secrets are validated on first USE (lazy getters), not at module load:
   * `next build` imports route modules without runtime env, and a misconfigured
   * deploy must still fail immediately — with a clear message — on first use.
   */
  get cookiePassword(): string {
    return requireEnv(cookiePasswordName, process.env.SECRET_COOKIE_PASSWORD, 32);
  },

  // OAuth configuration — keep in sync with Partner panel › Uygulama Yetkileri
  // (least privilege: products + inventories for scanning/prices, campaigns for
  // legacy ikas-campaign cleanup, storefronts for the popup script).
  oauth: {
    scope: 'read_products,write_products,read_inventories,write_inventories,write_campaigns,write_storefronts',
    clientId: process.env.NEXT_PUBLIC_CLIENT_ID,
    get clientSecret(): string {
      return requireEnv(clientSecretName, process.env.CLIENT_SECRET);
    },
    redirectUri: `${deployUrl}/api/oauth/callback/ikas`,
  }
};

export type Config = typeof config;
