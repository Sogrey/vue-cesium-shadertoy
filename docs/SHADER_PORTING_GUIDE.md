# ShaderToy Shader 移植到 Cesium 指南

本文档详细介绍如何将 ShaderToy 上的 shader 效果移植到 Cesium 项目中。

## 目录

- [背景知识](#背景知识)
- [ShaderToy 与 Cesium 的差异](#shadertoy-与-cesium-的差异)
- [移植步骤详解](#移植步骤详解)
- [核心代码实现](#核心代码实现)
- [常见问题与解决方案](#常见问题与解决方案)
- [进阶技巧](#进阶技巧)
- [完整示例](#完整示例)

---

## 背景知识

### ShaderToy 简介

[ShaderToy](https://www.shadertoy.com/) 是一个在线 GLSL shader 分享平台，用户可以创建和分享各种视觉效果。ShaderToy 的 shader 特点：

- **入口函数**: `mainImage(out vec4 fragColor, in vec2 fragCoord)`
- **屏幕空间渲染**: 在 2D 画布上渲染
- **内置 Uniform**: `iTime`, `iResolution`, `iMouse`, `iFrame` 等
- **实时预览**: 支持实时编辑和预览

### Cesium Material 系统

Cesium 使用自定义的 Material 系统来渲染几何体：

- **入口函数**: `czm_material czm_getMaterial(czm_materialInput materialInput)`
- **3D 世界坐标**: 在三维地球环境中渲染
- **内置变量**: `materialInput.st` (纹理坐标), `czm_getDefaultMaterial` 等
- **Uniform 类型**: 使用 `Cartesian2`, `Cartesian3`, `Cartesian4` 等类型

---

## ShaderToy 与 Cesium 的差异

| 特性 | ShaderToy | Cesium |
|------|-----------|--------|
| 渲染空间 | 2D 屏幕空间 | 3D 世界坐标 |
| 入口函数 | `mainImage()` | `czm_getMaterial()` |
| 时间变量 | `iTime` | 需自定义 `u_time` |
| 分辨率 | `iResolution` (vec3) | 需自定义 `u_resolution` (vec2) |
| 鼠标交互 | `iMouse` (vec4) | 需自定义 `u_mouse` (vec4) |
| 纹理采样 | `texture()` | `texture()` (WebGL 2.0) |
| 坐标系统 | 像素坐标 `fragCoord` | UV 坐标 `materialInput.st` |
| WebGL 版本 | WebGL 2.0 | WebGL 2.0 |
| 多通道 | Buffer A/B/C/D | FBO 多通道渲染 |

---

## 移植步骤详解

### 步骤 1: 理解 ShaderToy Shader 结构

典型的 ShaderToy shader 结构：

```glsl
// ShaderToy 示例
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // 将像素坐标转换为 UV 坐标 (0-1)
    vec2 uv = fragCoord / iResolution.xy;
    
    // 计算颜色
    vec3 col = vec3(uv, 0.5 + 0.5 * sin(iTime));
    
    // 输出颜色
    fragColor = vec4(col, 1.0);
}
```

### 步骤 2: 创建 Cesium Material 包装器

需要将 ShaderToy 的 `mainImage` 包装到 Cesium 的 `czm_getMaterial` 函数中：

```glsl
// Cesium Material 包装器
uniform float u_time;
uniform vec2 u_resolution;
uniform vec4 u_mouse;

// 定义 ShaderToy 兼容的宏
#define iTime u_time
#define iResolution u_resolution
#define iMouse u_mouse

// 原始 ShaderToy 代码
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // ... 原始代码 ...
}

// Cesium Material 入口
czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material material = czm_getDefaultMaterial(materialInput);
    
    // 将 UV 坐标转换为像素坐标（注意：加上 0.5 以获取像素中心）
    vec2 fragCoord = materialInput.st * u_resolution + 0.5;
    vec4 fragColor;
    
    // 调用 ShaderToy 函数
    mainImage(fragColor, fragCoord);
    
    // 设置 Cesium Material 属性
    material.diffuse = fragColor.rgb;
    material.alpha = fragColor.a;
    
    return material;
}
```

### 步骤 3: 创建 Cesium Material 实例

在 JavaScript/TypeScript 中创建 Material：

```typescript
import * as Cesium from 'cesium'

const material = new Cesium.Material({
  fabric: {
    type: 'ShaderToy',
    uniforms: {
      u_time: 0,
      u_resolution: new Cesium.Cartesian2(800, 600),
      u_mouse: new Cesium.Cartesian4(0, 0, 0, 0),
    },
    source: fragmentShader, // 上一步生成的 shader 代码
  },
})
```

### 步骤 4: 应用到几何体

```typescript
// 创建几何体
const geometryInstance = new Cesium.GeometryInstance({
  geometry: new Cesium.SphereGeometry({ radius: 100000 }),
  modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(116.39, 39.90, 500000)
  ),
})

// 创建 Primitive
const primitive = new Cesium.Primitive({
  geometryInstances: geometryInstance,
  appearance: new Cesium.MaterialAppearance({
    material: material,
    faceForward: true,
  }),
})

// 添加到场景
viewer.scene.primitives.add(primitive)
```

### 步骤 5: 动画循环更新 Uniform

```typescript
let startTime = Date.now()

function animate() {
  if (primitive.appearance && primitive.appearance.material) {
    const material = primitive.appearance.material
    // 更新时间
    material.uniforms.u_time = (Date.now() - startTime) / 1000
    // 更新分辨率
    material.uniforms.u_resolution.x = viewer.canvas.width
    material.uniforms.u_resolution.y = viewer.canvas.height
  }
  requestAnimationFrame(animate)
}
animate()
```

---

## 核心代码实现

### Shader 转换器 (TypeScript)

```typescript
/**
 * 将 ShaderToy 的 mainImage 函数转换为 Cesium 可用的 fragment shader
 */
export function convertShaderToyToCesium(shaderToyCode: string): string {
  const fragmentShader = `
// ShaderToy uniforms
uniform float u_time;
uniform vec2 u_resolution;
uniform vec4 u_mouse;

// ShaderToy 兼容宏
#define iTime u_time
#define iResolution u_resolution
#define iMouse u_mouse

// 用户自定义函数
${shaderToyCode}

// Cesium Material 入口
czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);
    
    // 注意：fragCoord 需要加上 0.5 以获取像素中心坐标
    vec2 fragCoord = materialInput.st * u_resolution + 0.5;
    vec4 fragColor;
    
    mainImage(fragColor, fragCoord);
    
    material.diffuse = fragColor.rgb;
    material.alpha = fragColor.a;
    
    return material;
}
`
  return fragmentShader
}
```

### Material 创建器 (TypeScript)

```typescript
export function createCesiumMaterial(
  cesium: typeof Cesium,
  fragmentShader: string,
  uniforms: {
    iTime: number
    iResolution: [number, number, number]
    iMouse: [number, number, number, number]
  }
) {
  const { Material, Cartesian2, Cartesian4 } = cesium

  return new Material({
    fabric: {
      type: 'ShaderToy',
      uniforms: {
        u_time: uniforms.iTime,
        u_resolution: new Cartesian2(uniforms.iResolution[0], uniforms.iResolution[1]),
        u_mouse: new Cartesian4(
          uniforms.iMouse[0],
          uniforms.iMouse[1],
          uniforms.iMouse[2],
          uniforms.iMouse[3]
        ),
      },
      source: fragmentShader,
    },
  })
}
```

### Uniform 类型说明

| ShaderToy Uniform | Cesium 类型 | 说明 |
|-------------------|-------------|------|
| `iTime` (float) | `number` | 时间（秒） |
| `iResolution` (vec3) | `Cartesian2` | 只需要 x, y (宽高) |
| `iMouse` (vec4) | `Cartesian4` | xy=当前位置, zw=点击位置 |

**重要**: Cesium Material 的 uniform 不支持数组类型，必须使用 `Cartesian2`/`Cartesian4` 等类型。

---

## 常见问题与解决方案

### 问题 1: Uniform 类型错误

**错误信息**: `u_resolution has invalid type`

**原因**: Cesium Material 不接受数组类型的 uniform

**解决方案**:
```typescript
// ❌ 错误写法
uniforms: {
  u_resolution: [800, 600], // 不支持
}

// ✅ 正确写法
uniforms: {
  u_resolution: new Cesium.Cartesian2(800, 600),
}
```

### 问题 2: 几何体不可见

**原因**: 几何体位置或相机位置不正确

**解决方案**:
```typescript
// 使用 ENU 坐标系放置几何体
const position = Cesium.Cartesian3.fromDegrees(116.39, 39.90, 500000)
const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(position)

// 相机定位
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(116.38, 39.89, 1000000),
  orientation: {
    heading: 0,
    pitch: -Math.PI / 4,
    roll: 0,
  },
})
```

### 问题 3: 鼠标交互不工作

**原因**: 未正确处理鼠标事件或 uniform 更新

**解决方案**:
```typescript
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
let mousePos = { x: 0, y: 0, z: 0, w: 0 }

// 鼠标移动
handler.setInputAction((movement) => {
  if (movement?.position) {
    mousePos.x = movement.position.x
    mousePos.y = viewer.canvas.height - movement.position.y // Y 轴翻转
  }
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

// 鼠标点击
handler.setInputAction(() => {
  mousePos.z = mousePos.x
  mousePos.w = mousePos.y
}, Cesium.ScreenSpaceEventType.LEFT_DOWN)

// 在动画循环中更新 uniform
material.uniforms.u_mouse.x = mousePos.x
material.uniforms.u_mouse.y = mousePos.y
material.uniforms.u_mouse.z = mousePos.z
material.uniforms.u_mouse.w = mousePos.w
```

### 问题 4: Shader 编译错误

**常见原因**:
1. 使用了 WebGL 1.0 语法（如 `texture2D`）
2. 变量名与 Cesium 内置冲突
3. Uniform 名称冲突（Cesium 会添加后缀）

**解决方案**:
- Cesium 使用 WebGL 2.0，请使用 `texture()` 而非 `texture2D()`
- 支持 `texelFetch()` 等 WebGL 2.0 函数
- 避免使用 Cesium 保留字（如 `u_frame`）
- 使用唯一的 Material type 名称避免缓存冲突

### 问题 5: 多通道渲染 (Multi-pass)

ShaderToy 的多通道 shader（使用 `iChannel0`, `iChannel1` 等）**现已支持**！

**实现方式**:
1. 使用 `MultipassRenderer` 类管理多个 FBO
2. 每个 Buffer 通道在独立的 Framebuffer 中渲染
3. Image 通道读取 Buffer 结果并渲染最终效果

```typescript
// 多通道预设格式
const multipassPreset: ShaderPreset = {
  id: 'multipass-demo',
  name: '多通道示例',
  passes: [
    {
      id: 'bufferA',
      type: 'BufferA',
      code: bufferACode,
      inputs: [], // 可引用其他 buffer
    },
    {
      id: 'image',
      type: 'Image',
      code: imageCode,
      inputs: [
        { channel: 0, source: 'bufferA' }, // 引用 BufferA
      ],
    },
  ],
}
```

#### iChannel 配置详解

**PassInput 接口定义**：
```typescript
interface PassInput {
  channel: number   // 0-3 对应 iChannel0-iChannel3
  source: string    // 数据源：其他 pass 的 id 或 'self' 表示自反馈
}
```

**配置步骤**：

1. **添加通道输入**
   - 点击通道配置区域的 **+iChannel** 按钮
   - 系统自动分配下一个可用通道（0-3）
   - 自动选择第一个可用的数据源

2. **选择数据源**
   - **self**: 自反馈（读取自己的上一帧输出）
   - **bufferA/bufferB/...**: 引用其他 Buffer 的输出
   - 每个通道最多配置 4 个输入（iChannel0-3）

3. **配置示例**

**示例 1: 自反馈（Trail Effect）**
```typescript
{
  id: 'bufferA',
  type: 'BufferA',
  code: `
void mainImage(out vec4 O, vec2 I) {
    vec2 uv = I / iResolution.xy;
    vec4 prev = texture(iChannel0, uv);  // 读取上一帧
    vec3 newColor = vec3(uv, 0.5 + 0.5 * sin(iTime));
    O = mix(prev, vec4(newColor, 1.0), 0.05);  // 混合新旧数据
}`,
  inputs: [
    { channel: 0, source: 'self' }  // 自反馈
  ]
}
```

**示例 2: Buffer 链（Pipeline）**
```typescript
passes: [
  {
    id: 'bufferA',
    type: 'BufferA',
    code: bufferACode,
    inputs: []  // 无输入
  },
  {
    id: 'bufferB',
    type: 'BufferB',
    code: bufferBCode,
    inputs: [
      { channel: 0, source: 'bufferA' }  // 读取 BufferA
    ]
  },
  {
    id: 'image',
    type: 'Image',
    code: imageCode,
    inputs: [
      { channel: 0, source: 'bufferA' },  // iChannel0 = BufferA
      { channel: 1, source: 'bufferB' }   // iChannel1 = BufferB
    ]
  }
]
```

**示例 3: 多纹理混合**
```typescript
{
  id: 'image',
  type: 'Image',
  code: `
void mainImage(out vec4 O, vec2 I) {
    vec2 uv = I / iResolution.xy;
    vec4 tex0 = texture(iChannel0, uv);  // BufferA
    vec4 tex1 = texture(iChannel1, uv);  // BufferB
    vec4 tex2 = texture(iChannel2, uv);  // BufferC
    O = mix(tex0, tex1, 0.5) + tex2 * 0.3;  // 混合三个纹理
}`,
  inputs: [
    { channel: 0, source: 'bufferA' },
    { channel: 1, source: 'bufferB' },
    { channel: 2, source: 'bufferC' }
  ]
}
```

**UI 操作流程**：

1. **创建多通道预设**
   - 点击通道标签栏的 **+** 按钮添加新通道
   - 选择通道类型（BufferA/B/C/D 或 Image）

2. **配置 iChannel 输入**
   - 选中目标通道
   - 点击 **+iChannel** 按钮
   - 从下拉菜单选择数据源

3. **删除输入配置**
   - 点击输入旁边的 **×** 按钮移除

**注意事项**:
- Buffer id 必须唯一
- 避免循环引用（A → B → A）
- 最多 4 个输入通道（iChannel0-3）
- 自反馈需要 Buffer 类型（Image 不支持）
- 切换预设时会自动清理资源

**调试技巧**：
```glsl
// 在 shader 中调试 iChannel 输入
void mainImage(out vec4 O, vec2 I) {
    vec2 uv = I / iResolution.xy;

    // 检查 iChannel0 是否有数据
    vec4 tex = texture(iChannel0, uv);
    if (length(tex.rgb) < 0.01) {
        O = vec4(1.0, 0.0, 0.0, 1.0);  // 红色表示无数据
    } else {
        O = tex;  // 正常显示
    }
}
```

### 问题 6: Common 通道处理

**现象**: ShaderToy 的 Common 通道包含公共函数，不知道如何在项目中使用

**原因**: Common 通道不是渲染通道，而是代码共享机制

**解决方案**:

Common 通道在 ShaderToy 中用于定义公共函数，被其他通道引用。在我们的实现中，有两种处理方式：

#### 方式 1: 合并代码（推荐）

将 Common 代码合并到每个使用它的通道中：

```typescript
const commonCode = `
mat2 rotation(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
}

vec3 hachage33(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yxz + 19.19);
    return fract((p.xxy + p.yxx) * p.zyx);
}
// ... 其他公共函数
`

const bufferACode = commonCode + `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // 使用 Common 中定义的函数
    vec2 uv = fragCoord / iResolution.xy;
    vec2 rotated = rotation(iTime) * uv;  // 调用公共函数
    fragColor = vec4(rotated, 0.0, 1.0);
}
`
```

#### 方式 2: 使用 Vite 导入

将 Common 保存为独立文件，在构建时导入：

```typescript
// metaShader_common.glsl
mat2 rotation(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
}

// index.ts
import commonCode from './metaShader_common.glsl?raw'
import bufferACodeRaw from './metaShader_bufferA.glsl?raw'

const bufferACode = commonCode + '\n' + bufferACodeRaw
```

#### 完整示例：MetaShader 多通道配置

```typescript
import commonCode from './metaShader_common.glsl?raw'
import bufferACodeRaw from './metaShader_bufferA.glsl?raw'
import imageCodeRaw from './metaShader_image.glsl?raw'

// 合并 Common 代码
const bufferACode = commonCode + '\n' + bufferACodeRaw
const imageCode = commonCode + '\n' + imageCodeRaw

const metaShaderPreset: ShaderPreset = {
  id: 'metaShader',
  name: 'MetaShader',
  author: 'Patrick JAILLET',
  passes: [
    {
      id: 'bufferA',
      type: 'BufferA',
      code: bufferACode,
      inputs: [
        { channel: 0, source: 'self' }  // 自反馈
      ]
    },
    {
      id: 'image',
      type: 'Image',
      code: imageCode,
      inputs: [
        { channel: 0, source: 'bufferA' }  // 读取 BufferA 输出
      ]
    }
  ]
}
```

**关键点**:
- Common 通道本身**不需要 inputs 配置**
- Common 代码必须**合并到每个使用它的通道**
- 自反馈使用 `source: 'self'`
- 引用其他 Buffer 使用 `source: 'bufferId'`

**调试 Common 问题**:
```glsl
// 如果出现 "undefined function" 错误
// 检查 Common 代码是否已合并到当前通道

// 在 shader 开头添加调试
#pragma glslify: rotation = require('./common.glsl')
// 或者直接在代码中定义
```

### 问题 7: fragCoord 坐标偏差

**现象**: Shader 渲染结果与 ShaderToy 原始效果有微小偏差

**原因**: `fragCoord` 应该是像素中心坐标

**解决方案**:
```glsl
// ❌ 错误写法
vec2 fragCoord = materialInput.st * u_resolution;

// ✅ 正确写法（加上 0.5）
vec2 fragCoord = materialInput.st * u_resolution + 0.5;
```

这确保 `fragCoord` 位于像素中心，与 ShaderToy 的行为一致。

---

## 进阶技巧

### 技巧 1: 坐标系转换

对于需要在 3D 世界中定位效果的 shader，需要将世界坐标转换为 UV：

```glsl
// 在 Cesium shader 中
// p 是世界坐标
vec2 uv = (p.xz - u_aabbMin.xz) / (u_aabbMax.xz - u_aabbMin.xz);
```

### 技巧 2: 水面效果移植

参考 [从 ShaderToy 到 Cesium：如何移植「实时焦散水面」Shader](https://mp.weixin.qq.com/s/zSAzxCtOIVmPd__YmzIpOw)，水面效果需要：

1. **程序化波浪**: 多层正弦波叠加
2. **焦散效果**: 波浪高度转换为光斑
3. **折射扰动**: UV 坐标偏移
4. **动态法线**: 像素差分计算

### 技巧 3: 从 ShaderToy API 获取代码

```typescript
// ShaderToy API
const response = await fetch(
  `https://www.shadertoy.com/api/v1/shaders/${shaderId}?key=${apiKey}`
)
const data = await response.json()
const code = data.Shader.renderpass[0].code
```

注意：需要配置 CORS 代理或使用开发服务器代理。

### 技巧 4: 性能优化

1. **减少 uniform 更新频率**: 只在需要时更新
2. **简化几何体**: 使用 LOD 或简化几何
3. **使用 `asynchronous: false`**: 同步创建 Primitive 避免闪烁

---

## 完整示例

### 最小可运行示例

```typescript
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

// 1. 初始化 Viewer
const viewer = new Cesium.Viewer('cesiumContainer', {
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  sceneModePicker: false,
  navigationHelpButton: false,
  animation: false,
  timeline: false,
})

// 2. ShaderToy 代码
const shaderToyCode = `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0, 2, 4));
    fragColor = vec4(col, 1.0);
}
`

// 3. 转换为 Cesium shader
const fragmentShader = `
uniform float u_time;
uniform vec2 u_resolution;
#define iTime u_time
#define iResolution u_resolution

${shaderToyCode}

czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material material = czm_getDefaultMaterial(materialInput);
    // fragCoord 必须加上 0.5 以获取像素中心坐标
    vec2 fragCoord = materialInput.st * u_resolution + 0.5;
    vec4 fragColor;
    mainImage(fragColor, fragCoord);
    material.diffuse = fragColor.rgb;
    material.alpha = fragColor.a;
    return material;
}
`

// 4. 创建 Material
const material = new Cesium.Material({
  fabric: {
    type: 'ShaderToy',
    uniforms: {
      u_time: 0,
      u_resolution: new Cesium.Cartesian2(800, 600),
    },
    source: fragmentShader,
  },
})

// 5. 创建几何体
const position = Cesium.Cartesian3.fromDegrees(116.39, 39.90, 500000)
const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(position)

const primitive = viewer.scene.primitives.add(
  new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      geometry: new Cesium.SphereGeometry({ radius: 200000 }),
      modelMatrix: modelMatrix,
    }),
    appearance: new Cesium.MaterialAppearance({
      material: material,
      faceForward: true,
    }),
    asynchronous: false,
  })
)

