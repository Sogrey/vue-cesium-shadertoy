<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import ShaderEditor from './ShaderEditor.vue'
import GeometrySelector from './GeometrySelector.vue'
import type { GeometryType, ShaderPreset } from '@/types'
import { fetchShaderById, getApiKey, setApiKey, extractShaderId } from '@/utils/shadertoyApi'
import { shaderPresets } from '@/shaders'

const emit = defineEmits<{
  (e: 'update:shaderCode', value: string): void
  (e: 'update:geometryType', value: GeometryType): void
  (e: 'update:isPlaying', value: boolean): void
}>()

const selectedGeometry = ref<GeometryType>('plane')
const isPlaying = ref(true)
const shaderCode = ref('')

// Cesium 代码生成相关
const showCesiumCode = ref(false)
const copySuccess = ref(false)
const activeCodeTab = ref<'glsl' | 'ts'>('glsl')

// 生成 Cesium 版本的 shader 代码
const cesiumCode = computed(() => {
  return `// Cesium Material Fragment Shader
uniform float u_time;
uniform vec2 u_resolution;
uniform vec4 u_mouse;

// ShaderToy 兼容宏
#define iTime u_time
#define iResolution u_resolution
#define iMouse u_mouse
#define texture(sampler, uv) czm_texture(sampler, uv)

// ============ 你的 ShaderToy 代码 ============
${shaderCode.value}
// ============================================

// Cesium Material 入口
czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);
    
    vec2 fragCoord = materialInput.st * u_resolution;
    vec4 fragColor;
    
    mainImage(fragColor, fragCoord);
    
    material.diffuse = fragColor.rgb;
    material.alpha = fragColor.a;
    
    return material;
}`
})

// TypeScript 使用示例
const typescriptUsageCode = computed(() => {
  return `// TypeScript 使用示例
import * as Cesium from 'cesium'

// 1. 创建 Material
const fragmentShader = \`${cesiumCode.value.replace(/`/g, '\\`')}\`

const material = new Cesium.Material({
  fabric: {
    type: 'ShaderToy',
    uniforms: {
      u_time: 0,
      u_resolution: new Cesium.Cartesian2(800, 600),
      u_mouse: new Cesium.Cartesian4(0, 0, 0, 0),
    },
    source: fragmentShader,
  },
})

// 2. 应用到几何体
const primitive = new Cesium.Primitive({
  geometryInstances: new Cesium.GeometryInstance({
    geometry: new Cesium.SphereGeometry({ radius: 100000 }),
    modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(
      Cesium.Cartesian3.fromDegrees(116.39, 39.90, 500000)
    ),
  }),
  appearance: new Cesium.MaterialAppearance({
    material: material,
    faceForward: true,
  }),
})

viewer.scene.primitives.add(primitive)

// 3. 动画循环
let startTime = Date.now()
function animate() {
  material.uniforms.u_time = (Date.now() - startTime) / 1000
  material.uniforms.u_resolution.x = viewer.canvas.width
  material.uniforms.u_resolution.y = viewer.canvas.height
  requestAnimationFrame(animate)
}
animate()`
})

