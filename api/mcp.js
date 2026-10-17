import { handleMcpHttp } from '../lib/http.js';
import { baseUrlFor } from '../lib/site.js';

export default function handler(req, res) {
  const { status, headers, body } = handleMcpHttp({
    method: req.method,
    // Vercel parses JSON bodies itself and throws on invalid JSON when .body is read.
    readJson: () => (typeof req.body === 'string' ? JSON.parse(req.body) : req.body),
    baseUrl: baseUrlFor(req.headers),
  });
  res.writeHead(status, headers);
  res.end(body);
}
