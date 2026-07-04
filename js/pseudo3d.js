// js/pseudo3d.js
// CSS 3D 卡片倾斜 + 动态阴影 · 伪3D效果

const Pseudo3D = (function() {
  const MAX_TILT = 15;
  const PERSPECTIVE = 600;

  function attach(el) {
    el.style.transition = 'transform 0.1s ease-out, box-shadow 0.1s ease-out';

    function onMove(e) {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      const rotateY = dx * MAX_TILT;
      const rotateX = -dy * MAX_TILT;
      const shadowX = dx * 10;
      const shadowY = dy * 10 + 8;
      const shadowBlur = 16 + Math.abs(dx + dy) * 4;
      el.style.boxShadow = `${shadowX}px ${shadowY}px ${shadowBlur}px rgba(0,0,0,0.5)`;
      // 在原有 transform 基础上叠加透视倾斜
      const currentTransform = el.style.transform || '';
      // 提取原有的 rotate 和 scale
      const rotateMatch = currentTransform.match(/rotate\(([^)]+)\)/);
      const scaleMatch = currentTransform.match(/scale\(([^)]+)\)/);
      const rot = rotateMatch ? rotateMatch[1] : '0deg';
      const scl = scaleMatch ? scaleMatch[1] : '1';
      el.style.transform = `perspective(${PERSPECTIVE}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotate(${rot}) scale(${scl})`;
    }

    function onLeave() {
      const currentTransform = el.style.transform || '';
      const rotateMatch = currentTransform.match(/rotate\(([^)]+)\)/);
      const scaleMatch = currentTransform.match(/scale\(([^)]+)\)/);
      const rot = rotateMatch ? rotateMatch[1] : '0deg';
      const scl = scaleMatch ? scaleMatch[1] : '1';
      el.style.transform = `perspective(600px) rotateX(0deg) rotateY(0deg) rotate(${rot}) scale(${scl})`;
      el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)';
    }

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    el._pseudo3d = { onMove, onLeave };
  }

  function detach(el) {
    if (el._pseudo3d) {
      el.removeEventListener('mousemove', el._pseudo3d.onMove);
      el.removeEventListener('mouseleave', el._pseudo3d.onLeave);
      el.style.transition = '';
      el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)';
      el.style.transform = (el.style.transform || '').replace(/perspective\([^)]+\)\s*rotateX\([^)]+\)\s*rotateY\([^)]+\)\s*/, '');
      delete el._pseudo3d;
    }
  }

  return { attach, detach };
})();
