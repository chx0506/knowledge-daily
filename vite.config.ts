import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

// 后端 Access-Control-Allow-Origin 固定为自身源，开发环境必须走代理。
// 用 VITE_API_TARGET=http://127.0.0.1:3001 npm run dev 可切到自起实例。
const apiTarget = process.env.VITE_API_TARGET || "http://127.0.0.1:3000";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
