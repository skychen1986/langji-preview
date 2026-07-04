// js/store.js
// 产品/场景数据存储 · 依赖：lc-init.js, auth.js

const Store = {
  async getProducts() {
    const user = Auth.current();
    if (!user) return [];
    const query = new window.LC.Query('Product');
    query.equalTo('owner', user);
    query.descending('createdAt');
    query.limit(200);
    return query.find();
  },

  async addProduct(name, imageFile) {
    const user = Auth.current();
    if (!user) throw new Error('未登录');
    const Product = window.LC.Object.extend('Product');
    const p = new Product();
    p.set('name', name);
    p.set('owner', user);
    if (imageFile) {
      const lcFile = new window.LC.File(name + '.png', imageFile);
      const savedFile = await lcFile.save();
      p.set('image', savedFile);
    }
    return p.save();
  },

  async deleteProduct(id) {
    const Product = window.LC.Object.extend('Product');
    const p = window.LC.Object.createWithoutData('Product', id);
    return p.destroy();
  },

  async getScenes() {
    const user = Auth.current();
    if (!user) return [];
    const query = new window.LC.Query('Scene');
    query.equalTo('owner', user);
    query.limit(50);
    return query.find();
  },

  async addScene(name, imageFile) {
    const user = Auth.current();
    const Scene = window.LC.Object.extend('Scene');
    const s = new Scene();
    s.set('name', name);
    s.set('owner', user);
    if (imageFile) {
      const lcFile = new window.LC.File(name + '.jpg', imageFile);
      const savedFile = await lcFile.save();
      s.set('image', savedFile);
    }
    return s.save();
  },

  getDemoProducts() {
    const raw = localStorage.getItem('langji_demo_products');
    return raw ? JSON.parse(raw) : null;
  },

  setDemoProducts(products) {
    localStorage.setItem('langji_demo_products', JSON.stringify(products));
  }
};
