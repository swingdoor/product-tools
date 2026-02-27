/**
 * 构建 Electron 主进程和 preload 脚本
 * 使用 esbuild 进行快速编译
 */
const { build } = require('esbuild')
const path = require('path')

async function buildElectron() {
  const commonOptions = {
    bundle: true,
    platform: 'node',
    target: 'node20',
    external: ['electron', 'electron-store'],
    sourcemap: false,
    minify: false,
    format: 'cjs',
  }

  // 构建 main.ts
  await build({
    ...commonOptions,
    entryPoints: [path.join(__dirname, '../electron/main.ts')],
    outfile: path.join(__dirname, '../dist-electron/main.js'),
  })
  console.log('✓ Built dist-electron/main.js')

  // 构建 preload.ts
  await build({
    ...commonOptions,
    entryPoints: [path.join(__dirname, '../electron/preload.ts')],
    outfile: path.join(__dirname, '../dist-electron/preload.js'),
  })
  console.log('✓ Built dist-electron/preload.js')

  console.log('✓ Electron build complete!')
}

buildElectron().catch((err) => {
  console.error('Build failed:', err)
  process.exit(1)
})
