// Local stand-in for Vercel: builds public/ for localhost, serves it, and routes
// /mcp and /api/offices to the same handlers the deployed functions use.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { handleMcpHttp, handleOfficesHttp } from '../lib/http.js';
import { PUBLIC_DIR, build } from './build.js';

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = `http://localhost:${PORT}`;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webp': 'image/webp',
};
// Mirrors the rewrites in vercel.json.
const REWRITES = { '/': '/index.html', '/mcp/server-card': '/mcp/server-card.json' };

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function route(req) {
  const url = new URL(req.url, BASE_URL);
  if (url.pathname === '/mcp') {
    const raw = await readBody(req);
    return handleMcpHttp({ method: req.method, readJson: () => JSON.parse(raw), baseUrl: BASE_URL });
  }
  if (url.pathname === '/api/offices') {
    return handleOfficesHttp({ method: req.method, query: url.searchParams, baseUrl: BASE_URL });
  }

  const file = resolve(PUBLIC_DIR, `.${REWRITES[url.pathname] ?? decodeURIComponent(url.pathname)}`);
  if (!file.startsWith(PUBLIC_DIR + sep)) return { status: 403, headers: {}, body: 'Forbidden' };
  try {
    const body = await readFile(file);
    return { status: 200, headers: { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }, body };
  } catch {
    return { status: 404, headers: { 'Content-Type': 'text/plain' }, body: 'Not found' };
  }
}

build(BASE_URL);
createServer(async (req, res) => {
  const { status, headers, body } = await route(req);
  res.writeHead(status, headers);
  res.end(body);
}).listen(PORT, () => {
  console.log(`Serving public/ at ${BASE_URL} — MCP endpoint ${BASE_URL}/mcp`);
});
