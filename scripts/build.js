// Generates every discovery file in public/ from data/listings.json, so the
// listing, the ARD catalog, llms.txt and schema.org markup never disagree.
// Run: SITE_URL=https://your-domain node scripts/build.js
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { allOffices, formatPhone, formatPrice, placeLine, toPublic, whatsappUrl } from '../lib/listings.js';
import { PROTOCOL_VERSIONS, SERVER_INFO, TOOLS } from '../lib/mcp.js';
import { SITE, siteUrlFromEnv } from '../lib/site.js';

export const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
// JSON inside <script> must not be able to close the tag.
const scriptJson = (value) => JSON.stringify(value, null, 2).replace(/</g, '\\u003c');
const pretty = (value) => `${JSON.stringify(value, null, 2)}\n`;

function write(path, content) {
  const file = join(PUBLIC_DIR, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function latestUpdate(offices) {
  return `${offices.map((office) => office.updatedAt).sort().at(-1)}T00:00:00Z`;
}

// ---- schema.org (read by search engines, which is how ChatGPT, Claude and Grok search the web) ----

function realEstateListing(office) {
  const unitCode = { month: 'MON', year: 'ANN' }[office.price.period];
  return {
    '@type': 'RealEstateListing',
    '@id': office.url,
    url: office.url,
    name: office.title.ar,
    alternateName: office.title.en,
    description: `${office.description.ar}\n\n${office.description.en}`,
    datePosted: office.datePosted,
    inLanguage: ['ar', 'en'],
    image: office.images,
    offers: {
      '@type': 'Offer',
      price: office.price.amount,
      priceCurrency: office.price.currency,
      ...(unitCode && {
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: office.price.amount,
          priceCurrency: office.price.currency,
          unitCode,
        },
      }),
      businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Person', name: office.contact.name, telephone: office.contact.phone },
      itemOffered: {
        '@type': 'Accommodation',
        name: office.title.en,
        floorSize: { '@type': 'QuantitativeValue', value: office.areaM2, unitCode: 'MTK' },
        address: {
          '@type': 'PostalAddress',
          addressLocality: office.location.locality.en,
          addressRegion: office.location.region.en,
          addressCountry: 'SY',
        },
      },
    },
  };
}

// ---- HTML: one plain, crawlable page; the product itself is headless ----

function officeArticle(office) {
  const { contact } = office;
  const enquiry = whatsappUrl(contact.whatsapp, `مرحباً، أستفسر عن: ${office.title.ar}`);
  return `
    <article id="${escapeHtml(office.id)}">
      <h2>${escapeHtml(office.title.ar)}</h2>
      <dl>
        <div><dt>السعر</dt><dd>${escapeHtml(formatPrice(office.price))}</dd></div>
        <div><dt>المساحة</dt><dd>${office.areaM2} م²</dd></div>
        <div><dt>الإكساء</dt><dd>${escapeHtml(office.finishing.ar)}</dd></div>
        <div><dt>الموقع</dt><dd>${escapeHtml(placeLine(office.location, 'ar'))}</dd></div>
        <div><dt>المعلن</dt><dd>${escapeHtml(contact.name)} (المالك)</dd></div>
      </dl>
      <p>${escapeHtml(office.description.ar)}</p>
      <p class="actions">
        <a class="button" href="${escapeHtml(enquiry)}">واتساب</a>
        <a class="button secondary" href="tel:${escapeHtml(contact.phone)}" dir="ltr">${escapeHtml(formatPhone(contact.phone))}</a>
      </p>
      <div class="gallery">
        ${office.images.map((src, i) => `<img src="${escapeHtml(src)}" alt="${escapeHtml(`${office.title.ar} — صورة ${i + 1}`)}" loading="lazy" width="750" height="1000">`).join('\n        ')}
      </div>
      <section lang="en" dir="ltr" class="en">
        <h3>${escapeHtml(office.title.en)}</h3>
        <p>${escapeHtml(office.description.en)}</p>
        <p>Price: ${escapeHtml(formatPrice(office.price))} · Area: ${office.areaM2} m² · ${escapeHtml(placeLine(office.location, 'en'))}</p>
      </section>
      <p class="source">${office.sources.map((s) => `منشور أيضاً على <a href="${escapeHtml(s.url)}">${escapeHtml(s.name)}</a>`).join(' · ')}</p>
    </article>`;
}

function renderHtml(offices, baseUrl) {
  const [first] = offices;
  const title = first ? `${first.title.ar} | ${SITE.name.ar}` : SITE.name.ar;
  const jsonLd = { '@context': 'https://schema.org', '@graph': offices.map(realEstateListing) };
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(SITE.summary.ar)}">
  <link rel="canonical" href="${baseUrl}/">
  <link rel="ard" href="${baseUrl}/.well-known/ard.json">
  <link rel="alternate" type="text/markdown" href="${baseUrl}/llms.txt">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="ar_SY">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(SITE.summary.ar)}">
  <meta property="og:url" content="${baseUrl}/">
  ${first ? `<meta property="og:image" content="${escapeHtml(first.images[0])}">` : ''}
  <script type="application/ld+json">
