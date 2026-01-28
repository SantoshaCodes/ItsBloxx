import { onRequestPost as __api_ai_ts_onRequestPost } from "/Users/jamespentalow/Documents/bloxx-enrichment/editor/functions/api/ai.ts"
import { onRequestGet as __api_collab_ts_onRequestGet } from "/Users/jamespentalow/Documents/bloxx-enrichment/editor/functions/api/collab.ts"
import { onRequestGet as __api_components_ts_onRequestGet } from "/Users/jamespentalow/Documents/bloxx-enrichment/editor/functions/api/components.ts"
import { onRequestPost as __api_components_ts_onRequestPost } from "/Users/jamespentalow/Documents/bloxx-enrichment/editor/functions/api/components.ts"
import { onRequestPost as __api_deploy_ts_onRequestPost } from "/Users/jamespentalow/Documents/bloxx-enrichment/editor/functions/api/deploy.ts"
import { onRequestGet as __api_images_ts_onRequestGet } from "/Users/jamespentalow/Documents/bloxx-enrichment/editor/functions/api/images.ts"
import { onRequestPost as __api_images_ts_onRequestPost } from "/Users/jamespentalow/Documents/bloxx-enrichment/editor/functions/api/images.ts"
import { onRequestGet as __api_pages_ts_onRequestGet } from "/Users/jamespentalow/Documents/bloxx-enrichment/editor/functions/api/pages.ts"
import { onRequestPost as __api_pages_create_ts_onRequestPost } from "/Users/jamespentalow/Documents/bloxx-enrichment/editor/functions/api/pages-create.ts"
import { onRequestPost as __api_save_ts_onRequestPost } from "/Users/jamespentalow/Documents/bloxx-enrichment/editor/functions/api/save.ts"
import { onRequestPost as __api_schema_update_ts_onRequestPost } from "/Users/jamespentalow/Documents/bloxx-enrichment/editor/functions/api/schema-update.ts"
import { onRequest as __preview___path___ts_onRequest } from "/Users/jamespentalow/Documents/bloxx-enrichment/editor/functions/preview/[[path]].ts"

export const routes = [
    {
      routePath: "/api/ai",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_ai_ts_onRequestPost],
    },
  {
      routePath: "/api/collab",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_collab_ts_onRequestGet],
    },
  {
      routePath: "/api/components",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_components_ts_onRequestGet],
    },
  {
      routePath: "/api/components",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_components_ts_onRequestPost],
    },
  {
      routePath: "/api/deploy",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_deploy_ts_onRequestPost],
    },
  {
      routePath: "/api/images",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_images_ts_onRequestGet],
    },
  {
      routePath: "/api/images",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_images_ts_onRequestPost],
    },
  {
      routePath: "/api/pages",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_pages_ts_onRequestGet],
    },
  {
      routePath: "/api/pages-create",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_pages_create_ts_onRequestPost],
    },
  {
      routePath: "/api/save",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_save_ts_onRequestPost],
    },
  {
      routePath: "/api/schema-update",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_schema_update_ts_onRequestPost],
    },
  {
      routePath: "/preview/:path*",
      mountPath: "/preview",
      method: "",
      middlewares: [],
      modules: [__preview___path___ts_onRequest],
    },
  ]