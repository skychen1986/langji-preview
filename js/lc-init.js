// js/lc-init.js
// Leancloud SDK 初始化 · 依赖：HTML 中先加载 av-min.js CDN

const LC_CONFIG = {
  appId: 'YOUR_LEANCLOUD_APP_ID',
  appKey: 'YOUR_LEANCLOUD_APP_KEY',
  serverURL: 'https://YOUR_LEANCLOUD_API_URL'
};

function initLC() {
  if (typeof AV === 'undefined') {
    console.error('Leancloud SDK 未加载，请检查 CDN');
    return null;
  }
  AV.init(LC_CONFIG);
  console.log('Leancloud 已初始化');
  return AV;
}

window.LC = initLC();
