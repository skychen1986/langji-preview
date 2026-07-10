/**
 * Cloudflare Pages Function — 工厂设置 API v2
 * KV: factory:settings → { logo, factoryName, discount }
 */
export async function onRequest(context) {
  var request = context.request, env = context.env, kv = env.langji_kv;

  if (request.method === 'OPTIONS') return corsResponse();

  try {
    // GET 公开，POST 需鉴权
    if (request.method === 'GET') return await getSettings(kv);
    if (request.method === 'POST') {
      checkAuth(request, env);
      return await saveSettings(kv, request);
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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

function checkAuth(request, env) {
  var secret = env.API_SECRET;
  if (!secret) throw new Error('UNAUTHORIZED');
  var auth = request.headers.get('Authorization') || '';
  if (auth !== 'Bearer ' + secret) throw new Error('UNAUTHORIZED');
}

function defaultSettings() {
  return { logo: '', factoryName: '', discount: 10 }; // 10 = 原价
}

// ===== 业务逻辑 =====

async function getSettings(kv) {
  var raw = await kv.get('factory:settings');
  if (!raw) return jsonOk(defaultSettings());
  try {
    var s = JSON.parse(raw);
    // 迁移旧默认值 discount:1 → 10
    if (s.discount === 1 && s.logo === '' && s.factoryName === '') s.discount = 10;
    return jsonOk(s);
  } catch (e) {
    return jsonOk(defaultSettings());
  }
}

async function saveSettings(kv, request) {
  var body;
  try { body = await request.json(); } catch (e) { return jsonErr('Invalid JSON', 400); }

  // 读取现有设置
  var raw = await kv.get('factory:settings');
  var s = raw ? (function() { try { return JSON.parse(raw); } catch(e) { return defaultSettings(); } })() : defaultSettings();

  if (body.logo !== undefined) {
    if (typeof body.logo !== 'string' || body.logo.length > 300000) {
      return jsonErr('Logo too large (max ~200KB)', 400);
    }
    s.logo = body.logo;
  }
  if (body.factoryName !== undefined) {
    if (body.factoryName.length > 100) return jsonErr('Factory name too long', 400);
    s.factoryName = body.factoryName.trim();
  }
  if (body.discount !== undefined) {
    var d = Number(body.discount);
    if (isNaN(d) || d < 1 || d > 10) return jsonErr('Discount must be 1-10', 400);
    s.discount = d;
  }

  await kv.put('factory:settings', JSON.stringify(s));
  return jsonOk(s);
}
