// Transport-neutral request handlers: Vercel functions (api/) and the local dev
// server both call these and write the returned { status, headers, body }.
import { InvalidArgument, getOffice, parseFilters, searchOffices, toPublic } from './listings.js';
import { handleMessage, rpcError } from './mcp.js';

// Everything served here is public and read-only, so any origin may call it.
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};

function json(status, value, headers = {}) {
  return {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...headers },
    body: JSON.stringify(value),
  };
}

const noContent = (status) => ({ status, headers: CORS_HEADERS, body: '' });

export function handleMcpHttp({ method, readJson, baseUrl }) {
  if (method === 'OPTIONS') return noContent(204);
  if (method !== 'POST') {
    // Stateless: there is no server-to-client stream to open (GET) or session to end (DELETE).
    return json(405, rpcError(null, -32000, 'Method not allowed. Send JSON-RPC messages with POST.'), { Allow: 'POST, OPTIONS' });
  }

  let payload;
  try {
    payload = readJson();
  } catch {
    return json(400, rpcError(null, -32700, 'Parse error'));
  }

  const batch = Array.isArray(payload);
  const responses = (batch ? payload : [payload]).map((message) => handleMessage(message, { baseUrl })).filter(Boolean);
  if (responses.length === 0) return noContent(202);
  return json(200, batch ? responses : responses[0]);
}

export function handleOfficesHttp({ method, query, baseUrl }) {
  if (method === 'OPTIONS') return noContent(204);
  if (method !== 'GET') return json(405, { error: 'Method not allowed' }, { Allow: 'GET, OPTIONS' });

  try {
    const id = query.get('id');
    const offices = id ? [getOffice(id)].filter(Boolean) : searchOffices(parseFilters(Object.fromEntries(query)));
    return json(200, { offices: offices.map((office) => toPublic(office, baseUrl)) }, { 'Cache-Control': 'public, max-age=300' });
  } catch (error) {
    if (error instanceof InvalidArgument) return json(400, { error: error.message });
    throw error;
  }
}
