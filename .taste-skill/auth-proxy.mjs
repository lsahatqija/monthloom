import http from 'node:http';

const cookie = process.env.AUTH_COOKIE;
if (!cookie) throw new Error('AUTH_COOKIE is required');

http
  .createServer((request, response) => {
    const proxy = http.request(
      {
        hostname: '127.0.0.1',
        port: 3100,
        path: request.url,
        method: request.method,
        headers: { ...request.headers, host: 'localhost:3100', cookie },
      },
      (upstream) => {
        response.writeHead(upstream.statusCode ?? 502, upstream.headers);
        upstream.pipe(response);
      },
    );
    proxy.on('error', (error) => {
      response.writeHead(502, { 'content-type': 'text/plain' });
      response.end(error.message);
    });
    request.pipe(proxy);
  })
  .listen(3200, '127.0.0.1');
