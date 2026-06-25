/** Public site origin used for QR codes and install links. */
export function getPublicSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return 'https://dojobid.com';
}

export function getInstallPageUrl(): string {
  return `${getPublicSiteUrl()}/download`;
}
