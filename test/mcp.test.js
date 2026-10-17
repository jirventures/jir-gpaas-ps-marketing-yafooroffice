import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { handleMcpHttp } from '../lib/http.js';
import { searchOffices } from '../lib/listings.js';
import { PROTOCOL_VERSIONS, handleMessage } from '../lib/mcp.js';

const ctx = { baseUrl: 'https://example.com' };
const call = (name, args) => handleMessage({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, ctx);

describe('location search', () => {
  for (const query of ['يعفور', 'بيعفور', 'Yaafour', "Ya'fur", 'yafour', 'ريف دمشق', 'Damascus countryside', 'office near Damascus', 'سورية']) {
    it(`finds the Yaafour office for "${query}"`, () => {
      assert.equal(searchOffices({ location: query }).length, 1);
    });
  }

  it('finds nothing in another city', () => {
    assert.equal(searchOffices({ location: 'Aleppo' }).length, 0);
    assert.equal(searchOffices({ location: 'حلب' }).length, 0);
  });

  it('applies price and area filters', () => {
    assert.equal(searchOffices({ maxPriceUsd: 2500, minAreaM2: 100 }).length, 1);
    assert.equal(searchOffices({ maxPriceUsd: 2000 }).length, 0);
    assert.equal(searchOffices({ minAreaM2: 150 }).length, 0);
  });
});

describe('MCP protocol', () => {
  it('negotiates the requested protocol version when supported', () => {
    const response = handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, ctx);
    assert.equal(response.result.protocolVersion, '2025-06-18');
    assert.deepEqual(response.result.capabilities, { tools: { listChanged: false } });
  });

  it('falls back to the newest version for an unknown one', () => {
    const response = handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, ctx);
    assert.equal(response.result.protocolVersion, PROTOCOL_VERSIONS[0]);
  });

  it('lists both tools', () => {
    const response = handleMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, ctx);
    assert.deepEqual(response.result.tools.map((tool) => tool.name), ['search_offices', 'get_office_details']);
  });

  it('returns the listing with absolute URLs and the owner contact', () => {
    const { result } = call('search_offices', { location: 'Yaafour', max_price_usd: '3000' });
    const [office] = result.structuredContent.offices;
    assert.equal(office.images[0], 'https://example.com/images/office-1.webp');
    assert.equal(office.contact.whatsappUrl, 'https://wa.me/963932318088');
    assert.match(result.content[0].text, /\+963 932 318 088/);
  });

  it('reports bad arguments as a tool error the model can read', () => {
    assert.equal(call('search_offices', { max_price_usd: 'cheap' }).result.isError, true);
    assert.equal(call('get_office_details', { id: 'nope' }).result.isError, true);
  });

  it('rejects unknown tools and methods', () => {
    assert.equal(call('delete_everything', {}).error.code, -32602);
    assert.equal(handleMessage({ jsonrpc: '2.0', id: 3, method: 'resources/list' }, ctx).error.code, -32601);
  });

  it('does not answer notifications', () => {
    assert.equal(handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, ctx), null);
  });
});

describe('MCP over HTTP', () => {
  const post = (raw) => handleMcpHttp({ method: 'POST', readJson: () => JSON.parse(raw), baseUrl: ctx.baseUrl });

  it('accepts a notification with 202 and no body', () => {
    const response = post('{"jsonrpc":"2.0","method":"notifications/initialized"}');
    assert.equal(response.status, 202);
    assert.equal(response.body, '');
  });

  it('answers a parse error with -32700', () => {
    const response = post('{not json');
    assert.equal(response.status, 400);
    assert.equal(JSON.parse(response.body).error.code, -32700);
  });

  it('refuses GET because there is no SSE stream', () => {
    assert.equal(handleMcpHttp({ method: 'GET', readJson: () => null, baseUrl: ctx.baseUrl }).status, 405);
  });
});
