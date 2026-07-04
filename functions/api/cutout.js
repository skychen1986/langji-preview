/**
 * Cloudflare Pages Function — remove.bg 代理
 * KEY 存 Cloudflare 环境变量 REMOVEBG_API_KEY，永不泄露到前端
 * 客户 → POST /api/cutout → Cloudflare → remove.bg → 返回抠图
 */
export async function onRequest(context) {
  const { request, env } = context;

  // CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const key = env.REMOVEBG_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: 'Server: API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  let imageBase64;
  try {
    const body = await request.json();
    imageBase64 = body.image;
    if (!imageBase64) throw new Error('Missing image');
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Missing image data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const match = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) throw new Error('Invalid format');

    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const binary = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));

    const form = new FormData();
    form.append('image_file', new Blob([binary]), 'image.' + ext);
    form.append('size', 'auto');

    const result = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': key },
      body: form,
    });

    if (!result.ok) {
      const err = await result.json().catch(() => ({}));
      const msg = err.errors?.[0]?.title || 'remove.bg error ' + result.status;
      return new Response(JSON.stringify({ error: msg }), {
        status: result.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const resultBuffer = await result.arrayBuffer();
    const resultBase64 = 'data:image/png;base64,' + btoa(
      String.fromCharCode(...new Uint8Array(resultBuffer))
    );

    return new Response(JSON.stringify({ image: resultBase64 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
