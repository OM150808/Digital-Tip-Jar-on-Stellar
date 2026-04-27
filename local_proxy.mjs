import http from 'http';
import https from 'https';

const PORT = 8080;
const TARGET_HOST = 'soroban-testnet.stellar.org';

const server = http.createServer((clientReq, clientRes) => {
    const options = {
        hostname: TARGET_HOST,
        port: 443,
        path: clientReq.url,
        method: clientReq.method,
        headers: {
            ...clientReq.headers,
            host: TARGET_HOST
        },
        rejectUnauthorized: false // THIS BYPASSES THE CORPORATE PROXY TLS ERROR!
    };

    const proxyReq = https.request(options, (proxyRes) => {
        clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(clientRes, { end: true });
    });

    clientReq.pipe(proxyReq, { end: true });

    proxyReq.on('error', (err) => {
        console.error('Proxy request error:', err);
        clientRes.writeHead(500);
        clientRes.end('Proxy error');
    });
});

server.listen(PORT, () => {
    console.log(`✅ Bypass Proxy running on http://127.0.0.1:${PORT}`);
    console.log(`Keep this window open! Open a second terminal to run your deployment.`);
});
