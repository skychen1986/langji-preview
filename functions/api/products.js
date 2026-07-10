/**
 * Cloudflare Pages Function — 产品 CRUD API v3
 * KV: products → JSON[{id,name,image,category,price,dragCount,cutout,time,updatedAt}] | img:{id} → base64
 */
export async function onRequest(context) {
  var request = context.request, env = context.env, kv = env.langji_kv;
  var url = new URL(request.url);
  var id = url.searchParams.get('id');
  var all = url.searchParams.get('all');

  if (request.method === 'OPTIONS') return corsResponse();

  try {
    // GET 读操作公开
    if (request.method === 'GET') {
      return all ? await listAllWithImages(kv) : (id ? await getOne(kv, id) : await listAll(kv));
    }

    // 写操作全部鉴权
    checkAuth(request, env);

    // DELETE 从 URL query 取 id
    if (request.method === 'DELETE') {
      return id ? await del(kv, id) : jsonErr('Missing id', 400);
    }

    // POST / PATCH：先解析 body
    var body;
    try { body = await request.json(); } catch (e) { body = {}; }

    // POST 请求可能是 incrementDrag 或 add
    if (request.method === 'POST') {
      if (body.action === 'incrementDrag' && body.id) {
        return await incrementDrag(kv, body.id);
      }
      return await add(kv, body);
    }

    // PATCH
    if (request.method === 'PATCH') {
      return await update(kv, body);
    }

    return jsonErr('Method not allowed', 405);
  } catch (e) {
    if (e.message === 'UNAUTHORIZED') return jsonErr('Unauthorized', 401);
    return jsonErr(e.message || 'Unknown error', 500);
  }
}

// ===== 工具函数（模块级）=====

var CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function corsResponse() {
  return new Response(null, { headers: CORS });
}

function jsonOk(data, status) {
  status = status || 200;
  var h = Object.assign({}, CORS, { 'Content-Type': 'application/json' });
  return new Response(JSON.stringify(data), { status: status, headers: h });
}

function jsonErr(msg, status) {
  return jsonOk({ error: msg }, status);
}

// 鉴权：请求头必须带 Authorization: Bearer <API_SECRET>
function checkAuth(request, env) {
  var secret = env.API_SECRET;
  if (!secret) throw new Error('UNAUTHORIZED'); // 未配置 Secret 则拒绝所有写操作
  var auth = request.headers.get('Authorization') || '';
  if (auth !== 'Bearer ' + secret) throw new Error('UNAUTHORIZED');
}

// 输入校验
function validateProduct(body) {
  var errors = [];
  if (!body.name || typeof body.name !== 'string') errors.push('name required');
  if (body.name && body.name.length > 100) errors.push('name too long (max 100)');
  if (body.category && body.category.length > 50) errors.push('category too long (max 50)');
  if (body.price !== undefined && body.price !== null) {
    var p = Number(body.price);
    if (isNaN(p) || p < 0 || p > 99999999) errors.push('price must be 0-99999999');
  }
  if (!body.image && body.method !== 'PATCH') errors.push('image required');
  return errors;
}

// ===== 数据操作 =====

function normalize(p) {
  return {
    id: p.id,
    name: p.name || '',
    cutout: !!p.cutout,
    time: p.time || 0,
    category: p.category || '',
    price: typeof p.price === 'number' ? p.price : 0,
    dragCount: typeof p.dragCount === 'number' ? p.dragCount : 0,
    updatedAt: p.updatedAt || p.time || 0,
  };
}

async function readList(kv) {
  var raw = await kv.get('products');
  if (!raw) return [];
  try { return JSON.parse(raw).map(normalize); } catch (e) { return []; }
}

async function writeList(kv, list) {
  return kv.put('products', JSON.stringify(list));
}

async function listAllWithImages(kv) {
  var list = await readList(kv);
  var items = [];
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    var img = await kv.get('img:' + p.id);
    items.push(Object.assign({}, p, { image: img || '' }));
  }
  return jsonOk(items);
}

async function listAll(kv) {
  var list = await readList(kv);
  var items = list.map(function(p) {
    return { id: p.id, name: p.name, cutout: p.cutout, time: p.time, category: p.category, price: p.price, dragCount: p.dragCount, updatedAt: p.updatedAt };
  });
  return jsonOk(items);
}

async function getOne(kv, id) {
  var list = await readList(kv);
  var p = list.find(function(x) { return x.id === id; });
  if (!p) return jsonErr('Not found', 404);
  p.image = (await kv.get('img:' + id)) || '';
  return jsonOk(p);
}

async function add(kv, body) {
  var errs = validateProduct(body);
  if (errs.length) return jsonErr(errs.join('; '), 400);

  // 限制 base64 图片大小：约 2MB 原始图片
  var image = body.image;
  if (typeof image !== 'string' || image.length > 3000000) {
    return jsonErr('Image too large (max ~2MB)', 400);
  }

  // 存原文，前端渲染时转义
  var name = body.name.trim();
  var category = (body.category || '').trim();
  var price = body.price !== undefined && body.price !== null ? Number(body.price) : 0;
  if (price < 0 || price > 99999999) price = 0;

  var id = 'prod-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  var now = Date.now();
  var p = {
    id: id, name: name, cutout: !!body.cutout, time: now,
    category: category, price: price, dragCount: 0, updatedAt: now,
  };
  var list = await readList(kv);
  list.push(p);
  await writeList(kv, list);
  await kv.put('img:' + id, image);
  return jsonOk({ id: id, ok: true });
}

async function update(kv, body) {
  var id = body.id;
  if (!id) return jsonErr('Missing id', 400);

  // 校验
  if (body.name !== undefined && (!body.name || body.name.length > 100)) return jsonErr('Invalid name', 400);
  if (body.category !== undefined && body.category.length > 50) return jsonErr('Category too long', 400);
  if (body.price !== undefined) {
    var pr = Number(body.price);
    if (isNaN(pr) || pr < 0 || pr > 99999999) return jsonErr('Invalid price', 400);
  }

  var list = await readList(kv);
  var idx = -1;
  for (var i = 0; i < list.length; i++) { if (list[i].id === id) { idx = i; break; } }
  if (idx === -1) return jsonErr('Not found', 404);

  var p = list[idx];
  if (body.name !== undefined) p.name = body.name.trim();
  if (body.category !== undefined) p.category = (body.category || '').trim();
  if (body.price !== undefined) p.price = Number(body.price);
  p.updatedAt = Date.now();

  list[idx] = p;
  await writeList(kv, list);
  return jsonOk({ ok: true, product: normalize(p) });
}

async function del(kv, id) {
  var list = await readList(kv);
  var filtered = list.filter(function(p) { return p.id !== id; });
  if (filtered.length === list.length) return jsonErr('Not found', 404);
  await writeList(kv, filtered);
  await kv.delete('img:' + id);
  return jsonOk({ ok: true });
}

// 拖拽统计：POST /api/products（body: { action: "incrementDrag", id: "xxx" }）
async function incrementDrag(kv, id) {
  var list = await readList(kv);
  var p = list.find(function(x) { return x.id === id; });
  if (!p) return jsonErr('Not found', 404);
  p.dragCount = (p.dragCount || 0) + 1;
  p.updatedAt = Date.now();
  await writeList(kv, list);
  return jsonOk({ ok: true, productId: id, dragCount: p.dragCount });
}
