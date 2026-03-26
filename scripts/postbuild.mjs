import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { existsSync, renameSync, rmSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = resolve(__dirname, '..')
const distDir = resolve(projectRoot, 'dist')
const nestedDir = resolve(distDir, 'vue-cesium-shadertoy')
const cesiumDir = resolve(nestedDir, 'cesium')
const targetCesiumDir = resolve(distDir, 'cesium')

console.log('📁 检查目录结构...')
console.log('  项目根目录:', projectRoot)
console.log('  dist 目录:', distDir)
console.log('  嵌套目录:', nestedDir)
console.log('  Cesium 源目录:', cesiumDir)
console.log('  Cesium 目标目录:', targetCesiumDir)

// 检查嵌套的 cesium 目录是否存在
if (existsSync(cesiumDir)) {
  console.log('🔧 修复 Cesium 资源目录结构...')
  
  // 移动 cesium 目录到 dist 根目录
  if (existsSync(targetCesiumDir)) {
    rmSync(targetCesiumDir, { recursive: true, force: true })
  }
  
  renameSync(cesiumDir, targetCesiumDir)
  console.log('✅ Cesium 资源已移动到 dist/cesium/')
  
  // 删除空的嵌套目录
  if (existsSync(nestedDir)) {
    try {
      rmSync(nestedDir, { recursive: true, force: true })
      console.log('✅ 已删除空的嵌套目录')
    } catch (e) {
      console.log('⚠️ 无法删除嵌套目录:', e.message)
    }
  }
} else {
  console.log('⚠️ 未找到 cesium 目录:', cesiumDir)
}

console.log('✨ 构建后处理完成！')
