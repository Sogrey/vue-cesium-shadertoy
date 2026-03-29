<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
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
  {
    id: 'windows95',
    name: 'Windows 95',
    author: 'ShaderToy',
    code: `
#define PI 3.1415926535897932384626433832795

const float wave_amplitude = 0.076;
const float period = 2.*PI;

float wave_phase() {
    return iTime;
}

float square(vec2 st) {
    vec2 bl = step(vec2(0.), st);
    vec2 tr = step(vec2(0.),1.0-st);
    return bl.x * bl.y * tr.x * tr.y;
}

vec4 frame(vec2 st) {
    float tushka = square(st*mat2((1./.48), 0., 0., (1./.69)));
    
    mat2 sector_mat = mat2(1./.16, 0., 0., 1./.22);
    float sectors[4];
    sectors[0] = square(st * sector_mat + (1./.16)*vec2(0.000,-0.280));
    sectors[1] = square(st * sector_mat + (1./.16)*vec2(0.000,-0.060));
    sectors[2] = square(st * sector_mat + (1./.16)*vec2(-0.240,-0.280));
    sectors[3] = square(st * sector_mat + (1./.16)*vec2(-0.240,-0.060));
    vec3 sector_colors[4];
    sector_colors[0] = vec3(0.941, 0.439, 0.404) * sectors[0];
    sector_colors[1] = vec3(0.435, 0.682, 0.843) * sectors[1];
    sector_colors[2] = vec3(0.659, 0.808, 0.506) * sectors[2];
    sector_colors[3] = vec3(0.996, 0.859, 0.114) * sectors[3];
    
    return vec4(vec3(sector_colors[0] + sector_colors[1] +
                     sector_colors[2] + sector_colors[3]), tushka);
}

vec4 trail_piece(vec2 st, vec2 index, float scale) {
    scale = index.x * 0.082 + 0.452;
    
    vec3 color;
    if (index.y > 0.9 && index.y < 2.1 ) {
        color = vec3(0.435, 0.682, 0.843);
        scale *= .8;
    } else if (index.y > 3.9 && index.y < 5.1) {
        color = vec3(0.941, 0.439, 0.404);
        scale *= .8;
    } else {
        color = vec3(0., 0., 0.);
    }
    
    float scale1 = 1./scale;
    float shift = - (1.-scale) / (2. * scale);
    vec2 st2 = vec2(vec3(st, 1.) * mat3(scale1, 0., shift, 0., scale1, shift, 0., 0., 1.));
    float mask = square(st2);

    return vec4( color, mask );
}

vec4 trail(vec2 st) {
    const float piece_height = 7. / .69;
    const float piece_width = 6. / .54;
  
    st.x = 1.2760 * pow(st.x, 3.0) - 1.4624 * st.x*st.x + 1.4154 * st.x;
    
    float x_at_cell = floor(st.x*piece_width)/piece_width;
    float x_at_cell_center = x_at_cell + 0.016;
    float incline = cos(0.5*period + wave_phase()) * wave_amplitude;
    
    float offset = sin(x_at_cell_center*period + wave_phase())* wave_amplitude + 
        incline*(st.x-x_at_cell)*5.452;
    
    float mask = step(offset, st.y) * (1.-step(.69+offset, st.y)) * step(0., st.x);
    
    vec2 cell_coord = vec2((st.x - x_at_cell) * piece_width,
                           fract((st.y-offset) * piece_height));
    vec2 cell_index = vec2(x_at_cell * piece_width, 
                           floor((st.y-offset) * piece_height));
    
    vec4 pieces = trail_piece(cell_coord, cell_index, 0.752);
    
    return vec4(vec3(pieces), pieces.a * mask);
}

vec4 logo(vec2 st) {
    if (st.x <= .54) {
        return trail(st);
    } else {
        vec2 st2 = st + vec2(0., -sin(st.x*period + wave_phase())*wave_amplitude);
        return frame(st2 + vec2(-.54, 0));
    }
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 st = fragCoord.xy/iResolution.xy;
    st.x *= iResolution.x/iResolution.y;

    st += vec2(.0);
    st *= 1.472;
    st += vec2(-0.7,-0.68);
    float rot = PI*-0.124;
    st *= mat2(cos(rot), sin(rot), -sin(rot), cos(rot));
    vec3 color = vec3(1.);
    
    vec4 logo_ = logo(st);    
    fragColor = mix(vec4(0.,.5,.5,1.000), logo_, logo_.a);
}`,
  },
  {
    id: 'loopingSpline',
    name: '循环样条',
    author: 'Sébastien Bérubé',
    code: `
const int POINT_COUNT = 8;
struct CtrlPts
{
    vec2 p[POINT_COUNT];
};
vec2 PointArray(int i, CtrlPts ctrlPts)
{
    if(i==0 || i==POINT_COUNT  ) return ctrlPts.p[0];
    if(i==1 || i==POINT_COUNT+1) return ctrlPts.p[1];
    if(i==2 || i==POINT_COUNT+2) return ctrlPts.p[2];
    if(i==3) return ctrlPts.p[3];
    if(i==4) return ctrlPts.p[4];
    if(i==5) return ctrlPts.p[5];
    if(i==6) return ctrlPts.p[6];
    if(i==7) return ctrlPts.p[7];
    return vec2(0);
}

vec2 catmullRom(float fTime, CtrlPts ctrlPts)
{
    float t = fTime;
    const float n = float(POINT_COUNT);
    
    int idxOffset = int(t*n);
    vec2 p1 = PointArray(idxOffset,ctrlPts);
    vec2 p2 = PointArray(idxOffset+1,ctrlPts);
    vec2 p3 = PointArray(idxOffset+2,ctrlPts);
    vec2 p4 = PointArray(idxOffset+3,ctrlPts);
    
    t *= n;
    t = (t-float(int(t)));
    
    vec2 val = 0.5 * ((-p1 + 3.*p2 -3.*p3 + p4)*t*t*t
               + (2.*p1 -5.*p2 + 4.*p3 - p4)*t*t
               + (-p1+p3)*t
               + 2.*p2);
    return val;
}

float distanceToLineSeg(vec2 p, vec2 a, vec2 b)
{
    vec2 ap = p-a;
    vec2 ab = b-a;
    vec2 e = a+clamp(dot(ap,ab)/dot(ab,ab),0.0,1.0)*ab;
    return length(p-e);
}

vec2 debugDistanceField(vec2 uv, CtrlPts ctrlPts)
{
    const float MAX_DIST = 10000.0;
    float bestX = 0.0;
    
    const int iter = POINT_COUNT*2+1;
    float primarySegLength = 1.0/float(iter-1);
    vec2 pA = catmullRom(0., ctrlPts);
    float minRoughDist = MAX_DIST;
    float x = 0.0;
    for(int i=0; i < iter; ++i)
    {
        vec2 pB = catmullRom(x, ctrlPts);
        
        float d = distanceToLineSeg(uv, pA, pB);
        pA = pB;
        if(d<minRoughDist)
        {
            bestX = x;
            minRoughDist = d;
        }
         
        x += primarySegLength;
        x = min(x,0.99999);
    }
    
    const int iter2 = 14;
    x = max(bestX-1.25*primarySegLength,0.0);
    float minDist = MAX_DIST;
    pA = catmullRom(x, ctrlPts);
    for(int i=0; i < iter2; ++i)
    {
        vec2 pB = catmullRom(x, ctrlPts);
        float d = distanceToLineSeg(uv, pA, pB);
        pA = pB;
        
        if(d<minDist)
        {
            bestX = x;
            minDist = d;
        }
         
        x += 1.5/float(iter2-1)*primarySegLength;
        x = min(x,0.99999);
    }
    
    return vec2(minDist,minRoughDist);
}

vec2 getUV(vec2 px)
{
    vec2 uv = px / iResolution.xx;
    return uv;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    CtrlPts ctrlPts;
    ctrlPts.p[0] = vec2(0.10,0.25);
    ctrlPts.p[1] = vec2(0.2,0.1);
    ctrlPts.p[2] = vec2(0.6,0.35);
    ctrlPts.p[3] = vec2(0.4,0.1);
    ctrlPts.p[4] = vec2(0.8,0.35);
    ctrlPts.p[5] = vec2(0.6,0.55);
    ctrlPts.p[6] = vec2(0.5,0.45);
    ctrlPts.p[7] = vec2(0.3,0.49);
    
    if(iMouse.z > 0.1)
        ctrlPts.p[2] = getUV(iMouse.xy);
    vec2 uv = getUV(fragCoord.xy);
    
    float fTime = iTime*0.15;
    vec2 pA = catmullRom(fract(fTime), ctrlPts);
    vec2 pB = catmullRom(fract(fTime+0.02), ctrlPts);
    
    vec2 dSeg = debugDistanceField(uv, ctrlPts);
    
    vec3 c = vec3(dSeg.x*7.0+smoothstep(0.20,0.3,abs(fract(dSeg.x*20.0)-0.5)));
    
    c = mix(vec3(0,0.8,0.9),c,smoothstep(-0.005,0.0035,dSeg.y));
    c = mix(vec3(1,0  ,0.0),c,smoothstep(0.0,0.0025,dSeg.x));
    
    float minDistP = 10000.0;
    for(int i=0; i < POINT_COUNT; ++i)
    {
        vec2 ctrl_pt = PointArray(i,ctrlPts);
        minDistP = min(length(uv-ctrl_pt),minDistP);
    }
    c = mix(vec3(0,0,1),c,smoothstep(0.008,0.011,minDistP));
    
    c = mix(vec3(0,0.7,0),c,smoothstep(0.008,0.011,length(uv-pA)));
    c = mix(vec3(0,0.7,0),c,smoothstep(0.008,0.011,length(uv-pB)));
    c = mix(vec3(1,1,1),c,smoothstep(0.004,0.006,length(uv-pB)));
    
    fragColor = vec4(c,1);
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
