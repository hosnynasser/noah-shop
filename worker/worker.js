// نوح — الـAPI بتاع الموقع ولوحة التحكم (Cloudflare Worker + KV، مجاني)
// الـBindings: SHOP_KV (مخزن KV)، والسر ADMIN_CODE (كود دخول لوحة التحكم)
//
// عام (من غير كود):
//   GET  /api/products        -> {products:[...]|null}   (null = لسه محدش حفظ منتجات)
//   GET  /api/site            -> {site:{phone,whatsapp,address,hours,mapUrl}|null}
//   GET  /api/media/<id>      -> صورة المنتج
// لوحة التحكم (لازم هيدر X-Admin-Code = الكود):
//   POST /api/admin/check
//   GET  /api/admin/products
//   PUT  /api/admin/products  {products:[...]}
//   PUT  /api/admin/site      {site:{...}}
//   POST /api/admin/media     {data:<base64>,type:<mime>} -> {id}
//   POST /api/admin/media/delete {ids:[...]}

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Code',
};
const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS },
    });

const clean = (s, max) => String(s ?? '').trim().slice(0, max);
const num = (v, max = 10000000) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n * 100) / 100, max) : 0;
};
const MEDIA_ID = /^m-[A-Za-z0-9]{6,40}$/;
const MAX_PRODUCTS = 500;
const MAX_MEDIA_BASE64 = 3_000_000; // ~2.2MB صورة (اللوحة بتصغّرها قبل الرفع)

function rid(prefix, n = 10) {
    const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const b = crypto.getRandomValues(new Uint8Array(n));
    return prefix + [...b].map((x) => a[x % a.length]).join('');
}

function cleanProduct(p, seen) {
    let id = clean(p.id, 40);
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(id) || seen.has(id)) id = rid('p-', 8);
    seen.add(id);
    const out = {
        id,
        name: clean(p.name, 120),
        cat: /^[a-z0-9_-]{1,30}$/.test(p.cat) ? p.cat : 'light',
        brand: clean(p.brand, 40),
        price: num(p.price),
        old: num(p.old),
        stock: p.stock !== false,
        tags: clean(p.tags, 300),
        desc: clean(p.desc, 600),
        images: (Array.isArray(p.images) ? p.images : []).filter((m) => typeof m === 'string' && MEDIA_ID.test(m)).slice(0, 6),
    };
    if (p.sample === true) out.sample = true;
    return out;
}

function sameCode(a, b) {
    a = String(a || ''); b = String(b || '');
    let d = a.length ^ b.length;
    for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    return d === 0;
}

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
        const url = new URL(request.url);
        const path = url.pathname.replace(/\/+$/, '');

        // ---------- عام ----------
        if (path === '/api/products' && request.method === 'GET') {
            const raw = await env.SHOP_KV.get('products');
            return json({ products: raw ? JSON.parse(raw) : null });
        }
        if (path === '/api/site' && request.method === 'GET') {
            const raw = await env.SHOP_KV.get('site');
            return json({ site: raw ? JSON.parse(raw) : null });
        }
        if (path.startsWith('/api/media/') && request.method === 'GET') {
            const id = path.slice('/api/media/'.length);
            if (!MEDIA_ID.test(id)) return json({ error: 'not_found' }, 404);
            const raw = await env.SHOP_KV.get('media:' + id);
            if (!raw) return json({ error: 'not_found' }, 404);
            const rec = JSON.parse(raw);
            const bin = Uint8Array.from(atob(rec.data), (c) => c.charCodeAt(0));
            return new Response(bin, {
                headers: { 'Content-Type': rec.type, 'Cache-Control': 'public, max-age=31536000, immutable', ...CORS },
            });
        }

        // ---------- لوحة التحكم ----------
        if (path.startsWith('/api/admin/')) {
            if (!env.ADMIN_CODE || !sameCode(request.headers.get('X-Admin-Code'), env.ADMIN_CODE)) {
                await new Promise((r) => setTimeout(r, 500)); // تبطيء المحاولات الغلط
                return json({ error: 'unauthorized' }, 401);
            }
            const body = request.method === 'GET' ? {} : await request.json().catch(() => ({}));

            if (path === '/api/admin/check') return json({ ok: true });

            if (path === '/api/admin/products' && request.method === 'GET') {
                const raw = await env.SHOP_KV.get('products');
                return json({ products: raw ? JSON.parse(raw) : null });
            }
            if (path === '/api/admin/products' && request.method === 'PUT') {
                if (!Array.isArray(body.products) || body.products.length > MAX_PRODUCTS) return json({ error: 'bad_products' }, 400);
                const seen = new Set();
                const products = body.products.map((p) => cleanProduct(p || {}, seen)).filter((p) => p.name);
                await env.SHOP_KV.put('products', JSON.stringify(products));
                return json({ ok: true, count: products.length });
            }
            if (path === '/api/admin/site' && request.method === 'PUT') {
                const s = body.site || {};
                const site = {
                    phone: clean(s.phone, 30),
                    whatsapp: clean(s.whatsapp, 20).replace(/\D/g, ''),
                    address: clean(s.address, 200),
                    hours: clean(s.hours, 120),
                    mapUrl: /^https:\/\//.test(s.mapUrl || '') ? clean(s.mapUrl, 500) : '',
                };
                await env.SHOP_KV.put('site', JSON.stringify(site));
                return json({ ok: true, site });
            }
            if (path === '/api/admin/media' && request.method === 'POST') {
                const type = clean(body.type, 30);
                const data = String(body.data || '');
                if (!/^image\/(jpeg|png|webp)$/.test(type)) return json({ error: 'bad_type' }, 400);
                if (!data || data.length > MAX_MEDIA_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(data)) return json({ error: 'bad_data' }, 400);
                const id = rid('m-', 14);
                await env.SHOP_KV.put('media:' + id, JSON.stringify({ type, data }));
                return json({ ok: true, id });
            }
            if (path === '/api/admin/media/delete' && request.method === 'POST') {
                const ids = (Array.isArray(body.ids) ? body.ids : []).filter((m) => MEDIA_ID.test(m)).slice(0, 50);
                for (const id of ids) await env.SHOP_KV.delete('media:' + id);
                return json({ ok: true, deleted: ids.length });
            }
        }
        return json({ error: 'not_found' }, 404);
    },
};
