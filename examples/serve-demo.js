const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_PAGE = '/examples/soilknowledgebase-demo.html';
const PORT = Number(process.env.PORT || 4173);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

function sendResponse(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(body);
}

function resolvePathFromRequest(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0]);
  const requestPath = decodedPath === '/' ? DEFAULT_PAGE : decodedPath;
  const absolutePath = path.resolve(ROOT_DIR, `.${requestPath}`);

  if (!absolutePath.startsWith(ROOT_DIR)) {
    return undefined;
  }

  return absolutePath;
}

http
  .createServer((req, res) => {
    const requestedPath = resolvePathFromRequest(req.url || '/');
    if (!requestedPath) {
      sendResponse(res, 403, 'Forbidden');
      return;
    }

    fs.stat(requestedPath, (error, stat) => {
      if (error || !stat.isFile()) {
        sendResponse(res, 404, 'Not found');
        return;
      }

      const extension = path.extname(requestedPath).toLowerCase();
      const contentType = CONTENT_TYPES[extension] || 'application/octet-stream';

      fs.readFile(requestedPath, (readError, data) => {
        if (readError) {
          sendResponse(res, 500, 'Unable to read file');
          return;
        }

        sendResponse(res, 200, data, contentType);
      });
    });
  })
  .listen(PORT, () => {
    console.log(`Demo server running at http://localhost:${PORT}${DEFAULT_PAGE}`);
  });
