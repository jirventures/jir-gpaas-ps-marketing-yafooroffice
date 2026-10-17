import { handleOfficesHttp } from '../lib/http.js';
import { baseUrlFor } from '../lib/site.js';

export default function handler(req, res) {
  const { status, headers, body } = handleOfficesHttp({
    method: req.method,
    query: new URL(req.url, 'http://localhost').searchParams,
    baseUrl: baseUrlFor(req.headers),
  });
  res.writeHead(status, headers);
  res.end(body);
}
