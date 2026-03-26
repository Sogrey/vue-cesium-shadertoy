<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ShaderEditor from './ShaderEditor.vue'
import GeometrySelector from './GeometrySelector.vue'
import type { GeometryType, ShaderPreset } from '@/types'
import { fetchShaderById, getApiKey, setApiKey, extractShaderId } from '@/utils/shadertoyApi'

const emit = defineEmits<{
  (e: 'update:shaderCode', value: string): void
  (e: 'update:geometryType', value: GeometryType): void
  (e: 'update:isPlaying', value: boolean): void
}>()

const selectedGeometry = ref<GeometryType>('plane')
const isPlaying = ref(true)
const shaderCode = ref('')

// ShaderToy 导入相关
const shaderIdInput = ref('')
const apiKeyInput = ref(getApiKey() || '')
const showApiKeyConfig = ref(false)
const isFetching = ref(false)
const fetchError = ref('')
const currentShaderName = ref('')

// 预设 Shader
const presets: ShaderPreset[] = [
  {
    id: 'plasma',
    name: '等离子体',
    author: 'ShaderToy',
    code: `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.xy;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= iResolution.x / iResolution.y;
    
    float t = iTime * 0.5;
    
    float v = 0.0;
    v += sin(p.x * 10.0 + t);
    v += sin((p.y * 10.0 + t) * 0.5);
    v += sin((p.x * 10.0 + p.y * 10.0 + t) * 0.5);
    
    vec2 c = p * 0.5;
    v += sin(length(c * 20.0) + t);
    
    vec3 col = vec3(
        sin(v * 3.14159 + 0.0) * 0.5 + 0.5,
        sin(v * 3.14159 + 2.094) * 0.5 + 0.5,
        sin(v * 3.14159 + 4.188) * 0.5 + 0.5
    );
    
    fragColor = vec4(col, 1.0);
}`,
  },
  {
    id: 'fractal',
    name: '分形波纹',
    author: 'ShaderToy',
    code: `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    float d = length(uv);
    vec3 col = vec3(0.0);
    
    for(float i = 0.0; i < 5.0; i++) {
        d = length(uv);
        uv = fract(uv * 1.5) - 0.5;
        d = sin(d * 8.0 + iTime) / 8.0;
        d = abs(d);
        d = 0.02 / d;
        col += d * vec3(0.5 + 0.5 * sin(iTime + i), 0.5 + 0.5 * cos(iTime + i * 0.5), 1.0);
    }
    
    fragColor = vec4(col * 0.2, 1.0);
}`,
  },
  {
    id: 'neon',
    name: '霓虹隧道',
    author: 'ShaderToy',
    code: `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);
    
    float t = iTime * 2.0;
    
    float a = angle / 3.14159 * 4.0 + t;
    float r = radius * 10.0 - t * 2.0;
    
    float v = sin(a * 2.0) * cos(r);
    v = smoothstep(0.0, 1.0, v);
    
    vec3 col1 = vec3(1.0, 0.0, 1.0);
    vec3 col2 = vec3(0.0, 1.0, 1.0);
    vec3 col = mix(col1, col2, sin(t) * 0.5 + 0.5);
    
    col *= v * (1.0 - radius * 0.5);
    
    fragColor = vec4(col, 1.0);
}`,
  },
  {
    id: 'waves',
    name: '波浪',
    author: 'ShaderToy',
    code: `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.xy;
    
    float wave = 0.0;
    for(float i = 1.0; i < 10.0; i++) {
        wave += sin(uv.x * i * 10.0 + iTime * i * 0.5) / i;
        wave += sin(uv.y * i * 8.0 + iTime * i * 0.3) / i;
    }
    
    wave = wave * 0.5 + 0.5;
    
    vec3 col = vec3(
        sin(wave * 3.14159) * 0.5 + 0.5,
        sin(wave * 3.14159 + 2.0) * 0.5 + 0.5,
        sin(wave * 3.14159 + 4.0) * 0.5 + 0.5
    );
    
    fragColor = vec4(col, 1.0);
}`,
  },
]

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
  shaderCode.value = presets[0].code
  emit('update:shaderCode', presets[0].code)
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
          :class="['preset-btn', { active: currentPreset.id === preset.id }]"
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
</style>
