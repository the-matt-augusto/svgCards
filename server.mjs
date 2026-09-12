import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carrega variáveis do arquivo .env se não estiverem no ambiente
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

let core;
try {
  core = await import('./dist/api/core.js');
} catch {
  console.error('\n[ERRO] O código compilado não foi encontrado em ./dist.');
  console.error('Execute: npm run build\n');
  process.exit(1);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

export function buildWebHeaders(reqHeaders, socketRemoteAddress, options = {}) {
  let cleanIp = socketRemoteAddress ? socketRemoteAddress.replace(/^::ffff:/, '') : '127.0.0.1';

  const isTrustedProxy = options.trustProxy ?? (
    process.env.TRUST_PROXY === 'true' ||
    (process.env.TRUSTED_PROXIES && process.env.TRUSTED_PROXIES.split(',').map((s) => s.trim()).includes(cleanIp))
  );

  const FORWARDED_HEADERS = new Set([
    'x-real-ip',
    'cf-connecting-ip',
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-proto',
  ]);

  const webHeaders = new Headers();
  for (const [key, value] of Object.entries(reqHeaders || {})) {
    if (value) {
      const lowerKey = key.toLowerCase();
      if (!isTrustedProxy && FORWARDED_HEADERS.has(lowerKey)) {
        continue;
      }
      webHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
  }

  if (!isTrustedProxy) {
    webHeaders.set('x-real-ip', cleanIp);
  }

  return webHeaders;
}

export function createRequestListener(coreModule = core) {
  return async (req, res) => {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost:3000'}`);
    const pathname = parsedUrl.pathname;

    // Roteamento das funções da API (/api/github, /api/stackoverflow, /api/twitch, /api)
    if (pathname.startsWith('/api')) {
      try {
        let defaultProvider;
        if (pathname === '/api/github') defaultProvider = 'github';
        else if (pathname === '/api/stackoverflow') defaultProvider = 'stackoverflow';
        else if (pathname === '/api/twitch') defaultProvider = 'twitch';

        const webHeaders = buildWebHeaders(req.headers, req.socket?.remoteAddress);

        const webReq = new Request(parsedUrl.href, {
          method: req.method || 'GET',
          headers: webHeaders,
        });

        const webRes = await coreModule.handleRequest(webReq, defaultProvider);

        res.statusCode = webRes.status;
        webRes.headers.forEach((val, key) => {
          res.setHeader(key, val);
        });

        const arrayBuf = await webRes.arrayBuffer();
        res.end(Buffer.from(arrayBuf));
        return;
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(`Erro interno no servidor: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
    }

    // Roteamento de arquivos estáticos (index.html, style.css, app.js)
    const publicPath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.join(__dirname, 'public', publicPath);
    if (!['/index.html', '/style.css', '/app.js'].includes(publicPath) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('404 Não Encontrado');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.statusCode = 200;
    res.setHeader('Content-Type', mime);
    fs.createReadStream(filePath).pipe(res);
  };
}

export const requestListener = createRequestListener(core);
export const server = http.createServer((req, res) => requestListener(req, res));

const isDirectExecution = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n=========================================`);
    console.log(`  SVG Cards - Servidor Local Ativo`);
    console.log(`=========================================`);
    console.log(`  URL Local:        http://localhost:${PORT}`);
    console.log(`  GitHub Endpoint:  http://localhost:${PORT}/api/github?username=the-matt-augusto`);
    console.log(`  Stack Overflow:   http://localhost:${PORT}/api/stackoverflow?id=1`);
    console.log(`  Twitch Endpoint:  http://localhost:${PORT}/api/twitch?channel=ninja`);
    console.log(`=========================================\n`);
  });
}
