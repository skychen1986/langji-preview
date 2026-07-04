// js/scene.js
// 场景引擎：产品拖动/缩放/旋转/截图 · 从 MVP 抽离

const SceneEngine = (function() {
  let cfg, sceneArea, sceneWrapper, sceneHint, productCountEl,
      sceneChipsEl, productChipsEl, sceneUploadEl;
  let currentScene, selectedId = null, instances = [], counter = 0;
  let dragInfo = null, pinchD0 = null, pinchA0 = null;

  function init(config) {
    cfg = config;
    sceneArea = document.getElementById(cfg.sceneAreaId);
    sceneWrapper = document.getElementById(cfg.sceneWrapperId);
    sceneHint = document.getElementById(cfg.sceneHintId);
    productCountEl = document.getElementById(cfg.productCountId);
    sceneChipsEl = document.getElementById(cfg.sceneChipsId);
    productChipsEl = document.getElementById(cfg.productChipsId);
    sceneUploadEl = document.getElementById(cfg.sceneUploadId);
    renderScenes();
    renderProducts();
    switchScene(cfg.defaultScene);
    bind();
  }

  function renderScenes() {
    let h = '<span class="chip-label">场景</span>';
    cfg.scenes.forEach(s => {
      h += `<div class="chip${currentScene===s.id?' active':''}" onclick="SceneEngine.switchScene('${s.id}')">${s.icon} ${s.name}</div>`;
    });
    h += `<div class="chip chip-upload" onclick="document.getElementById('${cfg.sceneUploadId}').click()">📷 +自定义</div>`;
    sceneChipsEl.innerHTML = h;
  }

  function renderProducts() {
    let h = '<span class="chip-label">产品</span>';
    cfg.products.forEach(p => {
      const delBtn = p.id.startsWith('up-') ? `<span onclick="event.stopPropagation();SceneEngine.removeProduct('${p.id}')" style="margin-left:2px;font-size:14px;line-height:1;cursor:pointer;opacity:0.5;" title="删除">×</span>` : '';
      var displayName = p.name.length > 6 ? p.name.slice(0,6) + '..' : p.name;
      h += '<div class="chip pchip" style="background-image:url(' + p.image + ');background-size:cover;" onclick="SceneEngine.add(\'' + p.id + '\')" title="' + p.name + '">' + displayName + delBtn + '</div>';
    });
    productChipsEl.innerHTML = h;
  }

  function removeProduct(pid) {
    const idx = cfg.products.findIndex(p => p.id === pid);
    if (idx >= 0) cfg.products.splice(idx, 1);
    // 同时从场景中移除该产品的所有实例
    instances.filter(p => p.productId === pid).forEach(p => {
      const el = document.getElementById(p.id);
      if (el) { if (cfg.enablePseudo3D && typeof Pseudo3D !== 'undefined') Pseudo3D.detach(el); el.remove(); }
    });
    instances = instances.filter(p => p.productId !== pid);
    if (selectedId && !instances.find(p => p.id === selectedId)) selectedId = null;
    renderProducts();
    updateCount();
    if (instances.length === 0 && sceneHint) sceneHint.style.opacity = '1';
  }

  function switchScene(id) {
    currentScene = id;
    const s = cfg.scenes.find(x => x.id === id);
    if (s && s.image) {
      sceneArea.dataset.scene = 'custom';
      sceneArea.style.backgroundImage = `url(${s.image})`;
    } else {
      sceneArea.dataset.scene = id;
      sceneArea.style.backgroundImage = '';
    }
    renderScenes();
  }

  function add(pid) {
    const product = cfg.products.find(p => p.id === pid);
    if (!product) return;
    const iid = 'pi-' + (++counter);
    const rect = sceneArea.getBoundingClientRect();
    const inst = {
      id: iid, productId: product.id,
      x: rect.width/2 - product.w/2 + (Math.random()-0.5)*100,
      y: rect.height/2 - product.h/2 + (Math.random()-0.5)*100,
      w: product.w, h: product.h, scale: 1.0, rotation: 0
    };
    instances.push(inst);

    const el = document.createElement('div');
    el.id = iid; el.className = 'product-item';
    el.style.cssText = `left:${inst.x}px;top:${inst.y}px;width:${inst.w}px;height:${inst.h}px;z-index:${instances.length};background-image:url(${product.image});transform:rotate(0deg);`;
    el.innerHTML = `<span class="product-label">${product.name}</span><span class="scale-badge">100% | 0°</span>`;
    el.addEventListener('pointerdown', onDown);
    sceneArea.appendChild(el);

    select(iid); updateCount();
    if (sceneHint) sceneHint.style.opacity = '0';
    if (cfg.enablePseudo3D && typeof Pseudo3D !== 'undefined') Pseudo3D.attach(el);
  }

  function select(iid) {
    if (selectedId) { const p = document.getElementById(selectedId); if (p) p.classList.remove('selected'); }
    selectedId = iid;
    if (iid) { const el = document.getElementById(iid); if (el) el.classList.add('selected'); }
  }

  function deleteSelected() {
    if (!selectedId) return;
    const el = document.getElementById(selectedId);
    if (el) { if (cfg.enablePseudo3D && typeof Pseudo3D !== 'undefined') Pseudo3D.detach(el); el.remove(); }
    instances = instances.filter(p => p.id !== selectedId);
    selectedId = null; updateCount();
    if (instances.length === 0 && sceneHint) sceneHint.style.opacity = '1';
  }

  function clearAll() {
    instances.forEach(p => {
      const el = document.getElementById(p.id);
      if (el) { if (cfg.enablePseudo3D && typeof Pseudo3D !== 'undefined') Pseudo3D.detach(el); el.remove(); }
    });
    instances = []; selectedId = null; updateCount();
    if (sceneHint) sceneHint.style.opacity = '1';
  }

  function updateCount() {
    if (productCountEl) productCountEl.textContent = instances.length + ' 个产品';
  }

  // Drag
  function onDown(e) {
    e.preventDefault(); e.stopPropagation();
    const el = e.currentTarget; select(el.id);
    const inst = instances.find(p => p.id === el.id);
    if (!inst) return;
    el.setPointerCapture(e.pointerId);
    dragInfo = { el, id: el.id, sx: e.clientX, sy: e.clientY, ox: inst.x, oy: inst.y };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  }
  function onMove(e) {
    if (!dragInfo || dragInfo.id !== e.currentTarget.id) return;
    if (pinchD0 !== null) return; // 双指缩放中不拖拽
    e.preventDefault();
    const inst = instances.find(p => p.id === dragInfo.id);
    if (!inst) return;
    inst.x = dragInfo.ox + e.clientX - dragInfo.sx;
    inst.y = dragInfo.oy + e.clientY - dragInfo.sy;
    dragInfo.el.style.left = inst.x + 'px';
    dragInfo.el.style.top = inst.y + 'px';
  }
  function onUp(e) {
    if (!dragInfo) return;
    dragInfo.el.removeEventListener('pointermove', onMove);
    dragInfo.el.removeEventListener('pointerup', onUp);
    dragInfo = null;
  }

  // Wheel: scale + rotate
  function onWheel(e) {
    if (!selectedId) return;
    e.preventDefault();
    const inst = instances.find(p => p.id === selectedId);
    if (!inst) return;
    const el = document.getElementById(selectedId);
    if (!el) return;
    if (e.shiftKey) {
      inst.rotation = (inst.rotation + (e.deltaY > 0 ? 15 : -15)) % 360;
    } else {
      inst.scale = Math.max(0.2, Math.min(3.0, inst.scale + (e.deltaY > 0 ? -0.05 : 0.05)));
    }
    applyTransform(el, inst);
  }

  // Pinch — 用 identifier 追踪手指，避免手指切换导致跳变
  var pinchIds = null;
  function getPinchDist(e) {
    if (e.touches.length < 2) return null;
    // 优先用已记录的手指 ID
    var t0 = null, t1 = null;
    if (pinchIds) {
      for (var i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === pinchIds[0]) t0 = e.touches[i];
        if (e.touches[i].identifier === pinchIds[1]) t1 = e.touches[i];
      }
    }
    // 如果有手指离开了，用当前的前两根
    if (!t0 || !t1) {
      t0 = e.touches[0]; t1 = e.touches[1];
      pinchIds = [t0.identifier, t1.identifier];
    }
    return {
      d: Math.hypot(t0.clientX-t1.clientX, t0.clientY-t1.clientY),
      a: Math.atan2(t0.clientY-t1.clientY, t0.clientX-t1.clientX)*180/Math.PI
    };
  }
  function onTouchS(e) {
    if (e.touches.length >= 2 && selectedId) {
      // 取消拖拽，进入纯缩放模式
      if (dragInfo) {
        dragInfo.el.removeEventListener('pointermove', onMove);
        dragInfo.el.removeEventListener('pointerup', onUp);
        dragInfo = null;
      }
      var p = getPinchDist(e);
      if (p) { pinchD0 = p.d; pinchA0 = p.a; }
    }
  }
  function onTouchM(e) {
    if (pinchD0===null || !selectedId || e.touches.length<2) return;
    e.preventDefault();
    var inst = instances.find(function(p){return p.id===selectedId;});
    if (!inst) return;
    var el = document.getElementById(selectedId);
    if (!el) return;
    var p = getPinchDist(e);
    if (!p) return;
    var ns = inst.scale * (p.d / pinchD0); ns = Math.max(0.2, Math.min(3.0, ns));
    inst.scale = inst.scale * 0.6 + ns * 0.4;
    var dr = p.a - pinchA0; if (Math.abs(dr) > 1.5) inst.rotation = (inst.rotation + dr) % 360;
    pinchD0 = p.d; pinchA0 = p.a;
    applyTransform(el, inst);
  }
  function onTouchE(e) {
    if (e.touches.length < 2) { pinchD0 = null; pinchA0 = null; pinchIds = null; }
  }

  var transformRAF = null;
  function applyTransform(el, inst) {
    // requestAnimationFrame 确保 Safari 同步渲染
    if (transformRAF) cancelAnimationFrame(transformRAF);
    transformRAF = requestAnimationFrame(function() {
      el.style.transform = 'rotate(' + inst.rotation + 'deg) scale(' + inst.scale + ')';
      var b = el.querySelector('.scale-badge');
      if (b) b.textContent = Math.round(inst.scale*100) + '% | ' + Math.round(inst.rotation) + '°';
    });
  }

  // Screenshot
  async function exportScreenshot() {
    if (typeof html2canvas === 'undefined') { alert('截图库加载中'); return; }
    sceneHint.style.display = 'none';
    document.querySelectorAll('.scale-badge').forEach(b=>b.style.display='none');
    if (selectedId) { const el=document.getElementById(selectedId); if(el)el.classList.remove('selected'); }
    const canvas = await html2canvas(sceneArea, { backgroundColor:null, useCORS:true, allowTaint:true });
    sceneHint.style.display = '';
    document.querySelectorAll('.scale-badge').forEach(b=>b.style.display='');
    if (selectedId) { const el=document.getElementById(selectedId); if(el)el.classList.add('selected'); }
    const a = document.createElement('a');
    a.download = '朗迹-预览-'+new Date().toISOString().slice(0,10)+'.png';
    a.href = canvas.toDataURL('image/png'); a.click();
  }

  function handleUpload(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      currentScene = 'custom'; sceneArea.dataset.scene='custom';
      sceneArea.style.backgroundImage = `url(${ev.target.result})`; renderScenes();
    };
    r.readAsDataURL(f); e.target.value='';
  }

  function bind() {
    sceneWrapper.addEventListener('wheel', onWheel, {passive:false});
    sceneWrapper.addEventListener('touchstart', onTouchS, {passive:false});
    sceneWrapper.addEventListener('touchmove', onTouchM, {passive:false});
    sceneWrapper.addEventListener('touchend', onTouchE);
    sceneArea.addEventListener('pointerdown', e => { if (e.target===sceneArea||e.target===sceneHint) select(null); });
    document.addEventListener('keydown', e => {
      if ((e.key==='Delete'||e.key==='Backspace') && document.activeElement===document.body) deleteSelected();
    });
  }

  return {
    init, switchScene, add, select, deleteSelected, clearAll,
    exportScreenshot, handleUpload, updateCount, removeProduct,
    renderProducts, get cfg() { return cfg; }
  };
})();