// 复制代码
async function copyCesiumCode() {
  try {
    await navigator.clipboard.writeText(cesiumCode.value)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

// 复制 TypeScript 示例
async function copyTypescriptCode() {
  try {
    await navigator.clipboard.writeText(typescriptUsageCode.value)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

// ShaderToy 导入相关
const shaderIdInput = ref('')
const apiKeyInput = ref(getApiKey() || '')
const showApiKeyConfig = ref(false)
const isFetching = ref(false)
const fetchError = ref('')
const currentShaderName = ref('')

// 预设 Shader（从 shaders/index.ts 导入）
const presets = shaderPresets

const currentPreset = ref(presets[0])

function selectPreset(preset: ShaderPreset) {
  currentPreset.value = preset
  shaderCode.value = preset.code
  emit('update:shaderCode', preset.code)
}

function handleGeometryChange(type: GeometryType) {
  selectedGeometry.value = type
  emit('update:geometryType', type)
}

function handleCodeChange(code: string) {
  shaderCode.value = code
  emit('update:shaderCode', code)
}

function togglePlay() {
  isPlaying.value = !isPlaying.value
  emit('update:isPlaying', isPlaying.value)
}

// 保存 API Key
function saveApiKey() {
  setApiKey(apiKeyInput.value.trim())
  showApiKeyConfig.value = false
}

// 从 ShaderToy 导入
async function importShader() {
  const input = shaderIdInput.value.trim()
  if (!input) {
    fetchError.value = '请输入 Shader ID 或 URL'
    return
  }
  
  const shaderId = extractShaderId(input)
  if (!shaderId) {
    fetchError.value = '无效的 Shader ID 或 URL'
    return
  }
  
  isFetching.value = true
  fetchError.value = ''
  
  try {
    const shaderInfo = await fetchShaderById(shaderId)
    shaderCode.value = shaderInfo.code
    currentShaderName.value = shaderInfo.name
    emit('update:shaderCode', shaderInfo.code)
    shaderIdInput.value = ''
  } catch (error) {
    fetchError.value = error instanceof Error ? error.message : '导入失败'
  } finally {
    isFetching.value = false
  }
}

// 初始化
onMounted(() => {
  const firstPreset = presets[0]
  if (firstPreset) {
    shaderCode.value = firstPreset.code
    emit('update:shaderCode', firstPreset.code)
  }
  emit('update:geometryType', selectedGeometry.value)
})
</script>

<template>
  <div class="panel">
    <div class="panel-header">
      <h1>🎮 ShaderToy 演示器</h1>
      <p class="subtitle">基于 Cesium 的 Shader 可视化工具</p>
    </div>

    <!-- ShaderToy 导入 -->
    <div class="section">
      <h2>🔗 从 ShaderToy 导入</h2>
      <div class="import-row">
        <input
          v-model="shaderIdInput"
          type="text"
          placeholder="输入 Shader ID 或 URL (如 XstXR2)"
          class="shader-input"
          @keyup.enter="importShader"
        />
        <button 
          class="import-btn" 
          :disabled="isFetching"
          @click="importShader"
        >
          {{ isFetching ? '加载中...' : '获取' }}
        </button>
      </div>
      <p v-if="currentShaderName" class="shader-name">当前: {{ currentShaderName }}</p>
      <p v-if="fetchError" class="error-msg">{{ fetchError }}</p>
      
      <!-- API Key 配置 -->
      <div class="api-key-toggle">
        <button class="toggle-btn" @click="showApiKeyConfig = !showApiKeyConfig">
          {{ showApiKeyConfig ? '隐藏' : '配置' }} API Key (可选)
        </button>
      </div>
      <div v-if="showApiKeyConfig" class="api-key-config">
        <input
          v-model="apiKeyInput"
          type="text"
          placeholder="自定义 API Key (已有默认 key)"
          class="api-input"
        />
        <button class="save-btn" @click="saveApiKey">保存</button>
        <p class="api-hint">
          已内置公开 API Key，可直接使用。<br/>
          如需更高配额，可获取自己的 Key：
          <a href="https://www.shadertoy.com/myapps" target="_blank">shadertoy.com/myapps</a>
        </p>
      </div>
    </div>

    <div class="section">
      <h2>📦 几何体选择</h2>
      <GeometrySelector :model-value="selectedGeometry" @update:model-value="handleGeometryChange" />
    </div>

    <div class="section">
      <h2>🎨 预设效果</h2>
      <div class="preset-grid">
        <button
          v-for="preset in presets"
          :key="preset.id"
          :class="['preset-btn', { active: currentPreset?.id === preset.id }]"
          @click="selectPreset(preset)"
        >
          {{ preset.name }}
        </button>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>📝 Shader 代码</h2>
        <button class="play-btn" @click="togglePlay">
          {{ isPlaying ? '⏸ 暂停' : '▶ 播放' }}
        </button>
      </div>
      <ShaderEditor :model-value="shaderCode" @update:model-value="handleCodeChange" />
      
      <!-- 生成 Cesium 代码 -->
      <div class="generate-section">
        <button class="generate-btn" @click="showCesiumCode = !showCesiumCode">
          {{ showCesiumCode ? '▼ 隐藏 Cesium 代码' : '▶ 生成 Cesium 代码' }}
        </button>
      </div>
      
      <div v-if="showCesiumCode" class="cesium-code-panel">
        <div class="code-tabs">
          <button 
            :class="['tab-btn', { active: activeCodeTab === 'glsl' }]" 
            @click="activeCodeTab = 'glsl'"
          >
            GLSL Shader
          </button>
          <button 
            :class="['tab-btn', { active: activeCodeTab === 'ts' }]" 
            @click="activeCodeTab = 'ts'"
          >
            TypeScript 示例
          </button>
        </div>
        
        <div v-if="activeCodeTab === 'glsl'" class="code-content">
          <div class="code-header">
            <span>Fragment Shader</span>
            <button class="copy-btn" @click="copyCesiumCode">
              {{ copySuccess ? '✓ 已复制' : '📋 复制' }}
            </button>
          </div>
          <pre class="code-block"><code>{{ cesiumCode }}</code></pre>
        </div>
        
        <div v-if="activeCodeTab === 'ts'" class="code-content">
          <div class="code-header">
            <span>TypeScript 使用示例</span>
            <button class="copy-btn" @click="copyTypescriptCode">
              {{ copySuccess ? '✓ 已复制' : '📋 复制' }}
            </button>
          </div>
          <pre class="code-block ts-code"><code>{{ typescriptUsageCode }}</code></pre>
        </div>
      </div>
    </div>

    <div class="section tips">
      <h3>💡 使用提示</h3>
      <ul>
        <li>ShaderToy 使用 mainImage(out vec4, in vec2) 函数</li>
        <li>可用变量: iTime, iResolution, iMouse</li>
        <li>鼠标在画布上移动可交互</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.panel {
  padding: 20px;
  color: #e0e0e0;
}

.panel-header {
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #0f3460;
}

.panel-header h1 {
  font-size: 20px;
  margin-bottom: 8px;
  color: #00d9ff;
}

.subtitle {
  font-size: 12px;
  color: #8892b0;
}

.section {
  margin-bottom: 24px;
}

.section h2 {
  font-size: 14px;
  margin-bottom: 12px;
  color: #64ffda;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h2 {
  margin: 0;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.preset-btn {
  padding: 10px 12px;
  border: 1px solid #0f3460;
  background: #1a1a2e;
  color: #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}

.preset-btn:hover {
  border-color: #00d9ff;
  background: #16213e;
}

.preset-btn.active {
  border-color: #00d9ff;
  background: #0f3460;
  color: #00d9ff;
}

.play-btn {
  padding: 6px 12px;
  border: 1px solid #64ffda;
  background: transparent;
  color: #64ffda;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.play-btn:hover {
  background: #64ffda;
  color: #16213e;
}

.tips {
  padding: 12px;
  background: #0f3460;
  border-radius: 6px;
}

.tips h3 {
  font-size: 13px;
  margin-bottom: 8px;
  color: #ffd700;
}

.tips ul {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  line-height: 1.8;
  color: #8892b0;
}

/* 导入相关样式 */
.import-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.shader-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #0f3460;
  background: #1a1a2e;
  color: #e0e0e0;
  border-radius: 4px;
  font-size: 13px;
}

.shader-input:focus {
  outline: none;
  border-color: #00d9ff;
}

.import-btn {
  padding: 8px 16px;
  border: none;
  background: #00d9ff;
  color: #16213e;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.import-btn:hover:not(:disabled) {
  background: #00b8d4;
}

.import-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.shader-name {
  font-size: 12px;
  color: #64ffda;
  margin: 4px 0;
}

.error-msg {
  font-size: 12px;
  color: #ff6b6b;
  margin: 4px 0;
}

.api-key-toggle {
  margin-top: 8px;
}

.toggle-btn {
  padding: 4px 8px;
  border: 1px solid #0f3460;
  background: transparent;
  color: #8892b0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
}

.toggle-btn:hover {
  color: #e0e0e0;
}

.api-key-config {
  margin-top: 8px;
  padding: 12px;
  background: #0d1117;
  border-radius: 6px;
}

.api-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #0f3460;
  background: #1a1a2e;
  color: #e0e0e0;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 8px;
}

.api-input:focus {
  outline: none;
  border-color: #00d9ff;
}

.save-btn {
  padding: 6px 12px;
  border: 1px solid #64ffda;
  background: transparent;
  color: #64ffda;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.save-btn:hover {
  background: #64ffda;
  color: #16213e;
}

.api-hint {
  font-size: 11px;
  color: #8892b0;
  margin-top: 8px;
}

.api-hint a {
  color: #00d9ff;
}

/* Cesium 代码生成样式 */
.generate-section {
  margin-top: 12px;
}

.generate-btn {
  width: 100%;
  padding: 10px;
  border: 1px solid #6366f1;
  background: transparent;
  color: #818cf8;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.generate-btn:hover {
  background: #6366f1;
  color: #fff;
}

.cesium-code-panel {
  margin-top: 12px;
  border: 1px solid #0f3460;
  border-radius: 6px;
  overflow: hidden;
}

.code-tabs {
  display: flex;
  background: #0d1117;
  border-bottom: 1px solid #0f3460;
}

.tab-btn {
  flex: 1;
  padding: 10px;
  border: none;
  background: transparent;
  color: #8892b0;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #e0e0e0;
}

.tab-btn.active {
  color: #00d9ff;
  background: #1a1a2e;
  border-bottom: 2px solid #00d9ff;
}

.code-content {
  background: #0d1117;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #161b22;
  border-bottom: 1px solid #0f3460;
  font-size: 12px;
  color: #8892b0;
}

.copy-btn {
  padding: 4px 10px;
  border: 1px solid #0f3460;
  background: transparent;
  color: #00d9ff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: #00d9ff;
  color: #16213e;
}

.code-block {
  margin: 0;
  padding: 12px;
  max-height: 400px;
  overflow: auto;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 11px;
  line-height: 1.6;
  color: #c9d1d9;
  white-space: pre-wrap;
  word-break: break-all;
}

.code-block::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.code-block::-webkit-scrollbar-track {
  background: #0d1117;
}

.code-block::-webkit-scrollbar-thumb {
  background: #0f3460;
  border-radius: 3px;
}

.code-block::-webkit-scrollbar-thumb:hover {
  background: #1f3460;
}

.ts-code {
  color: #7ee787;
}
</style>
