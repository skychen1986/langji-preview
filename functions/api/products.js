/**
 * Cloudflare Pages Function — 产品 CRUD API
 * KV: products → JSON[{id,name,cutout,time}] | img:{id} → base64
 */
export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.langji_kv;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  function json(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const all = url.searchParams.get('all');

  try {
    switch (request.method) {
      case 'GET': return all ? await listAllWithImages(kv) : (id ? await getOne(kv, id) : await listAll(kv));
      case 'POST': return await add(kv, request);
      case 'DELETE': return id ? await del(kv, id) : json({ error: 'Missing id' }, 400);
      default: return json({ error: 'Method not allowed' }, 405);
    }
  } catch (e) {
    return json({ error: e.message || 'Unknown error' }, 500);
  }
}

// GET /api/products?all=1 → 全部产品含图片（一次请求）
async function listAllWithImages(kv) {
  const raw = await kv.get('products');
  const list = raw ? JSON.parse(raw) : [];
  const items = [];
  for (const p of list) {
    const img = await kv.get('img:' + p.id);
    items.push({ id: p.id, name: p.name, cutout: p.cutout, time: p.time, image: img || '' });
  }
  return new Response(JSON.stringify(items), {
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  });
}

// GET /api/products → 列表（不含图片，体积小）
async function listAll(kv) {
  const raw = await kv.get('products');
  const list = raw ? JSON.parse(raw) : [];
  return new Response(JSON.stringify(list.map(p => ({ id: p.id, name: p.name, cutout: p.cutout, time: p.time }))), {
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  });
}

// GET /api/products?id=xxx → 单个产品含图片
async function getOne(kv, id) {
  const raw = await kv.get('products'), list = raw ? JSON.parse(raw) : [];
  const p = list.find(x => x.id === id);
  if (!p) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  p.image = await kv.get('img:' + id) || '';
  return new Response(JSON.stringify(p), { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
}

// POST /api/products → 新增
async function add(kv, request) {
  let body;
  try { body = await request.json(); } catch (e) { body = {}; }
  const { name, cutout, image } = body;
  if (!name || !image) return new Response(JSON.stringify({ error: 'Missing name or image' }), { status: 400, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });

  const id = 'prod-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const raw = await kv.get('products'), list = raw ? JSON.parse(raw) : [];
  list.push({ id, name, cutout: !!cutout, time: Date.now() });
  await kv.put('products', JSON.stringify(list));
  await kv.put('img:' + id, image);
  return new Response(JSON.stringify({ id, ok: true }), { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
}

// DELETE /api/products?id=xxx
async function del(kv, id) {
  const raw = await kv.get('products'), list = raw ? JSON.parse(raw) : [];
  const filtered = list.filter(p => p.id !== id);
  if (filtered.length === list.length) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  await kv.put('products', JSON.stringify(filtered));
  await kv.delete('img:' + id);
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
}