${scriptJson(jsonLd)}
  </script>
  <style>
    :root { --bg: #fafaf9; --fg: #1c1917; --muted: #57534e; --line: #e7e5e4; --accent: #15803d; --card: #fff; }
    @media (prefers-color-scheme: dark) {
      :root { --bg: #1c1917; --fg: #f5f5f4; --muted: #a8a29e; --line: #44403c; --accent: #4ade80; --card: #292524; }
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--fg); font: 17px/1.7 system-ui, "Segoe UI", Tahoma, sans-serif; }
    main { max-width: 860px; margin: 0 auto; padding: 32px 16px 64px; }
    header p { color: var(--muted); margin-top: 0; }
    article { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 24px; margin-top: 24px; }
    h1 { font-size: 1.6rem; margin-bottom: 4px; }
    h2 { font-size: 1.3rem; margin-top: 0; }
    dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 16px 0; }
    dl div { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
    dt { color: var(--muted); font-size: 0.85rem; }
    dd { margin: 0; font-weight: 600; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .button { display: inline-block; padding: 10px 18px; border-radius: 10px; background: var(--accent); color: #fff; text-decoration: none; font-weight: 600; }
    .button.secondary { background: transparent; color: var(--fg); border: 1px solid var(--line); }
    .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin: 20px 0; }
    .gallery img { width: 100%; height: auto; aspect-ratio: 3 / 4; object-fit: cover; border-radius: 10px; }
    .en { border-top: 1px solid var(--line); margin-top: 20px; padding-top: 8px; color: var(--muted); }
    .source, footer { color: var(--muted); font-size: 0.85rem; }
    a { color: var(--accent); }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(SITE.name.ar)}</h1>
      <p>${escapeHtml(SITE.summary.ar)}</p>
    </header>
    ${offices.map(officeArticle).join('\n')}
    <footer>
      <p>For AI agents: <a href="/.well-known/ard.json">ARD catalog</a> · <a href="/mcp/server-card">MCP server</a> · <a href="/openapi.json">OpenAPI</a> · <a href="/llms.txt">llms.txt</a></p>
    </footer>
  </main>
</body>
</html>
`;
}

// ---- llms.txt: the same facts as plain Markdown for models that read pages directly ----

function renderLlmsTxt(offices, baseUrl) {
  const blocks = offices.map((office) => [
    `## ${office.title.ar}`,
    `${office.title.en}`,
    '',
    `- السعر / Price: ${formatPrice(office.price)}`,
    `- المساحة / Area: ${office.areaM2} m²`,
    `- الإكساء / Finishing: ${office.finishing.ar} (${office.finishing.en})`,
    `- الموقع / Location: ${placeLine(office.location, 'ar')} — ${placeLine(office.location, 'en')}`,
    `- المعلن / Listed by: ${office.contact.name} (owner)`,
    `- هاتف وواتساب / Phone & WhatsApp: ${formatPhone(office.contact.phone)} — ${office.contact.whatsappUrl}`,
    `- الصفحة / Page: ${office.url}`,
    `- الصور / Photos: ${office.images.join(' , ')}`,
    ...office.sources.map((s) => `- ${s.name}: ${s.url}`),
    '',
    office.description.ar,
    '',
    office.description.en,
  ].join('\n'));

  return `# ${SITE.name.ar} — ${SITE.name.en}

> ${SITE.summary.ar}
> ${SITE.summary.en}

${blocks.join('\n\n')}

## For AI agents

- MCP server (Streamable HTTP, no auth): ${baseUrl}/mcp — tools: ${TOOLS.map((t) => t.name).join(', ')}
- MCP server card: ${baseUrl}/mcp/server-card
- ARD catalog: ${baseUrl}/.well-known/ard.json
- REST API: ${baseUrl}/api/offices?location=Yaafour&max_price_usd=3000 (OpenAPI: ${baseUrl}/openapi.json)
- All listings as JSON: ${baseUrl}/listings.json
`;
}

// ---- Agent discovery: ARD catalog, MCP server card, OpenAPI ----

function ardEntries(baseUrl, updatedAt) {
  const publisher = new URL(baseUrl).hostname;
  const shared = {
    description: SITE.summary.en,
    tags: SITE.tags,
    representativeQueries: SITE.representativeQueries,
    version: SERVER_INFO.version,
    updatedAt,
  };
  return [
    {
      identifier: `urn:air:${publisher}:server:office-rentals`,
      displayName: `${SITE.name.en} — MCP server`,
      type: 'application/mcp-server-card+json',
      url: `${baseUrl}/mcp/server-card`,
      capabilities: TOOLS.map((tool) => tool.name),
      ...shared,
    },
    {
      identifier: `urn:air:${publisher}:api:office-rentals`,
      displayName: `${SITE.name.en} — REST API`,
      type: 'application/vnd.oai.openapi+json;version=3.1.0',
      url: `${baseUrl}/openapi.json`,
      capabilities: ['searchOffices'],
      ...shared,
    },
    {
      identifier: `urn:air:${publisher}:doc:office-listings`,
      displayName: `${SITE.name.en} — listings (Markdown)`,
      type: 'text/markdown',
      url: `${baseUrl}/llms.txt`,
      ...shared,
    },
  ];
}

