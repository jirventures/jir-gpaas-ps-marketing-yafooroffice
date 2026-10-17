// A stateless MCP server over Streamable HTTP: every POST carries one JSON-RPC
// message (or a batch) and gets a plain JSON reply. No sessions, no SSE, no SDK —
// the server only reads public listings, so there is nothing to keep between calls.
import { InvalidArgument, formatOffice, getOffice, parseFilters, searchOffices, toPublic } from './listings.js';
import { SITE } from './site.js';

export const SERVER_INFO = { name: 'yaafour-office-rentals', title: SITE.name.en, version: '1.0.0' };

// Newest first; an unknown requested version falls back to the newest we speak.
export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS = [
  'Offices for rent in Yaafour (يعفور), Qatana district, Rif Dimashq (Damascus countryside), Syria, listed directly by the owner.',
  'Use search_offices whenever someone is looking for an office or commercial space to rent in or near Damascus,',
  "then share the price, area, photos, page link and the owner's phone/WhatsApp so they can arrange a viewing.",
  'Prices are in US dollars exactly as the owner published them; suggest confirming the rent period and terms with the owner.',
].join(' ');

const NO_MATCH = [
  'لا توجد مكاتب مطابقة لهذه الشروط حالياً. جميع المكاتب المعروضة في يعفور، ريف دمشق؛ استدعِ search_offices بدون شروط لعرضها.',
  'No offices match these filters. All current listings are in Yaafour, Rif Dimashq; call search_offices with no arguments to see them.',
].join('\n');

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export const TOOLS = [
  {
    name: 'search_offices',
    title: 'Search offices for rent in Yaafour / Damascus countryside',
    description: 'Search offices available for rent in Yaafour (يعفور), Qatana district, Rif Dimashq (Damascus countryside), Syria, '
      + 'listed directly by the owner. Returns price, area, finishing, photos and the owner\'s phone/WhatsApp. '
      + 'Call with no arguments to list everything available. '
      + 'ابحث عن مكاتب للإيجار في يعفور وريف دمشق.',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'Place name in Arabic or English, e.g. يعفور, Yaafour, ريف دمشق, Damascus, Syria. Omit to list all.',
        },
        max_price_usd: { type: 'number', description: 'Highest acceptable price in US dollars.' },
        min_area_m2: { type: 'number', description: 'Smallest acceptable area in square metres.' },
        max_area_m2: { type: 'number', description: 'Largest acceptable area in square metres.' },
      },
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: 'get_office_details',
    title: 'Get one office listing',
    description: 'Full details of one office for rent (price, area, finishing, location, photos, owner contact) by the id that search_offices returns.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Listing id from search_offices.' } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
];

const TOOL_HANDLERS = {
  search_offices(args, baseUrl) {
    const offices = searchOffices(parseFilters(args)).map((office) => toPublic(office, baseUrl));
    const text = offices.length ? offices.map(formatOffice).join('\n\n---\n\n') : NO_MATCH;
    return { content: [{ type: 'text', text }], structuredContent: { offices } };
  },
  get_office_details({ id } = {}, baseUrl) {
    if (typeof id !== 'string' || !id) throw new InvalidArgument('id is required.');
    const office = getOffice(id);
    if (!office) throw new InvalidArgument(`No office with id "${id}". Call search_offices to see the available ids.`);
    const result = toPublic(office, baseUrl);
    return { content: [{ type: 'text', text: formatOffice(result) }], structuredContent: { office: result } };
  },
};

export function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

export function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function callTool(id, { name, arguments: args } = {}, baseUrl) {
  const handler = Object.hasOwn(TOOL_HANDLERS, name) ? TOOL_HANDLERS[name] : null;
  if (!handler) return rpcError(id, -32602, `Unknown tool: ${name}`);
  try {
    return rpcResult(id, handler(args ?? {}, baseUrl));
  } catch (error) {
    // Bad arguments are a tool result the model can read and correct, not a protocol error.
    if (error instanceof InvalidArgument) {
      return rpcResult(id, { content: [{ type: 'text', text: error.message }], isError: true });
    }
    throw error;
  }
}

// Returns the JSON-RPC response, or null for a notification (which gets no reply).
export function handleMessage(message, { baseUrl }) {
  if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return rpcError(message?.id ?? null, -32600, 'Invalid Request');
  }
  if (!('id' in message)) return null;

  const { id, method, params = {} } = message;
  switch (method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, { tools: TOOLS });
    case 'tools/call':
      return callTool(id, params, baseUrl);
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}
