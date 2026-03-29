<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import ShaderEditor from './ShaderEditor.vue'
import GeometrySelector from './GeometrySelector.vue'
import type { GeometryType, ShaderPreset, PassConfig, PassType } from '@/types'
import { fetchShaderById, getApiKey, setApiKey, extractShaderId } from '@/utils/shadertoyApi'
import { shaderPresets, isMultipassPreset } from '@/shaders'

const emit = defineEmits<{
  (e: 'update:shaderCode', value: string): void
  (e: 'update:geometryType', value: GeometryType): void
  (e: 'update:isPlaying', value: boolean): void
  (e: 'update:passes', value: PassConfig[]): void
  (e: 'render'): void
}>()

const selectedGeometry = ref<GeometryType>('plane')
const isPlaying = ref(true)
const shaderCode = ref('')

// 多通道管理
const passes = ref<PassConfig[]>([])
const activePassId = ref<string>('main')

// 获取可用的通道类型
const passTypes: PassType[] = ['BufferA', 'BufferB', 'BufferC', 'BufferD', 'Image']

// 判断是否为多通道模式
const isMultipassMode = computed(() => passes.value.length > 1 || (passes.value.length === 1 && passes.value[0]?.type !== 'Image'))

// 初始化默认通道
function initDefaultPass(code: string) {
  passes.value = [
    {
      id: 'main',
      type: 'Image',
      code: code,
      inputs: [],
    },
  ]
  activePassId.value = 'main'
  emit('update:passes', passes.value)
}

// 添加新通道
function addPass(type?: PassType) {
  const newId = `pass_${Date.now()}`
  const newType = type || (passes.value.length === 0 ? 'Image' : 'BufferA')
  passes.value.push({
    id: newId,
    type: newType,
    code: 'void mainImage(out vec4 O, vec2 I) {\n    O = vec4(0.0);\n}',
    inputs: [],
  })
  activePassId.value = newId
}

// 删除通道
function removePass(passId: string) {
  if (passes.value.length <= 1) return // 至少保留一个通道
  const index = passes.value.findIndex((p) => p.id === passId)
  if (index > -1) {
    passes.value.splice(index, 1)
    if (activePassId.value === passId && passes.value[0]) {
      activePassId.value = passes.value[0].id
    }
  }
}

// 更新通道代码（仅更新本地状态，不触发重渲染）
function updatePassCode(passId: string, code: string) {
  const pass = passes.value.find((p) => p.id === passId)
  if (pass) {
    pass.code = code
    shaderCode.value = code // 同步到 shaderCode
  }
}

// 更新通道类型（仅更新本地状态，不触发重渲染）
function updatePassType(passId: string, type: PassType) {
  const pass = passes.value.find((p) => p.id === passId)
  if (pass) {
    pass.type = type
  }
}

// 添加通道输入（仅更新本地状态）
function addPassInput(passId: string) {
  const pass = passes.value.find((p) => p.id === passId)
  if (pass && pass.inputs.length < 4) {
    // 找可用的源
    const availableSources = passes.value
      .filter((p) => p.id !== passId)
      .map((p) => p.id)
    const firstSource = availableSources[0]
    if (firstSource) {
      pass.inputs.push({
        channel: pass.inputs.length,
        source: firstSource,
      })
    }
  }
}

// 删除通道输入（仅更新本地状态）
function removePassInput(passId: string, channel: number) {
  const pass = passes.value.find((p) => p.id === passId)
  if (pass) {
    pass.inputs = pass.inputs.filter((i) => i.channel !== channel)
  }
}

// 更新通道输入源（仅更新本地状态）
function updatePassInputSource(passId: string, channel: number, source: string) {
  const pass = passes.value.find((p) => p.id === passId)
  if (pass) {
    const input = pass.inputs.find((i) => i.channel === channel)
    if (input) {
      input.source = source
    }
  }
}

// 应用更改并触发重渲染
async function applyChanges() {
  // 更新 passes
  emit('update:passes', [...passes.value])
  
  // 单通道模式：更新 shaderCode
  if (passes.value.length === 1 && passes.value[0]?.type === 'Image') {
    emit('update:shaderCode', passes.value[0].code)
  }
  
  // 等待 Vue 更新完成
  await nextTick()
  
  // 触发重渲染
  emit('render')
}

