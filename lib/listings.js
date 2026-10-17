import { readFileSync } from 'node:fs';

const listings = JSON.parse(readFileSync(new URL('../data/listings.json', import.meta.url), 'utf8'));

const LOCATION_LEVELS = ['locality', 'district', 'region', 'country'];
const PERIODS = { month: 'شهرياً / per month', year: 'سنوياً / per year' };

export class InvalidArgument extends Error {}

// Folds the spellings people type for the same place: Arabic letter variants and
// diacritics, Latin case, and the apostrophe in transliterations like Ya'fur.
export function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/['’`ʿʾ]/g, '')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function matchesLocation(listing, query) {
  const q = normalize(query);
  if (!q) return true;
  return LOCATION_LEVELS
    .flatMap((level) => {
      const place = listing.location[level];
      return [place.ar, place.en, ...(place.aliases ?? [])];
    })
    .map(normalize)
    .some((term) => q.includes(term) || (q.length >= 3 && term.includes(q)));
}

function optionalNumber(value, name) {
  if (value == null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new InvalidArgument(`${name} must be a number.`);
  return number;
}

// Tool arguments and REST query params share the same snake_case names.
export function parseFilters(args = {}) {
  if (args.location != null && typeof args.location !== 'string') {
    throw new InvalidArgument('location must be a string.');
  }
  return {
    location: args.location || undefined,
    maxPriceUsd: optionalNumber(args.max_price_usd, 'max_price_usd'),
    minAreaM2: optionalNumber(args.min_area_m2, 'min_area_m2'),
    maxAreaM2: optionalNumber(args.max_area_m2, 'max_area_m2'),
  };
}

export function searchOffices({ location, maxPriceUsd, minAreaM2, maxAreaM2 } = {}) {
  return listings.filter((listing) =>
    listing.status === 'available'
    && (location == null || matchesLocation(listing, location))
    && (maxPriceUsd == null || (listing.price.currency === 'USD' && listing.price.amount <= maxPriceUsd))
    && (minAreaM2 == null || listing.areaM2 >= minAreaM2)
    && (maxAreaM2 == null || listing.areaM2 <= maxAreaM2));
}

export function getOffice(id) {
  return listings.find((listing) => listing.id === id) ?? null;
}

export function allOffices() {
  return listings.filter((listing) => listing.status === 'available');
}

// What leaves the server: absolute URLs, so an agent can show photos and links as-is.
export function toPublic(listing, baseUrl) {
  return {
    ...listing,
    url: `${baseUrl}/#${listing.id}`,
    images: listing.images.map((src) => new URL(src, baseUrl).href),
    contact: { ...listing.contact, whatsappUrl: whatsappUrl(listing.contact.whatsapp) },
  };
}

export function whatsappUrl(number, text) {
  const url = `https://wa.me/${number.replace(/\D/g, '')}`;
  return text ? `${url}?text=${encodeURIComponent(text)}` : url;
}

export function formatPrice({ amount, currency, period }) {
  const text = `${amount.toLocaleString('en-US')} ${currency}`;
  return period ? `${text} ${PERIODS[period]}` : text;
}

export function formatPhone(phone) {
  return phone.replace(/^\+(\d{3})(\d{3})(\d{3})(\d{3})$/, '+$1 $2 $3 $4');
}

export function placeLine(location, lang) {
  return LOCATION_LEVELS.map((level) => location[level][lang]).join(lang === 'ar' ? '، ' : ', ');
}

export function formatOffice(office) {
  const { contact } = office;
  return [
    office.title.ar,
    office.title.en,
    '',
    `• السعر / Price: ${formatPrice(office.price)}`,
    `• المساحة / Area: ${office.areaM2} م² (m²)`,
    `• الإكساء / Finishing: ${office.finishing.ar} (${office.finishing.en})`,
    `• الموقع / Location: ${placeLine(office.location, 'ar')} — ${placeLine(office.location, 'en')}`,
    `• المعلن / Listed by: ${contact.name} (${contact.role === 'owner' ? 'المالك / owner' : contact.role})`,
    `• هاتف وواتساب / Phone & WhatsApp: ${formatPhone(contact.phone)} — ${contact.whatsappUrl}`,
    `• الصفحة / Page: ${office.url}`,
    `• الصور / Photos: ${office.images.join(' ')}`,
    `• id: ${office.id}`,
    '',
    office.description.ar,
    '',
    office.description.en,
  ].join('\n');
}
