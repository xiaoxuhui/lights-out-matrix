import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const file = new URL('../dist/index.html', import.meta.url);
const port = Number(process.env.LIGHTS_MATRIX_PORT || 4173);
const server = createServer(async (req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (req.url !== '/' && req.url !== '/index.html') { res.writeHead(404); res.end('Not found'); return; }
  try { const html = await readFile(file); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(html); }
  catch { res.writeHead(500); res.end('Build first: node scripts/build.mjs'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}`));
