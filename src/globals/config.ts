// Trailing slashes would produce "//api/..." and break the byte-identical
// match with the Partner-panel Redirect Address.
const deployUrl = process.env.NEXT_PUBLIC_DEPLOY_URL?.replace(/\/+$/, '');

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

const clientSecret = requireEnv('CLIENT_SECRET', process.env.CLIENT_SECRET);
const cookiePassword = requireEnv('SECRET_COOKIE_PASSWORD', process.env.SECRET_COOKIE_PASSWORD, 32);

export const config = {
  // Graph API and Store config
  graphApiUrl: process.env.NEXT_PUBLIC_GRAPH_API_URL,
  adminUrl: process.env.NEXT_PUBLIC_ADMIN_URL,
  cookiePassword,

  // OAuth configuration — keep in sync with Partner panel › Uygulama Yetkileri
  // (least privilege: products + inventories for scanning/prices, campaigns for
  // legacy ikas-campaign cleanup, storefronts for the popup script).
  oauth: {
    scope: 'read_products,write_products,read_inventories,write_inventories,write_campaigns,write_storefronts',
    clientId: process.env.NEXT_PUBLIC_CLIENT_ID,
    clientSecret,
    redirectUri: `${deployUrl}/api/oauth/callback/ikas`,
  }
};

export type Config = typeof config;
