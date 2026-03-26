import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import cesium from 'vite-plugin-cesium'

// https://vite.dev/config/
export default defineConfig({
  base: '/vue-cesium-shadertoy/',
  plugins: [
    vue(),
    vueDevTools(),
    cesium({
      // Cesium 静态资源路径（不包含 base 前缀）
      cesiumBaseUrl: './cesium/',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    proxy: {
      // 代理 ShaderToy API 请求
      '/api/shadertoy': {
        target: 'https://www.shadertoy.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/shadertoy/, '/api/v1'),
      },
    },
  },
  build: {
    // 确保资源路径正确
    assetsDir: 'assets',
  },
})