// 6. 动画循环
const startTime = Date.now()
function animate() {
  material.uniforms.u_time = (Date.now() - startTime) / 1000
  material.uniforms.u_resolution.x = viewer.canvas.width
  material.uniforms.u_resolution.y = viewer.canvas.height
  requestAnimationFrame(animate)
}
animate()

// 7. 相机定位
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(116.38, 39.89, 1000000),
  orientation: {
    heading: 0,
    pitch: -Math.PI / 4,
    roll: 0,
  },
})
```

---

## 项目资源

- [本项目源码](https://github.com/Sogrey/vue-cesium-shadertoy)
- [ShaderToy 官网](https://www.shadertoy.com/)
- [Cesium 官方文档](https://cesium.com/learn/)
- [参考文章：从 ShaderToy 到 Cesium：如何移植「实时焦散水面」Shader](https://mp.weixin.qq.com/s/zSAzxCtOIVmPd__YmzIpOw)

---

## 总结

移植 ShaderToy shader 到 Cesium 的核心要点：

1. **包装入口函数**: 将 `mainImage` 包装到 `czm_getMaterial`
2. **映射 Uniform**: `iTime` → `u_time`, `iResolution` → `Cartesian2`, `iMouse` → `Cartesian4`
3. **坐标转换**: `materialInput.st` × `u_resolution` + 0.5 → `fragCoord`（像素中心）
4. **WebGL 2.0**: 使用 `texture()` 而非 `texture2D()`，支持 `texelFetch()`
5. **动画更新**: 在 `requestAnimationFrame` 中更新时间 uniform
6. **多通道支持**: 使用 `MultipassRenderer` 实现 Buffer 链
7. **正确放置几何体**: 使用 ENU 坐标系和合理的相机位置

---

*文档版本: 1.1.0*  
*最后更新: 2026-03-30*
