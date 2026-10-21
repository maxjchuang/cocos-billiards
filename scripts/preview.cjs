const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// Serve Creator's exported Web Mobile build; this does not compile Cocos sources.
const root = path.resolve(__dirname, '../build/web-mobile');
const port = 8766;
if (!fs.existsSync(path.join(root, 'index.html'))) {
    console.error('未找到 build/web-mobile/index.html，请先使用 Cocos Creator 构建 Web Mobile。');
    process.exit(1);
}
const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
    '.css': 'text/css; charset=utf-8', '.wasm': 'application/wasm',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
};
const server = http.createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
    catch { response.writeHead(400); response.end(); return; }
    if (pathname.includes('\0')) { response.writeHead(400); response.end(); return; }
    const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
    fs.stat(file, (error, stat) => {
        if (error || !stat.isFile()) { response.writeHead(404); response.end('Not found'); return; }
        response.writeHead(200, {
            'Content-Type': types[path.extname(file)] || 'application/octet-stream',
            'Content-Length': stat.size, 'Cache-Control': 'no-cache',
        });
        if (request.method === 'HEAD') { response.end(); return; }
        fs.createReadStream(file).on('error', () => response.destroy()).pipe(response);
    });
});
server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用，请检查现有预览服务。` : error.message);
    process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`Cocos Web Mobile 预览：http://127.0.0.1:${port}/`));
