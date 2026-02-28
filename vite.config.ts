import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { resolve } from 'path'
import { builtinModules } from 'module'

// 是否在 Electron 环境中运行（electron:dev 脚本会设置该变量）
const isElectron = process.env.ELECTRON === 'true'

async function getPlugins() {
  const plugins = [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      imports: ['vue', 'vue-router', 'pinia'],
      dts: 'src/auto-imports.d.ts'
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/components.d.ts'
    })
  ]

  if (isElectron) {
    // 只在 Electron 开发模式下加载 Electron 相关插件
    const { default: electron } = await import('vite-plugin-electron')
    const { default: renderer } = await import('vite-plugin-electron-renderer')
    plugins.push(
      electron([
        {
          entry: 'electron/main.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: [
                  'electron',
                  'electron-store',
                  'better-sqlite3',
                  'cheerio',
                  'undici',
                  ...builtinModules,
                  ...builtinModules.map(m => `node:${m}`)
                ]
              }
            }
          }
        },
        {
          entry: 'electron/preload.ts',
          onstart(options) { options.reload() },
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: [
                  'electron',
                  ...builtinModules,
                  ...builtinModules.map(m => `node:${m}`)
                ]
              }
            }
          }
        }
      ]) as any,
      renderer() as any
    )
  }

  return plugins
}

export default defineConfig(async () => ({
  plugins: await getPlugins(),
  base: './',
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  server: {
    port: 5173
  },
  optimizeDeps: {
    include: [
      'element-plus/es',
      'element-plus/es/components/progress/style/css',
      'element-plus/es/components/scrollbar/style/css',
      'element-plus/es/components/button/style/css',
      'element-plus/es/components/dialog/style/css',
      'element-plus/es/components/table/style/css',
      'element-plus/es/components/tag/style/css',
      'element-plus/es/components/input/style/css',
      'element-plus/es/components/select/style/css',
      'element-plus/es/components/option/style/css',
      'element-plus/es/components/tooltip/style/css',
      'element-plus/es/components/popconfirm/style/css',
      'element-plus/es/components/form/style/css',
      'element-plus/es/components/form-item/style/css',
      'element-plus/es/components/switch/style/css',
      'element-plus/es/components/checkbox/style/css',
      'element-plus/es/components/checkbox-group/style/css',
      'element-plus/es/components/loading/style/css',
      'element-plus/es/components/alert/style/css',
      'element-plus/es/components/tabs/style/css',
      'element-plus/es/components/tab-pane/style/css',
      'element-plus/es/components/dropdown/style/css',
      'element-plus/es/components/dropdown-item/style/css',
      'element-plus/es/components/dropdown-menu/style/css'
    ]
  },
  // 浏览器预览时将 window.electronAPI 模拟为 undefined，避免报错
  define: isElectron ? {} : {}
}))