// 当前激活的通道
const activePass = computed(() => passes.value.find((p) => p.id === activePassId.value))

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
  // 多通道模式
  if (preset.passes && preset.passes.length > 0) {
    passes.value = preset.passes.map(p => ({ ...p }))
    const firstPass = passes.value[0]
    if (firstPass) {
      activePassId.value = firstPass.id
      shaderCode.value = firstPass.code
    }
  } else if (preset.code) {
    // 单通道模式
    initDefaultPass(preset.code)
    shaderCode.value = preset.code
  }
  // 选择预设后自动应用
  applyChanges()
}

function selectPresetById(id: string) {
  const preset = presets.find((p) => p.id === id)
  if (preset) {
    selectPreset(preset)
  }
}

function handleGeometryChange(type: GeometryType) {
  selectedGeometry.value = type
  emit('update:geometryType', type)
}

function handleCodeChange(code: string) {
  shaderCode.value = code
  // 更新当前激活的通道（仅本地更新，不触发重渲染）
  updatePassCode(activePassId.value, code)
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
    selectPreset(firstPreset)
  }
  emit('update:geometryType', selectedGeometry.value)
})

// 监听通道变化，更新 shaderCode（用于单通道兼容）
watch(
  () => passes.value,
  (newPasses) => {
    const firstPass = newPasses[0]
    if (newPasses.length === 1 && firstPass?.type === 'Image') {
      shaderCode.value = firstPass.code
    }
  },
  { deep: true }
)
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
      <select
        class="preset-select"
        :value="currentPreset?.id"
        @change="selectPresetById(($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="preset in presets"
          :key="preset.id"
          :value="preset.id"
        >
          {{ preset.name }} - {{ preset.author }}{{ isMultipassPreset(preset) ? ' [多通道]' : '' }}
        </option>
      </select>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>📝 Shader 代码</h2>
        <div class="header-actions">
          <button class="render-btn" @click="applyChanges">
            🔄 重渲染
          </button>
          <button class="play-btn" @click="togglePlay">
            {{ isPlaying ? '⏸ 暂停' : '▶ 播放' }}
          </button>
        </div>
      </div>

      <!-- 多通道 Tabs（类似 ShaderToy） -->
      <div class="pass-tabs-container">
        <div class="pass-tabs">
          <button
            v-for="pass in passes"
            :key="pass.id"
            :class="['pass-tab', { active: activePassId === pass.id }]"
            @click="activePassId = pass.id"
          >
            {{ pass.type }}
            <span
              v-if="passes.length > 1"
              class="remove-pass"
              @click.stop="removePass(pass.id); applyChanges()"
            >
              ✕
            </span>
          </button>
          <button v-if="passes.length < 5" class="add-pass-tab" @click="addPass()">
            +
          </button>
        </div>
        
        <!-- 当前通道配置（仅多通道时显示） -->
        <div v-if="activePass && isMultipassMode" class="pass-config-inline">
          <select 
            :value="activePass.type" 
            @change="updatePassType(activePass.id, ($event.target as HTMLSelectElement).value as PassType)"
            class="type-select"
          >
            <option v-for="type in passTypes" :key="type" :value="type">{{ type }}</option>
          </select>
          
          <!-- 输入配置 -->
          <div class="inputs-compact">
            <button
              v-if="activePass.inputs.length < 4"
              class="add-input-btn-small"
              @click="addPassInput(activePass.id)"
            >
              +iChannel
            </button>
            <div v-for="input in activePass.inputs" :key="input.channel" class="input-badge">
              <span>C{{ input.channel }}:</span>
              <select 
                :value="input.source" 
                @change="updatePassInputSource(activePass.id, input.channel, ($event.target as HTMLSelectElement).value)"
                class="source-select"
              >
                <option value="self">self</option>
                <option v-for="p in passes.filter(p => p.id !== activePass?.id)" :key="p.id" :value="p.id">
                  {{ p.type }}
                </option>
              </select>
              <button class="remove-input-small" @click="removePassInput(activePass.id, input.channel)">✕</button>
            </div>
          </div>
        </div>
      </div>

      <ShaderEditor :model-value="activePass?.code || shaderCode" @update:model-value="handleCodeChange" />
      
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
        <li>可用变量: iTime, iResolution, iMouse, iFrame</li>
        <li>鼠标在画布上移动可交互</li>
        <li>
          <strong>多通道渲染：</strong>
          <ul style="margin-top: 6px; padding-left: 20px;">
            <li>使用 <code style="color: #00d9ff;">iChannel0-3</code> 访问纹理通道</li>
            <li>支持 Buffer A/B/C/D 通道链</li>
            <li>支持自反馈（Buffer 读取自己的上一帧）</li>
            <li>预设列表中 [多通道] 标识表示多通道 Shader</li>
          </ul>
        </li>
        <li>WebGL 2.0: 使用 <code style="color: #00d9ff;">texture()</code> 而非 <code>texture2D()</code></li>
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

