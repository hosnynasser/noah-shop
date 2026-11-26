// نوح — الـAPI بتاع الموقع ولوحة التحكم (Cloudflare Worker + KV، مجاني)
// الـBindings: SHOP_KV (مخزن KV)، والسر ADMIN_CODE (كود دخول لوحة التحكم)
//
// عام (من غير كود):
//   GET  /api/products        -> {products:[...]|null}   (null = لسه محدش حفظ منتجات)
//   GET  /api/site            -> {site:{phone,whatsapp,address,hours,mapUrl}|null}
//   GET  /api/media/<id>      -> صورة المنتج
// الدخول: حسابات مديرين (يوزر + باسورد متخزن مشفّر PBKDF2 في KV، مفيش باسورد نصّي)
//   POST /api/login {username,password} -> {token,username}   (التوكن صالح 30 يوم)
// لوحة التحكم (لازم هيدر Authorization: Bearer <token>):
//   POST /api/admin/check
//   GET/PUT /api/admin/products ، PUT /api/admin/site ، POST /api/admin/media ، POST /api/admin/media/delete
//   GET    /api/admin/admins            قايمة المديرين
//   POST   /api/admin/admins {username,password}
//   PUT    /api/admin/admins/<id> {username?,password?}
//   DELETE /api/admin/admins/<id>       (مينفعش تمسح آخر مدير)
// أول تشغيل: لو مفيش مديرين والسر ADMIN_CODE موجود، الدخول بيوزر admin وباسورد = ADMIN_CODE بيعمل أول حساب.
// بعدها امسح السر: npx wrangler secret delete ADMIN_CODE

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
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
    if (p.priceMode === 'show' || p.priceMode === 'hide') out.priceMode = p.priceMode;
    return out;
}


// ---------- إخفاء الأسعار عن الزباين ----------
// السعر بيتخفي لو المنتج "إخفاء دائمًا"، أو لو "يتبع الإعداد العام" والإعداد العام مقفول. الأسعار المحفوظة ما بتتغيرش وبتظهر في الإدارة.
const priceHidden = (p, site) => p.priceMode === 'hide' || (p.priceMode !== 'show' && !!site && site.showPrices === false);
function publicProduct(p, site) {
    const { priceMode, ...rest } = p;
    if (!priceHidden(p, site)) return rest;
    const { price, old, ...noPrice } = rest;
    return { ...noPrice, ph: true };
}

// ---------- حسابات المديرين ----------
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (h) => Uint8Array.from(h.match(/../g) || [], (x) => parseInt(x, 16));
const ITER = 100000; // أقصى رقم بيسمح بيه Workers
async function hashPw(pw, saltHex) {
    const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(saltHex), iterations: ITER }, key, 256));
}
async function makeUser(username, pw) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    return { id: rid('u-', 8), username, salt, hash: await hashPw(pw, salt), sv: 1 };
}
async function loadAdmins(env) {
    const raw = await env.SHOP_KV.get('admins');
    return raw ? JSON.parse(raw) : [];
}
const saveAdmins = (env, list) => env.SHOP_KV.put('admins', JSON.stringify(list));
const publicUser = (u) => ({ id: u.id, username: u.username });
const USERNAME = /^[A-Za-z0-9_.@-]{3,30}$/;
async function sha256(t) { return hex(await crypto.subtle.digest('SHA-256', enc.encode(t))); }
async function newSession(env, u) {
    const token = hex(crypto.getRandomValues(new Uint8Array(32)));
    await env.SHOP_KV.put('sess:' + (await sha256(token)), JSON.stringify({ uid: u.id, sv: u.sv }), { expirationTtl: 30 * 86400 });
    return token;
}
async function authUser(request, env) {
    const m = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('Authorization') || '');
    if (!m) return null;
    const raw = await env.SHOP_KV.get('sess:' + (await sha256(m[1])));
    if (!raw) return null;
    const s = JSON.parse(raw);
    const u = (await loadAdmins(env)).find((x) => x.id === s.uid);
    return u && u.sv === s.sv ? u : null; // الحساب اتمسح أو الباسورد اتغيّر = الجلسة بتتلغي
}
function checkPw(pw) {
    return typeof pw === 'string' && pw.length >= 6 && pw.length <= 100;
}

function sameCode(a, b) {
    a = String(a || ''); b = String(b || '');
    let d = a.length ^ b.length;
    for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    return d === 0;
}

export default {
    async fetch(request, env) {
        try {
            return await handle(request, env);
        } catch (e) {
            const m = String((e && e.message) || e);
            if (/free usage limit|limit for this operation|10048|429/i.test(m)) return json({ error: 'حد الحفظ اليومي المجاني خلص. الحفظ هيشتغل تاني بعد 2 الفجر بتوقيت القاهرة.' }, 503);
            return json({ error: 'مشكلة مؤقتة في السيرفر. جرب تاني بعد شوية.' }, 500);
        }
    },
};

