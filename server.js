const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleApiRequest } = require('./server/apiProxy');

const PORT =
  Number(process.env.PORT) ||
  Number(process.env.FC_CUSTOM_LISTEN_PORT) ||
  3000;
const HOST = process.env.HOST || '0.0.0.0';
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const server = http.createServer(async (req, res) => {
  if (req.url && req.url.startsWith('/api/')) {
    try {
      const handled = await handleApiRequest(req, res);
      if (handled) return;
    } catch (err) {
      console.error('[server] API error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
      return;
    }
  }

  // Serve static files from dist
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let filePath = path.join(DIST_DIR, decodeURIComponent(parsedUrl.pathname));

  try {
    const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
    if (stat && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    if (!fs.existsSync(filePath)) {
      // SPA fallback to index.html
      filePath = path.join(DIST_DIR, 'index.html');
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const content = fs.readFileSync(filePath);
      // index.html must always revalidate so deploys land instantly;
      // content-hashed assets are immutable and cache forever.
      const cacheControl = filePath.endsWith('index.html')
        ? 'no-cache, no-store, must-revalidate'
        : 'public, max-age=31536000, immutable';
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': cacheControl });
      res.end(content);
      return;
    }
  } catch (err) {
    console.error('[server] Static file error:', err);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, HOST, () => {
  console.log(`[server] Arkify production server listening on ${HOST}:${PORT}`);
});
