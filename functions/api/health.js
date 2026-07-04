export async function onRequest(context) {
  var env = context.env;
  var result = {
    hasLangjiKv: !!env.langji_kv,
    envKeys: Object.keys(env),
  };
  if (env.langji_kv) {
    try {
      var raw = await env.langji_kv.get('products');
      result.kvReadOk = true;
      result.productCount = raw ? JSON.parse(raw).length : 0;
    } catch(e) {
      result.kvReadOk = false;
      result.kvError = e.message;
    }
  }
  return new Response(JSON.stringify(result, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
