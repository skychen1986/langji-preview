// js/cutout.js
// 抠图策略：Vercel代理 → remove.bg → 阿里云 → 离线Canvas
// API Key 永不泄露到前端

const Cutout = (function() {

  // ===== 策略0：Cloudflare 云函数代理（优先，Key 在服务器端）=====
  async function tryProxy(imageBlob) {
    var base64 = await blobToBase64(imageBlob);
    var resp;
    try {
      resp = await fetch('/api/cutout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });
    } catch(netErr) {
      throw new Error('PROXY_NET_' + (netErr.message || 'fetch failed'));
    }
    var data;
    try { data = await resp.json(); } catch(e) { throw new Error('PROXY_JSON_' + resp.status); }
    if (!resp.ok) {
      var msg = data.error || ('HTTP ' + resp.status);
      if (msg.indexOf('quota') >= 0 || msg.indexOf('insufficient') >= 0) throw new Error('QUOTA');
      throw new Error('PROXY_' + msg.substring(0, 60));
    }
    if (!data.image) throw new Error('PROXY_EMPTY');
    var b64 = data.image;
    var parts = b64.split(',');
    var mime = parts[0].match(/:(.*?);/)[1];
    var bytes = atob(parts[1]);
    var arr = new Uint8Array(bytes.length);
    for (var i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  // ===== 策略1：remove.bg API（客户端直连，需 localStorage 有 Key）=====
  async function tryRemoveBg(imageBlob) {
    const key = window.REMOVEBG_API_KEY;
    if (!key) throw new Error('NO_KEY');
    const fd = new FormData();
    fd.append('image_file', imageBlob);
    fd.append('size', 'auto');
    const resp = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST', headers: { 'X-Api-Key': key }, body: fd,
    });
    if (!resp.ok) {
      const err = await resp.json().catch(()=>({}));
      const msg = err.errors?.[0]?.title || '';
      if (msg.includes('quota')) throw new Error('QUOTA');
      throw new Error('API_' + resp.status);
    }
    return resp.blob();
  }

  // ===== 策略2：阿里云视觉智能 =====
  async function tryAliVision(imageBlob) {
    const akId = window.ALI_AK_ID;
    const akSec = window.ALI_AK_SECRET;
    if (!akId || !akSec) throw new Error('NO_KEY');
    const base64 = await blobToBase64(imageBlob);
    const body = JSON.stringify({ ImageURL: base64 });
    const resp = await fetch('https://imageseg.cn-shanghai.aliyuncs.com/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'APPCODE ' + akId },
      body,
    });
    if (!resp.ok) throw new Error('ALI_' + resp.status);
    const result = await resp.json();
    if (result.Data && result.Data.ImageURL) {
      const imgResp = await fetch(result.Data.ImageURL);
      return imgResp.blob();
    }
    throw new Error('ALI_EMPTY');
  }

  // ===== 策略3：离线 Canvas 边缘采样 =====
  async function tryLocal(imageBlob) {
    const img = await blobToImg(imageBlob);
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const w = canvas.width, h = canvas.height;
    const ew = Math.max(3, Math.floor(Math.min(w, h) * 0.05));
    const samples = [];
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < ew; y++) { const i = (y*w+x)*4; samples.push({r:data[i],g:data[i+1],b:data[i+2]}); }
      for (let y = h-ew; y < h; y++) { const i = (y*w+x)*4; samples.push({r:data[i],g:data[i+1],b:data[i+2]}); }
    }
    for (let y = ew; y < h-ew; y++) {
      for (let x = 0; x < ew; x++) { const i = (y*w+x)*4; samples.push({r:data[i],g:data[i+1],b:data[i+2]}); }
      for (let x = w-ew; x < w; x++) { const i = (y*w+x)*4; samples.push({r:data[i],g:data[i+1],b:data[i+2]}); }
    }
    if (samples.length < 100) return imageBlob;
    const avgR = samples.reduce((s,v)=>s+v.r,0)/samples.length;
    const avgG = samples.reduce((s,v)=>s+v.g,0)/samples.length;
    const avgB = samples.reduce((s,v)=>s+v.b,0)/samples.length;
    const threshold = 55;
    let removed = 0;
    for (let i = 0; i < data.length; i += 4) {
      const dr = data[i]-avgR, dg = data[i+1]-avgG, db = data[i+2]-avgB;
      const dist = Math.sqrt(dr*dr+dg*dg+db*db);
      if (dist < threshold) { data[i+3] = 0; removed++; }
      else if (dist < threshold+25) { data[i+3] = Math.round(data[i+3]*((dist-threshold)/25)); }
    }
    if (removed > w*h*0.6) return imageBlob;
    ctx.putImageData(imageData, 0, 0);
    return new Promise(r => canvas.toBlob(r, 'image/png'));
  }

  // ===== 统一入口 =====
  async function processFile(file, onStatus) {
    const strategies = [
      { fn: tryProxy, name: 'api_proxy' },        // 优先 Vercel 代理
      { fn: tryRemoveBg, name: 'api_removebg' },  // 降级：客户端直连
      { fn: tryAliVision, name: 'api_ali' },
      { fn: tryLocal, name: 'local' },
    ];

    for (const s of strategies) {
      try {
        const result = await s.fn(file);
        if (result === file) continue;
        onStatus && onStatus(s.name);
        return result;
      } catch (e) {
        const msg = e.message || '';
        if (msg === 'QUOTA') onStatus && onStatus('quota');
        if (msg === 'NO_KEY') {} // 静默跳过
        console.log('抠图策略 ' + s.name + ' 失败:', msg);
        continue;
      }
    }

    onStatus && onStatus('fallback');
    return file;
  }

  function blobToImg(blob) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  return { processFile };
})();
