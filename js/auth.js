// js/auth.js
// 用户认证模块 · 依赖：lc-init.js

const Auth = {
  current() {
    try { return window.LC ? window.LC.User.current() : null; }
    catch(e) { return null; }
  },

  async login(username, password) {
    if (!window.LC) throw new Error('Leancloud 未初始化');
    return window.LC.User.logIn(username, password);
  },

  async register(username, password, factoryName) {
    if (!window.LC) throw new Error('Leancloud 未初始化');
    const user = new window.LC.User();
    user.setUsername(username);
    user.setPassword(password);
    user.set('factoryName', factoryName);
    user.set('plan', 'standard');
    return user.signUp();
  },

  async logout() {
    if (!window.LC) return;
    return window.LC.User.logOut();
  },

  requireAuth() {
    const user = this.current();
    if (!user) {
      window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
      return null;
    }
    return user;
  }
};