const handle = (request, env) => handler.fetch(request, env);
const handler = {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
        const url = new URL(request.url);
        const path = url.pathname.replace(/\/+$/, '');

        // ---------- عام ----------
        if (path === '/api/products' && request.method === 'GET') {
            const [raw, sraw] = await Promise.all([env.SHOP_KV.get('products'), env.SHOP_KV.get('site')]);
            const site = sraw ? JSON.parse(sraw) : null;
            return json({ products: raw ? JSON.parse(raw).map((p) => publicProduct(p, site)) : null });
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

        // ---------- طلبات الزباين (عام) ----------
        if (path === '/api/orders' && request.method === 'POST') {
            if (!env.ORDERS_DB) return json({ error: 'الطلبات مش متاحة دلوقتي. كلمنا واتساب.' }, 503);
            const b = await request.json().catch(() => null);
            if (!b || typeof b !== 'object') return json({ error: 'بيانات الطلب مش صحيحة' }, 400);
            if (b.website) return json({ ok: true, id: 'NH-0000' }); // خانة مخفية للروبوتات
            const name = clean(b.name, 80), phone = clean(b.phone, 30).replace(/[^\d+]/g, ''), address = clean(b.address, 300), notes = clean(b.notes, 300);
            if (name.length < 2) return json({ error: 'اكتب اسمك' }, 400);
            if (phone.replace(/\D/g, '').length < 8) return json({ error: 'اكتب رقم تليفون صحيح' }, 400);
            if (address.length < 5) return json({ error: 'اكتب العنوان' }, 400);
            const rawItems = Array.isArray(b.items) ? b.items.slice(0, 40) : [];
            if (!rawItems.length) return json({ error: 'السلة فاضية' }, 400);
            const [praw, sraw0] = await Promise.all([env.SHOP_KV.get('products'), env.SHOP_KV.get('site')]);
            const site0 = sraw0 ? JSON.parse(sraw0) : null;
            const catalog = praw ? JSON.parse(praw) : [];
            const byId = new Map(catalog.map((p) => [p.id, p]));
            const merged = new Map();
            for (const it of rawItems) {
                const id = clean(it && it.id, 40);
                const qty = Math.max(1, Math.min(99, parseInt(it && it.qty, 10) || 1));
                merged.set(id, Math.min(99, (merged.get(id) || 0) + qty));
            }
            const lines = [];
            for (const [id, qty] of merged) {
                const p = byId.get(id);
                if (!p) return json({ error: 'منتج في السلة مبقاش موجود. حدّث الصفحة.', code: 'unknown_product', id }, 400);
                if (priceHidden(p, site0)) return json({ error: 'سعر المنتج ده مش معروض. اسأل عنه على واتساب: ' + p.name, code: 'price_hidden', id }, 400);
                if (p.sample) return json({ error: 'المنتج ده تجريبي ومش متاح للطلب: ' + p.name, code: 'sample' }, 400);
                if (p.stock === false) return json({ error: 'منتج في السلة نفد: ' + p.name, code: 'out_of_stock', id }, 400);
                lines.push({ id, name: p.name, price: p.price, qty, lineTotal: Math.round(p.price * qty * 100) / 100 });
            }
            const total = Math.round(lines.reduce((a, l) => a + l.lineTotal, 0) * 100) / 100;
            const since = Date.now() - 3600_000;
            const recent = await env.ORDERS_DB.prepare('SELECT COUNT(*) AS n FROM orders WHERE phone = ? AND ts > ?').bind(phone, since).first();
            if ((recent && recent.n) >= 5) return json({ error: 'طلبات كتير في وقت قصير. كلمنا واتساب.' }, 429);
            const id = 'NH-' + Date.now().toString(36).toUpperCase().slice(-5) + rid('', 3).toUpperCase();
            await env.ORDERS_DB.prepare('INSERT INTO orders (id, ts, name, phone, address, notes, items, total, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
                .bind(id, Date.now(), name, phone, address, notes, JSON.stringify(lines), total, 'new').run();
            return json({ ok: true, id, total });
        }

        // ---------- تسجيل الدخول ----------
        if (path === '/api/login' && request.method === 'POST') {
            const b = await request.json().catch(() => ({}));
            const username = clean(b.username, 30).toLowerCase();
            const pw = String(b.password || '').slice(0, 100);
            let list = await loadAdmins(env);
            let user = null;
            if (!list.length && env.ADMIN_CODE && username === 'admin' && sameCode(pw, env.ADMIN_CODE)) {
                user = await makeUser('admin', pw); // أول حساب
                await saveAdmins(env, [user]);
            } else {
                const u = list.find((x) => x.username.toLowerCase() === username);
                if (u && sameCode(await hashPw(pw, u.salt), u.hash)) user = u;
                else await hashPw(pw, '00'.repeat(16)); // نفس الزمن لو اليوزر مش موجود
            }
            if (!user) {
                await new Promise((r) => setTimeout(r, 700)); // تبطيء المحاولات الغلط
                return json({ error: 'unauthorized' }, 401);
            }
            return json({ token: await newSession(env, user), username: user.username });
        }

        // ---------- لوحة التحكم ----------
        if (path.startsWith('/api/admin/')) {
            const me = await authUser(request, env);
            if (!me) {
                await new Promise((r) => setTimeout(r, 300));
                return json({ error: 'unauthorized' }, 401);
            }
            const body = request.method === 'GET' ? {} : await request.json().catch(() => ({}));

            if (path === '/api/admin/check') return json({ ok: true, me: publicUser(me) });

            // ----- المديرين -----
            if (path === '/api/admin/admins' && request.method === 'GET') {
                return json({ admins: (await loadAdmins(env)).map(publicUser), me: me.id });
            }
            if (path === '/api/admin/admins' && request.method === 'POST') {
                const username = clean(body.username, 30);
                if (!USERNAME.test(username)) return json({ error: 'اسم المستخدم 3 لـ 30 حرف إنجليزي أو أرقام (و _ . - @)' }, 400);
                if (!checkPw(body.password)) return json({ error: 'الباسورد لازم 6 حروف على الأقل' }, 400);
                const list = await loadAdmins(env);
                if (list.length >= 20) return json({ error: 'وصلت للحد الأقصى (20 مدير)' }, 400);
                if (list.some((x) => x.username.toLowerCase() === username.toLowerCase())) return json({ error: 'اسم المستخدم ده موجود' }, 409);
                const u = await makeUser(username, body.password);
                list.push(u);
                await saveAdmins(env, list);
                return json({ ok: true, admin: publicUser(u) });
            }
            const am = /^\/api\/admin\/admins\/(u-[a-z0-9]{4,20})$/.exec(path);
            if (am && request.method === 'PUT') {
                const list = await loadAdmins(env);
                const u = list.find((x) => x.id === am[1]);
                if (!u) return json({ error: 'المدير مش موجود' }, 404);
                if (body.username !== undefined) {
                    const username = clean(body.username, 30);
                    if (!USERNAME.test(username)) return json({ error: 'اسم المستخدم 3 لـ 30 حرف إنجليزي أو أرقام (و _ . - @)' }, 400);
                    if (list.some((x) => x.id !== u.id && x.username.toLowerCase() === username.toLowerCase())) return json({ error: 'اسم المستخدم ده موجود' }, 409);
                    u.username = username;
                }
                if (body.password !== undefined && body.password !== '') {
                    if (!checkPw(body.password)) return json({ error: 'الباسورد لازم 6 حروف على الأقل' }, 400);
                    u.salt = hex(crypto.getRandomValues(new Uint8Array(16)));
                    u.hash = await hashPw(body.password, u.salt);
                    u.sv = (u.sv || 1) + 1; // بيطرد الجلسات القديمة للحساب ده
                }
                await saveAdmins(env, list);
                // اللي غيّر باسوره بنفسه يفضل داخل بجلسة جديدة
                const out = { ok: true, admin: publicUser(u) };
                if (u.id === me.id && body.password) out.token = await newSession(env, u);
                return json(out);
            }
            if (am && request.method === 'DELETE') {
                const list = await loadAdmins(env);
                if (!list.some((x) => x.id === am[1])) return json({ error: 'المدير مش موجود' }, 404);
                if (list.length <= 1) return json({ error: 'مينفعش تمسح آخر مدير' }, 400);
                await saveAdmins(env, list.filter((x) => x.id !== am[1]));
                return json({ ok: true });
            }

            // ----- الطلبات -----
            if (path === '/api/admin/orders' && request.method === 'GET') {
                if (!env.ORDERS_DB) return json({ orders: [], disabled: true });
                const { results } = await env.ORDERS_DB.prepare('SELECT id, ts, name, phone, address, notes, items, total, status FROM orders ORDER BY ts DESC LIMIT 300').all();
                return json({ orders: (results || []).map((o) => ({ ...o, items: (() => { try { return JSON.parse(o.items); } catch { return []; } })() })) });
            }
            if (path === '/api/admin/orders/status' && request.method === 'POST') {
                if (!env.ORDERS_DB) return json({ error: 'الطلبات مش متاحة' }, 503);
                const id = clean(body.id, 30), status = clean(body.status, 20);
                if (!['new', 'preparing', 'done', 'cancelled'].includes(status)) return json({ error: 'حالة غير صحيحة' }, 400);
                const r = await env.ORDERS_DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, id).run();
                if (!(r.meta && r.meta.changes)) return json({ error: 'الطلب مش موجود' }, 404);
                return json({ ok: true });
            }

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
                let prevSite = null;
                try { const pr = await env.SHOP_KV.get('site'); prevSite = pr ? JSON.parse(pr) : null; } catch {}
                const site = {
                    phone: clean(s.phone, 30),
                    whatsapp: clean(s.whatsapp, 20).replace(/\D/g, ''),
                    address: clean(s.address, 200),
                    hours: clean(s.hours, 120),
                    mapUrl: /^https:\/\//.test(s.mapUrl || '') ? clean(s.mapUrl, 500) : '',
                    showPrices: typeof s.showPrices === 'boolean' ? s.showPrices : (prevSite ? prevSite.showPrices !== false : true),
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
