// js/cutout.js
// 抠图三级策略：remove.bg → 阿里云视觉智能 → 离线Canvas
// API Key 在 free.html 中设置

const Cutout = (function() {

  // ===== 策略1：remove.bg API（国际，AI抠图最准）=====
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

  // ===== 策略2：阿里云视觉智能（国内，¥0.01/张）=====
  // AK/SK 在阿里云控制台获取：ram.console.aliyun.com
  async function tryAliVision(imageBlob) {
    const akId = window.ALI_AK_ID;
    const akSec = window.ALI_AK_SECRET;
    if (!akId || !akSec) throw new Error('NO_KEY');

    // 把图片转 base64
    const base64 = await blobToBase64(imageBlob);

    // 阿里云视觉智能 API：通用分割
    // 需要 HMAC-SHA1 签名，用简化方式调用
    const body = JSON.stringify({ ImageURL: base64 });
    // 使用阿里云 OpenAPI 通用端点
    const resp = await fetch('https://imageseg.cn-shanghai.aliyuncs.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'APPCODE ' + akId, // 简化为 APPCODE 模式（需在阿里云市场购买 API）
      },
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
      { fn: tryRemoveBg, name: 'api_removebg' },
      { fn: tryAliVision, name: 'api_ali' },
      { fn: tryLocal, name: 'local' },
    ];

    for (const s of strategies) {
      try {
        const result = await s.fn(file);
        if (result === file) continue; // 返回原图=没处理，试下一个
        onStatus && onStatus(s.name);
        return result;
      } catch (e) {
        const msg = e.message || '';
        if (msg === 'QUOTA') onStatus && onStatus('quota');
        console.log('抠图策略 ' + s.name + ' 失败:', msg);
        continue;
      }
    }

    // 全部失败，返回原图
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
