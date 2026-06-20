const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  console.log(`[BulaPay Server] ${req.method} ${req.url}`);

  // Normalizar la URL de la solicitud
  let filePath = req.url === '/' || req.url === '' ? '/index.html' : req.url;
  
  // Quitar parámetros de búsqueda si los hay
  filePath = filePath.split('?')[0];

  let absolutePath = path.join(__dirname, filePath);

  // Verificar si el archivo existe
  fs.stat(absolutePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Si el archivo no existe, podría ser una ruta de la SPA. Servimos index.html
      console.log(`[BulaPay Server] File not found: ${filePath}. Serving SPA fallback index.html`);
      absolutePath = path.join(__dirname, 'index.html');
    }

    // Leer y responder con el archivo
    fs.readFile(absolutePath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Error interno del servidor');
        return;
      }

      const ext = path.extname(absolutePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, { 
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate', // Deshabilitar cache de servidor para facilitar desarrollo
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Servidor BulaPay PWA corriendo exitosamente!`);
  console.log(`👉 Abre tu navegador en: http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
