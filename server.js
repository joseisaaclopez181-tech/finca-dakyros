/**
 * Servidor local de desarrollo para Finca Dakyros.
 * Úsalo solo en desarrollo. Para producción usa un servidor real (nginx, etc.)
 * con HTTPS para que el Service Worker, dictado por voz y sincronización funcionen.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8123;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, path.normalize(urlPath));

  // Evitar salir del directorio (seguridad básica)
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Acceso prohibido'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('No encontrado: ' + urlPath); return;
    }
    const type = TYPES[path.extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('Finca Dakyros corriendo en: http://localhost:' + PORT);
});