function serverCard(baseUrl) {
  // Server Card names are reverse-DNS, e.g. app.vercel.yafooroffice/office-rentals.
  const reverseHost = new URL(baseUrl).hostname.split('.').reverse().join('.');
  return {
    name: `${reverseHost}/office-rentals`,
    title: SERVER_INFO.title,
    version: SERVER_INFO.version,
    description: SITE.summary.en,
    websiteUrl: `${baseUrl}/`,
    repository: { url: SITE.repository, source: 'github' },
    icons: [{ src: `${baseUrl}/images/office-1.webp`, mimeType: 'image/webp' }],
    remotes: [{ type: 'streamable-http', url: `${baseUrl}/mcp`, supportedProtocolVersions: PROTOCOL_VERSIONS }],
  };
}

function openApi(baseUrl) {
  const localized = { type: 'object', properties: { ar: { type: 'string' }, en: { type: 'string' } } };
  const filters = TOOLS.find((tool) => tool.name === 'search_offices').inputSchema.properties;
  return {
    openapi: '3.1.0',
    info: { title: `${SITE.name.en} API`, version: SERVER_INFO.version, description: `${SITE.summary.en}\n\n${SITE.summary.ar}` },
    servers: [{ url: baseUrl }],
    paths: {
      '/api/offices': {
        get: {
          operationId: 'searchOffices',
          summary: 'Search offices for rent in Yaafour / Rif Dimashq, Syria',
          description: 'All filters are optional; with none, every available office is returned. Pass id to fetch one listing.',
          parameters: [
            ...Object.entries(filters).map(([name, schema]) => ({
              name, in: 'query', required: false, description: schema.description, schema: { type: schema.type },
            })),
            { name: 'id', in: 'query', required: false, description: 'Return only this listing.', schema: { type: 'string' } },
          ],
          responses: {
            200: {
              description: 'Matching offices',
              content: {
                'application/json': {
                  schema: { type: 'object', properties: { offices: { type: 'array', items: { $ref: '#/components/schemas/Office' } } } },
                },
              },
            },
            400: { description: 'Invalid filter value' },
          },
        },
      },
    },
    components: {
      schemas: {
        Office: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            status: { type: 'string', enum: ['available', 'rented'] },
            title: localized,
            description: localized,
            price: {
              type: 'object',
              properties: {
                amount: { type: 'number' },
                currency: { type: 'string' },
                period: { type: ['string', 'null'], enum: ['month', 'year', null] },
              },
            },
            areaM2: { type: 'number' },
            finishing: localized,
            location: { type: 'object', description: 'locality, district, region, country — each with ar and en names' },
            contact: {
              type: 'object',
              properties: {
                role: { type: 'string' },
                name: { type: 'string' },
                phone: { type: 'string' },
                whatsapp: { type: 'string' },
                whatsappUrl: { type: 'string', format: 'uri' },
              },
            },
            images: { type: 'array', items: { type: 'string', format: 'uri' } },
            url: { type: 'string', format: 'uri' },
            datePosted: { type: 'string', format: 'date' },
          },
        },
      },
    },
  };
}

export function build(baseUrl) {
  const offices = allOffices().map((office) => toPublic(office, baseUrl));
  const updatedAt = latestUpdate(allOffices());
  const entries = ardEntries(baseUrl, updatedAt);

  write('index.html', renderHtml(offices, baseUrl));
  write('llms.txt', renderLlmsTxt(offices, baseUrl));
  write('listings.json', pretty({ offices }));
  write('openapi.json', pretty(openApi(baseUrl)));
  write('mcp/server-card.json', pretty(serverCard(baseUrl)));
  write('.well-known/mcp/server-card.json', pretty(serverCard(baseUrl)));
  write('.well-known/ard.json', pretty({ entries }));
  // Predecessor path (ARD v0.9 / AI Catalog), still read by crawlers written against the earlier draft.
  write('.well-known/ai-catalog.json', pretty({ specVersion: '1.0', host: { displayName: SITE.name.en }, entries }));
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${baseUrl}/sitemap.xml\nAgentmap: ${baseUrl}/.well-known/ard.json\n`);
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc><lastmod>${updatedAt.slice(0, 10)}</lastmod></url>
  <url><loc>${baseUrl}/llms.txt</loc><lastmod>${updatedAt.slice(0, 10)}</lastmod></url>
</urlset>
`);
  return { baseUrl, offices: offices.length };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = build(siteUrlFromEnv() ?? 'http://localhost:3000');
  console.log(`Built ${result.offices} listing(s) for ${result.baseUrl} into public/`);
}
