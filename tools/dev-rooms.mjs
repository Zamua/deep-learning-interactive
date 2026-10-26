// The rooms API (hearthsync's contract: docs/SYNC.md) in memory, for the dev server, so progress sync runs locally
// as it does on a host that serves /api/rooms. Rooms last until the server stops.
import { randomUUID } from 'node:crypto';

const ROOM = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_KEYS = 256;
const MAX_BYTES = 256 * 1024;

export function devRooms() {
  const rooms = new Map();
  const send = (res, status, body = '', type = 'text/plain') => {
    res.writeHead(status, { 'content-type': type, date: new Date().toUTCString(), 'cache-control': 'no-store' });
    res.end(body);
  };
  const json = (res, status, v) => send(res, status, JSON.stringify(v), 'application/json');
  const parse = (s) => {
    try {
      return JSON.parse(s);
    } catch {
      return s;
    }
  };
  const handle = (req, res, body) => {
    const path = new URL(req.url, 'http://dev').pathname;
    if (path === '/api/rooms' || path === '/api/rooms/') {
      if (req.method !== 'POST') return send(res, 405);
      const id = randomUUID();
      rooms.set(id, new Map());
      return json(res, 201, { id });
    }
    const m = /^\/api\/rooms\/([^/]+)(?:\/(.+))?$/.exec(path);
    if (!m) return send(res, 404);
    const [, id, raw] = m;
    if (!ROOM.test(id)) return send(res, 400);
    const kv = rooms.get(id);
    if (!kv) return send(res, 404);
    if (raw === undefined) return req.method === 'GET' ? json(res, 200, Object.fromEntries([...kv].map(([k, v]) => [k, parse(v)]))) : send(res, 405);
    const key = raw.split('/').map(decodeURIComponent).join('/');
    if (req.method === 'GET') return kv.has(key) ? send(res, 200, kv.get(key), 'application/json') : send(res, 404);
    if (req.method === 'DELETE') return kv.delete(key), send(res, 204);
    if (req.method !== 'PUT') return send(res, 405);
    const bytes = [...kv].reduce((n, [k, v]) => n + (k === key ? 0 : v.length), 0) + body.length;
    if ((!kv.has(key) && kv.size >= MAX_KEYS) || bytes > MAX_BYTES) return send(res, 413);
    kv.set(key, body);
    return send(res, 204);
  };
  const middleware = (req, res, next) => {
    if (!req.url?.startsWith('/api/rooms')) return next();
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (c) => (body += c));
    req.on('end', () => handle(req, res, body));
  };
  return {
    name: 'dev-rooms',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}
