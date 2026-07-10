/**
 * Cloudflare Pages Function — 登录鉴权
 * POST { password } → { token }（token = API_SECRET，24h 有效）
 */
export async function onRequest(context) {
  var request = context.request, env = context.env;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
    });
  }

  if (request.method !== 'POST') {
    return jsonErr('Method not allowed', 405);
  }

  try {
    var body = await request.json();
    var password = body.password || '';

    // 验证密码
    var expectedPassword = env.ADMIN_PASSWORD || '12345';
    if (password !== expectedPassword) {
      return jsonErr('Invalid password', 401);
    }

    // 返回 API_SECRET 作为 Bearer token
    var token = env.API_SECRET;
    if (!token) return jsonErr('Server not configured: API_SECRET missing', 500);

    return new Response(JSON.stringify({ token: token, ok: true }), {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return jsonErr('Invalid request', 400);
  }
}

function jsonErr(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status: status,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  });
}