.header-actions {
  display: flex;
  gap: 8px;
}

.render-btn {
  padding: 6px 12px;
  border: 1px solid #10b981;
  background: transparent;
  color: #10b981;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.render-btn:hover {
  background: #10b981;
  color: #16213e;
}

/* 多通道 Tabs 样式（类似 ShaderToy） */
.pass-tabs-container {
  margin-bottom: 12px;
  background: #0d1117;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #0f3460;
}

.pass-tabs {
  display: flex;
  background: #161b22;
  border-bottom: 1px solid #0f3460;
  overflow-x: auto;
}

.pass-tabs::-webkit-scrollbar {
  height: 4px;
}

.pass-tabs::-webkit-scrollbar-thumb {
  background: #0f3460;
  border-radius: 2px;
}

.pass-tab {
  position: relative;
  padding: 10px 16px;
  border: none;
  border-right: 1px solid #0f3460;
  background: transparent;
  color: #8892b0;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  transition: all 0.2s;
}

.pass-tab:hover {
  color: #e0e0e0;
  background: #1a1a2e;
}

.pass-tab.active {
  color: #00d9ff;
  background: #1a1a2e;
  border-bottom: 2px solid #00d9ff;
}

.remove-pass {
  margin-left: 6px;
  color: #ff6b6b;
  font-size: 10px;
}

.remove-pass:hover {
  color: #ff3333;
}

.add-pass-tab {
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: #6366f1;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
}

.add-pass-tab:hover {
  color: #818cf8;
  background: #1a1a2e;
}

.pass-config-inline {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #0d1117;
  border-bottom: 1px solid #0f3460;
  flex-wrap: wrap;
}

.type-select {
  padding: 4px 8px;
  border: 1px solid #0f3460;
  background: #1a1a2e;
  color: #e0e0e0;
  border-radius: 4px;
  font-size: 11px;
}

.inputs-compact {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.add-input-btn-small {
  padding: 4px 8px;
  border: 1px dashed #0f3460;
  background: transparent;
  color: #6366f1;
  border-radius: 4px;
  cursor: pointer;
  font-size: 10px;
}

.add-input-btn-small:hover {
  background: #1a1a2e;
  color: #818cf8;
}

.input-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  background: #1a1a2e;
  border-radius: 4px;
  font-size: 10px;
}

.input-badge span {
  color: #64ffda;
  font-family: 'Fira Code', monospace;
}

.source-select {
  padding: 2px 4px;
  border: 1px solid #0f3460;
  background: #0d1117;
  color: #e0e0e0;
  border-radius: 3px;
  font-size: 10px;
}

.remove-input-small {
  padding: 0 4px;
  border: none;
  background: transparent;
  color: #ff6b6b;
  cursor: pointer;
  font-size: 10px;
}

.remove-input-small:hover {
  color: #ff3333;
}

/* 播放按钮 */
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

.preset-select {
  width: 100%;
  padding: 12px;
  border: 1px solid #0f3460;
  background: #1a1a2e;
  color: #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364ffda' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
}

.preset-select:focus {
  outline: none;
  border-color: #00d9ff;
}

.preset-select:hover {
  border-color: #00d9ff;
}

.preset-select option {
  background: #1a1a2e;
  color: #e0e0e0;
  padding: 8px;
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
