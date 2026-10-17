export const SITE = {
  name: { ar: 'مكاتب للإيجار في يعفور', en: 'Yaafour Office Rentals' },
  summary: {
    ar: 'مكاتب للإيجار في يعفور (منطقة قطنا، ريف دمشق، سوريا) معروضة من المالك مباشرة، مع السعر والمساحة والصور ورقم التواصل.',
    en: 'Offices for rent in Yaafour (Qatana district, Rif Dimashq, Syria), listed directly by the owner, with price, area, photos and contact number.',
  },
  repository: 'https://github.com/jirventures/jir-gpaas-ps-marketing-yafooroffice',
  // What people actually type. Registries match against these, so keep 2-5 (ARD §4).
  representativeQueries: [
    'مكتب للإيجار في يعفور',
    'مكاتب للإيجار في ريف دمشق',
    'office for rent in Yaafour, Syria',
    'office space for rent near Damascus',
    'مكتب 100 متر للإيجار من المالك قرب دمشق',
  ],
  tags: [
    'real-estate', 'office-rental', 'commercial-property', 'syria', 'damascus', 'rif-dimashq', 'yaafour',
    'عقارات', 'مكتب للإيجار', 'يعفور', 'ريف دمشق', 'دمشق',
  ],
};

// SITE_URL wins so a custom domain stays canonical; otherwise Vercel's production domain.
export function siteUrlFromEnv(env = process.env) {
  if (env.SITE_URL) return env.SITE_URL.replace(/\/+$/, '');
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return null;
}

export function baseUrlFor(headers) {
  const host = headers['x-forwarded-host'] ?? headers.host;
  return siteUrlFromEnv() ?? `${headers['x-forwarded-proto'] ?? 'http'}://${host}`;
}
