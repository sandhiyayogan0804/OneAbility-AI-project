const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

const FRONTEND_PORT = 8085;
const BACKEND_PORT = 8000;
const ROOT_DIR = __dirname;
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');

// Common MIME types for the frontend static server
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg'
};

// 1. Locate Python Virtualenv
function findPython() {
  const venvPython1 = path.join(BACKEND_DIR, '.venv', 'Scripts', 'python.exe');
  const venvPython2 = path.join(BACKEND_DIR, 'venv', 'Scripts', 'python.exe');

  if (fs.existsSync(venvPython1)) return venvPython1;
  if (fs.existsSync(venvPython2)) return venvPython2;
  return 'python'; // System fallback
}

// 2. Start FastAPI Backend
const pythonPath = findPython();
console.log(`\x1b[36m[OneAbility AI]\x1b[0m Starting Python FastAPI backend using ${pythonPath}...`);

const backendProcess = spawn(
  pythonPath,
  ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)],
  {
    cwd: BACKEND_DIR,
    stdio: 'inherit',
    windowsHide: true
  }
);

backendProcess.on('error', (err) => {
  console.error(`\x1b[31m[Backend Error]\x1b[0m Failed to start backend: ${err.message}`);
});

// 3. Start Static File Server for Frontend
const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const safePath = path.normalize(path.join(ROOT_DIR, reqPath));
  if (!safePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('403 Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  });
});

server.listen(FRONTEND_PORT, '0.0.0.0', () => {
  console.log('\n=============================================================');
  console.log(`\x1b[32m🚀 OneAbility AI is live and ready!\x1b[0m`);
  console.log(`🌐 Frontend App:  \x1b[34mhttp://localhost:${FRONTEND_PORT}\x1b[0m`);
  console.log(`⚙️  API Backend:   \x1b[34mhttp://127.0.0.1:${BACKEND_PORT}\x1b[0m`);
  console.log(`📖 API Docs:      \x1b[34mhttp://127.0.0.1:${BACKEND_PORT}/docs\x1b[0m`);
  console.log('=============================================================\n');

  // Open default browser on Windows
  exec(`start http://localhost:${FRONTEND_PORT}`, (err) => {
    if (err) {
      console.log(`\x1b[33mOpen http://localhost:${FRONTEND_PORT} in your web browser.\x1b[0m`);
    }
  });
});

// 4. Graceful Cleanup
function shutdown() {
  console.log('\n\x1b[33m[OneAbility AI] Shutting down...\x1b[0m');
  try {
    if (backendProcess && !backendProcess.killed) {
      backendProcess.kill();
    }
  } catch (e) {}
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
