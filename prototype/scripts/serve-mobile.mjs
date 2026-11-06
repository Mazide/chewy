// A private HTTPS entry for the built prototype. Existing Serve routes stay intact.
import { createServer } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, realpath, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const options = Object.fromEntries(process.argv.slice(2).map(value => value.replace(/^--/, '').split('=')));
const port = Number(options.port ?? 6008);
const httpsPort = Number(options['https-port'] ?? 8443);
if (![port, httpsPort].every(value => Number.isInteger(value) && value > 1023 && value < 65536)) {
  console.error('Use --port=6008 --https-port=8443 with ports between 1024 and 65535.');
  process.exit(1);
}
const root = fileURLToPath(new URL('../storybook-static/', import.meta.url));
const jsonCommand = args => JSON.parse(execFileSync('tailscale', args, { encoding: 'utf8', timeout: 10000 }));
let hostname;
try {
  await stat(path.join(root, 'iframe.html'));
  const status = jsonCommand(['status', '--json']);
  hostname = status.Self?.DNSName?.replace(/\.$/, '');
  if (status.BackendState !== 'Running' || !hostname || !status.CertDomains?.includes(hostname)) {
    throw new Error('Tailscale must be connected with HTTPS certificates enabled for this device.');
  }
  const config = jsonCommand(['serve', 'status', '--json']);
  const usesPort = value => value && typeof value === 'object' &&
    (Object.hasOwn(value.TCP ?? {}, String(httpsPort)) || Object.values(value).some(child => typeof child === 'object' && usesPort(child)));
  if (usesPort(config)) throw new Error(`Tailscale Serve already uses port ${httpsPort}; choose another --https-port. Existing routes were not changed.`);
} catch (error) {
  console.error(`Cannot start mobile preview: ${error.message}`);
  console.error('Build first with npm run build. This launcher needs an existing Tailscale connection and HTTPS setup.');
  process.exit(1);
}
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.webmanifest':'application/manifest+json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif', '.mp4':'video/mp4', '.woff':'font/woff', '.woff2':'font/woff2', '.ico':'image/x-icon', '.wasm':'application/wasm' };
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const candidate = path.resolve(root, `.${pathname === '/' ? '/mobile.html' : pathname}`);
    const file = await realpath(candidate);
    if (!file.startsWith(`${root.replace(/\/$/, '')}${path.sep}`) || !(await stat(file)).isFile()) {
      response.writeHead(404); response.end(); return;
    }
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Content-Length': body.length, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => {
  console.log(`Local preview: http://localhost:${port}/mobile.html`);
  const serveArgs = ['serve', `--https=${httpsPort}`, `http://127.0.0.1:${port}`];
  const serve = Object.hasOwn(options, 'sudo')
    ? spawn('sudo', ['-n', 'tailscale', ...serveArgs], { stdio: 'inherit' })
    : spawn('tailscale', serveArgs, { stdio: 'inherit' });
  console.log(`Phone (same tailnet): https://${hostname}:${httpsPort}/mobile.html`);
  console.log('Keep this terminal open. Ctrl+C stops this preview and its temporary HTTPS route.');
  let stopping = false;
  const stop = () => { if (stopping) return; stopping = true; serve.kill('SIGINT'); server.close(); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  serve.on('error', error => { console.error(error.message); process.exitCode = 1; server.close(); });
  serve.on('exit', code => { if (!stopping && code) process.exitCode = code; server.close(); });
});
