/**
 * 朗迹 IP 动效系统
 * - 鼠标点击烟花粒子
 * - 产品卡片 hover 发光
 * - 角色入场/浮动动画
 */
(function() {
  'use strict';

  // ========== 鼠标点击烟花粒子 ==========
  const canvas = document.createElement('canvas');
  canvas.id = 'sparkleCanvas';
  Object.assign(canvas.style, {
    position: 'fixed', top: '0', left: '0',
    width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '9999',
  });
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let particles = [];
  let animId = null;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const COLORS = ['#7c3aed','#a78bfa','#fbbf24','#f59e0b','#34d399','#60a5fa','#f472b6','#fff'];

  function spawn(x, y) {
    const count = 12 + Math.floor(Math.random() * 10);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        decay: 0.015 + Math.random() * 0.03,
        size: 2 + Math.random() * 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08; // gravity
      p.life -= p.decay;
      if (p.life <= 0) return false;
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return true;
    });
    if (particles.length > 0) {
      animId = requestAnimationFrame(animate);
    } else {
      animId = null;
    }
  }

  document.addEventListener('click', function(e) {
    spawn(e.clientX, e.clientY);
    if (!animId) animId = requestAnimationFrame(animate);
  });

  // ========== 产品卡片 hover 发光 ==========
  const style = document.createElement('style');
  style.textContent = `
    .product-item {
      transition: box-shadow 0.3s ease, transform 0.3s ease, outline 0.15s !important;
    }
    .product-item:hover {
      box-shadow: 0 0 20px rgba(124,58,237,0.5), 0 8px 32px rgba(0,0,0,0.5) !important;
      transform: scale(1.05) !important;
      z-index: 10 !important;
    }
    .product-item.selected {
      outline: 2px solid #fff !important;
      outline-offset: 3px !important;
      box-shadow: 0 0 24px rgba(255,255,255,0.4), 0 4px 24px rgba(124,58,237,0.3) !important;
    }
    .product-card {
      transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.2s !important;
    }
    .product-card:hover {
      transform: translateY(-4px) !important;
      box-shadow: 0 8px 30px rgba(124,58,237,0.25) !important;
    }

    /* ===== 角色动画 ===== */
    @keyframes langjiBounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    @keyframes langjiWave {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-8deg); }
      75% { transform: rotate(8deg); }
    }
    @keyframes langjiSlideIn {
      from { opacity: 0; transform: translateX(60px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes langjiFadeIn {
      from { opacity: 0; transform: translateY(20px) scale(0.9); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-6px); }
    }

    /* 入口页角色 */
    .langji-hero {
      animation: langjiFadeIn 0.8s ease-out;
      width: 180px; height: auto;
      margin-bottom: 24px;
      filter: drop-shadow(0 8px 24px rgba(124,58,237,0.3));
    }
    .langji-hero:hover {
      animation: langjiWave 0.5s ease-in-out;
    }

    /* 气泡 */
    .langji-bubble {
      background: #1a1a2e;
      border: 1px solid #7c3aed;
      border-radius: 12px;
      padding: 10px 16px;
      font-size: 13px;
      color: #ccc;
      position: relative;
      animation: float 3s ease-in-out infinite;
    }
    .langji-bubble::after {
      content: '';
      position: absolute;
      bottom: -8px; left: 50%;
      transform: translateX(-50%);
      width: 0; height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid #1a1a2e;
    }

    /* 角落小角色 */
    .langji-corner {
      position: fixed;
      bottom: 100px; right: 16px;
      width: 80px; height: auto;
      z-index: 100;
      animation: langjiSlideIn 0.6s ease-out 0.5s both, float 3s ease-in-out 1.5s infinite;
      cursor: pointer;
      filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4));
      transition: transform 0.3s;
    }
    .langji-corner:hover {
      transform: scale(1.15);
      animation: langjiBounce 0.6s ease-in-out;
    }

    /* 角落角色提示气泡 */
    .langji-tip {
      position: fixed;
      bottom: 190px; right: 100px;
      background: #1a1a2e;
      border: 1px solid #7c3aed;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 11px;
      color: #ccc;
      z-index: 101;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
      white-space: nowrap;
    }
    .langji-tip.show { opacity: 1; }

    /* Dashboard 角色 */
    .langji-dash {
      width: 120px; height: auto;
      margin-bottom: 12px;
      animation: langjiBounce 2s ease-in-out infinite;
      filter: drop-shadow(0 4px 16px rgba(124,58,237,0.3));
    }

    /* 截图瞬间 */
    @keyframes langjiPop {
      0% { transform: scale(0); opacity: 0; }
      60% { transform: scale(1.3); opacity: 1; }
      100% { transform: scale(1); opacity: 0.9; }
    }
    .langji-celebrate {
      position: fixed;
      bottom: 120px; right: 24px;
      width: 100px; height: auto;
      z-index: 999;
      animation: langjiPop 0.8s ease-out forwards;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);

  // ========== 导出：截图时弹出庆祝角色 ==========
  window.showLangjiCelebrate = function() {
    const img = document.createElement('img');
    img.src = 'langji-thumb.png';
    img.className = 'langji-celebrate';
    document.body.appendChild(img);
    setTimeout(() => img.remove(), 1000);
  };

})();
