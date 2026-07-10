/**
 * Cloudflare Pages Function — 健康检查（仅供内部诊断，不暴露敏感信息）
 */
export async function onRequest(context) {
  var env = context.env;
  var result = {
    status: 'ok',
    hasKV: !!env.langji_kv,
    productCount: 0,
  };
  if (env.langji_kv) {
    try {
      var raw = await env.langji_kv.get('products');
      result.productCount = raw ? JSON.parse(raw).length : 0;
    } catch(e) {
      result.hasKV = false;
    }
  }
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
