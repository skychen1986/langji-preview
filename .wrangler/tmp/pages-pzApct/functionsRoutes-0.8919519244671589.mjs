import { onRequest as __api_cutout_js_onRequest } from "C:\\Users\\Administrator\\Desktop\\langji-preview\\functions\\api\\cutout.js"
import { onRequest as __api_health_js_onRequest } from "C:\\Users\\Administrator\\Desktop\\langji-preview\\functions\\api\\health.js"
import { onRequest as __api_products_js_onRequest } from "C:\\Users\\Administrator\\Desktop\\langji-preview\\functions\\api\\products.js"

export const routes = [
    {
      routePath: "/api/cutout",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_cutout_js_onRequest],
    },
  {
      routePath: "/api/health",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_health_js_onRequest],
    },
  {
      routePath: "/api/products",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_products_js_onRequest],
    },
  ]