/**
 * Cloudflare Pages Function — remove.bg 代理
 * KEY 存 Cloudflare 环境变量 REMOVEBG_API_KEY，永不泄露到前端
 */
export async function onRequest(context) {
  const { request, env } = context;

  // CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Key check
  const key = env.REMOVEBG_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: 'KEY_NOT_CONFIGURED', detail: 'REMOVEBG_API_KEY not set' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Parse body
  let imageBase64;
  try {
    const body = await request.json();
    imageBase64 = body.image;
  } catch (e) {
    return new Response(JSON.stringify({ error: 'BAD_JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!imageBase64) {
    return new Response(JSON.stringify({ error: 'MISSING_IMAGE' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Decode base64
    const match = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) throw new Error('Invalid base64 format');
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const binary = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));

    // Call remove.bg
    const form = new FormData();
    form.append('image_file', new File([binary.buffer], 'image.' + ext, { type: 'image/' + ext }));
    form.append('size', 'auto');

    const result = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': key },
      body: form,
    });

    if (!result.ok) {
      const err = await result.json().catch(() => ({}));
      const msg = err.errors?.[0]?.title || ('remove.bg HTTP ' + result.status);
      return new Response(JSON.stringify({ error: msg }), {
        status: result.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Encode result as base64
    const buf = new Uint8Array(await result.arrayBuffer());
    const chunks = [];
    for (let i = 0; i < buf.length; i += 8192) {
      chunks.push(String.fromCharCode(...buf.slice(i, i + 8192)));
    }
    const resultBase64 = 'data:image/png;base64,' + btoa(chunks.join(''));

    return new Response(JSON.stringify({ image: resultBase64 }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
