#!/usr/bin/env node
/**
 * Minimal Node.js server that:
 *   1. Serves the static ChatGPT-esque frontend (public/)
 *   2. Proxies /api/* requests to a LiteLLM proxy (default https://api-internal.8451.com/ai/proxy)
 *
 * No external dependencies — uses only Node built-ins.
 *
 * Env vars:
 *   PORT              - Port for this server (default 3000)
 *   LITELLM_BASE_URL  - LiteLLM proxy base URL (default https://api-internal.8451.com/ai/proxy)
 *   LITELLM_API_KEY   - Optional API key forwarded as Authorization: Bearer ...
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT || '3000', 10);
// Strip any trailing slash so we don't end up with `//v1/...`
const LITELLM_BASE_URL = (process.env.LITELLM_BASE_URL || 'https://api-internal.8451.com/ai/proxy')
    .replace(/\/+$/, '');
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || '';

const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg':  'image/svg+xml',
    '.png':  'image/png',
    '.ico':  'image/x-icon',
};

function serveStatic(req, res) {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = path.join(PUBLIC_DIR, urlPath);
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403).end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
}

function proxyToLiteLLM(req, res) {
    // /api/foo/bar -> {LITELLM_BASE_URL}/foo/bar
    const subPath = req.url.replace(/^\/api/, '');
    const target = new URL(LITELLM_BASE_URL + subPath);
    const client = target.protocol === 'https:' ? https : http;

    const headers = { ...req.headers };
    delete headers['host'];
    delete headers['content-length']; // will be recomputed
    // Force identity encoding — Node won't auto-decompress, and we need to
    // stream SSE through untouched.
    headers['accept-encoding'] = 'identity';
    // Always override Authorization with our server-side key if set.
    // (The browser never sends one anyway.)
    if (LITELLM_API_KEY) {
        headers['authorization'] = `Bearer ${LITELLM_API_KEY}`;
    }
    // Make sure upstream sees the right Host header for TLS / vhost routing
    headers['host'] = target.host;

    const options = {
        method: req.method,
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: target.pathname + target.search,
        headers,
    };

    const upstream = client.request(options, (upRes) => {
        // Strip headers that would break chunked SSE forwarding
        const outHeaders = { ...upRes.headers };
        delete outHeaders['content-encoding'];
        delete outHeaders['content-length'];
        delete outHeaders['transfer-encoding'];
        // Keep the stream raw and uncompressed; disable proxy/Node buffering hints
        outHeaders['cache-control'] = 'no-cache, no-transform';
        outHeaders['x-accel-buffering'] = 'no';
        res.writeHead(upRes.statusCode || 502, outHeaders);
        upRes.pipe(res);
    });

    upstream.on('error', (err) => {
        console.error(`Upstream error (${req.method} ${target.href}):`, err.message);
        if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: `Upstream error: ${err.message}` } }));
        } else {
            res.end();
        }
    });

    req.pipe(upstream);
}

const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) {
        proxyToLiteLLM(req, res);
    } else {
        serveStatic(req, res);
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 UI running at  http://localhost:${PORT}`);
    console.log(`🔀 Proxying /api/* -> ${LITELLM_BASE_URL}`);
    if (LITELLM_API_KEY) {
        const masked = LITELLM_API_KEY.length > 8
            ? LITELLM_API_KEY.slice(0, 4) + '…' + LITELLM_API_KEY.slice(-4)
            : '****';
        console.log(`🔑 Using LITELLM_API_KEY=${masked}`);
    } else {
        console.log(`ℹ️  No LITELLM_API_KEY set — requests sent without Authorization header.`);
    }
    console.log('');
});
