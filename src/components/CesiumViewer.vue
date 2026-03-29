<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { convertShaderToyToCesium, createCesiumMaterial } from '@/utils/shaderConverter'
import { createGeometry, createPrimitive } from '@/utils/geometryFactory'
import { MultipassRenderer } from '@/utils/multipassRenderer'
import type { GeometryType, PassConfig } from '@/types'

// 配置 Cesium Ion Access Token
Cesium.Ion.defaultAccessToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3ODZkMDQzOS03ZGJjLTQzZWUtYjlmYy04ZmM5Y2UwNzNhMmYiLCJpZCI6MjU5LCJpYXQiOjE2MzgyMDYwMDB9.cK1hsaFBgz0l2dG9Ry5vBFHWp-HF2lwjLC0tcK8Z8tY'

const props = defineProps<{
  shaderCode: string
  geometryType: GeometryType
  isPlaying: boolean
  passes?: PassConfig[]
  needRender?: number
}>()

const containerRef = ref<HTMLDivElement>()
let viewer: Cesium.Viewer | null = null
let primitive: Cesium.Primitive | null = null
let animationFrameId: number | null = null
let startTime = Date.now()
const mousePos = { x: 0, y: 0, z: 0, w: 0 }

// 多通道渲染器
let multipassRenderer: MultipassRenderer | null = null
// Cesium 纹理缓存
const cesiumTextures: Map<string, unknown> = new Map()

onMounted(() => {
  if (!containerRef.value) return

  // 初始化 Cesium Viewer
  viewer = new Cesium.Viewer(containerRef.value, {
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    vrButton: false,
    infoBox: false,
    selectionIndicator: false,
    shadows: false,
    shouldAnimate: true,
  })

  // 设置背景色
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0f0f23')

  // 移除默认图层
  viewer.imageryLayers.removeAll()

  // 鼠标交互
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    if (movement?.position) {
      mousePos.x = movement.position.x
      mousePos.y = viewer!.canvas.height - movement.position.y
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

  handler.setInputAction(() => {
    mousePos.z = mousePos.x
    mousePos.w = mousePos.y
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN)

  // 初始创建 - 等待 needRender 触发
  // updatePrimitive()

  // 开始动画循环（如果正在播放）
  if (props.isPlaying) {
    startAnimation()
  }
})

onUnmounted(() => {
  stopAnimation()
  multipassRenderer?.destroy()
  multipassRenderer = null
  if (viewer) {
    viewer.destroy()
    viewer = null
  }
})

// 监听几何体类型变化（需要自动更新）
watch(() => props.geometryType, updatePrimitive)

// 监听手动重渲染信号
watch(
  () => props.needRender,
  () => {
    // 多通道模式
    if (props.passes && props.passes.length > 0) {
      updateMultipassPrimitive()
      return
    }
    // 单通道模式
    if (props.shaderCode) {
      updatePrimitive()
    }
  },
  { immediate: true },
)

// 监听播放状态
watch(
  () => props.isPlaying,
  (playing) => {
    if (playing) {
      startTime = Date.now() - pausedTime // 恢复时从暂停位置继续
      startAnimation()
    } else {
      stopAnimation()
    }
  },
)

let pausedTime = 0 // 记录暂停时的时间偏移

function startAnimation() {
  const animate = () => {
    if (!viewer || !primitive) return

    // 检查是否暂停
    if (!props.isPlaying) {
      return
    }

    const currentTime = (Date.now() - startTime) / 1000

    // 多通道模式：先渲染 Buffer passes
    if (props.passes && props.passes.length > 0 && multipassRenderer) {
      renderMultipassBuffers(currentTime)
    }

    // 更新 material uniforms
    if (primitive.appearance) {
      const appearance = primitive.appearance as Cesium.MaterialAppearance
      if (appearance.material) {
        const material = appearance.material
        material.uniforms.u_time = currentTime

        // 更新 resolution
        if (material.uniforms.u_resolution) {
          material.uniforms.u_resolution.x = viewer.canvas.width
          material.uniforms.u_resolution.y = viewer.canvas.height
        }

        // 更新 mouse
        if (material.uniforms.u_mouse) {
          material.uniforms.u_mouse.x = mousePos.x
          material.uniforms.u_mouse.y = mousePos.y
          material.uniforms.u_mouse.z = mousePos.z
          material.uniforms.u_mouse.w = mousePos.w
        }

        // 更新 frame
        if (material.uniforms.u_frame !== undefined) {
          material.uniforms.u_frame = multipassRenderer?.getFrameCount() || 0
        }

        // 多通道模式：更新 iChannel 纹理
        if (props.passes && multipassRenderer) {
          updateChannelTextures(material)
        }

        // 记录当前时间偏移
        pausedTime = material.uniforms.u_time
      }
    }

    // 递增帧计数
    multipassRenderer?.incrementFrame()

    animationFrameId = requestAnimationFrame(animate)
  }

  animate()
}

/**
 * 渲染多通道 Buffer passes
 */
function renderMultipassBuffers(time: number) {
  if (!props.passes || !multipassRenderer) return

  const bufferPasses = props.passes.filter((p) => p.type.startsWith('Buffer'))

  for (const pass of bufferPasses) {
    multipassRenderer.renderBufferPass(pass, {
      time,
      resolution: [viewer!.canvas.width, viewer!.canvas.height, 1],
      mouse: [mousePos.x, mousePos.y, mousePos.z, mousePos.w],
    })
  }
}

/**
 * 更新 iChannel 纹理到材质
 */
function updateChannelTextures(material: Cesium.Material) {
  if (!props.passes || !multipassRenderer || !viewer) return

  const imagePass = props.passes.find((p) => p.type === 'Image')
  if (!imagePass) return

  const width = viewer.canvas.width
  const height = viewer.canvas.height

  // 为每个 input 设置纹理
  for (const input of imagePass.inputs) {
    const uniformName = `iChannel${input.channel}`

    // 读取 FBO 纹理内容
    const pixels = multipassRenderer.readPassPixels(input.source)
    if (!pixels) continue

    // 获取或创建 Cesium Texture
    let cesiumTexture = cesiumTextures.get(input.source)

    if (!cesiumTexture) {
      // 创建新的 Cesium Texture - 使用内部 API
      const CesiumInternal = Cesium as Record<string, unknown>
      const context = (viewer!.scene as unknown as Record<string, unknown>).context

      if (context && CesiumInternal.Texture) {
        const Texture = CesiumInternal.Texture as new (options: unknown) => unknown
        const Sampler = CesiumInternal.Sampler as new (options: unknown) => unknown

        cesiumTexture = new Texture({
          context: context,
          width: width,
          height: height,
          pixelFormat: (CesiumInternal.PixelFormat as Record<string, unknown>).RGBA,
          pixelDatatype: (CesiumInternal.PixelDatatype as Record<string, unknown>).UNSIGNED_BYTE,
          sampler: new Sampler({
            wrapS: (CesiumInternal.TextureWrap as Record<string, unknown>).REPEAT,
            wrapT: (CesiumInternal.TextureWrap as Record<string, unknown>).REPEAT,
            minificationFilter: (
              CesiumInternal.TextureMinificationFilter as Record<string, unknown>
            ).LINEAR,
            magnificationFilter: (
              CesiumInternal.TextureMagnificationFilter as Record<string, unknown>
            ).LINEAR,
          }),
        })
        cesiumTextures.set(input.source, cesiumTexture)

        // 首次创建时设置到材质
        material.uniforms[uniformName] = cesiumTexture
      }
    }

    // 更新 Cesium 纹理内容（不重新赋值）
    if (cesiumTexture) {
      const textureObj = cesiumTexture as Record<string, unknown>
      const webglTexture = textureObj._texture as WebGLTexture | undefined

      if (webglTexture) {
        // 使用 Cesium 的 context 来更新纹理
        const gl = multipassRenderer['gl'] as WebGL2RenderingContext
        gl.bindTexture(gl.TEXTURE_2D, webglTexture)
        // 不翻转像素数据，因为OpenGL纹理坐标原点在左下角
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
        gl.bindTexture(gl.TEXTURE_2D, null)
      }
    }
  }
}

function stopAnimation() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

// 几何体放置位置（经纬度 + 高度）
const geoPosition = {
  longitude: 116.3912, // 北京附近
  latitude: 39.9062,
  height: 500000, // 地面上方 500km
}

// 根据几何体类型获取相机距离配置
function getCameraDistance(type: GeometryType): number {
  const baseDistance = 600000 // 基础距离 600km

  // 不同几何体的观看距离倍数
  const multipliers: Record<GeometryType, number> = {
    plane: 2.5,
    sphere: 2.0,
    cube: 2.2,
    cylinder: 2.0,
  }

  return baseDistance * multipliers[type]
}

// 定位相机到几何体
function focusOnGeometry(type: GeometryType) {
  if (!viewer) return

  const distance = getCameraDistance(type)

  // 相机位置：在几何体位置上方，并偏移一定距离
  const cameraLongitude = geoPosition.longitude - (0.01 * distance) / 111000 // 约 1° = 111km
  const cameraLatitude = geoPosition.latitude - (0.008 * distance) / 111000
  const cameraHeight = geoPosition.height + distance * 0.8

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(cameraLongitude, cameraLatitude, cameraHeight),
    orientation: {
      heading: Math.PI / 6,
      pitch: type === 'plane' ? -Math.PI / 2 : -Math.PI / 3.5,
      roll: 0,
    },
    duration: 1.5,
  })
}

function updatePrimitive(shaderOverride?: string) {
  if (!viewer) return

  // 使用传入的 shader 或 props 中的 shader
  const code = shaderOverride || props.shaderCode
  
  // 验证 shader code
  if (!code || code.trim().length === 0) {
    console.warn('[CesiumViewer] Shader code is empty, skipping update')
    return
  }
  
  // 检测是否为几何体类型名称（错误情况）
  if (['plane', 'sphere', 'cube', 'cylinder'].includes(code)) {
    console.error('[CesiumViewer] Invalid shader code - geometry type name received:', code)
    return
  }

  // 移除旧的 primitive
  if (primitive) {
    viewer.scene.primitives.remove(primitive)
  }

  try {
    // 转换 shader
    const fragmentShader = convertShaderToyToCesium(code)

    // 创建材质
    const material = createCesiumMaterial(Cesium, fragmentShader, {
      iTime: 0,
      iResolution: [viewer.canvas.width, viewer.canvas.height, 1],
      iMouse: [0, 0, 0, 0],
      iFrame: 0,
    })

    // 创建几何体
    const geometryInstance = createGeometry(
      Cesium,
      props.geometryType,
      200000, // 缩放比例
      geoPosition, // 放置位置
    )

    // 创建 primitive
    primitive = createPrimitive(Cesium, geometryInstance, material)
    viewer.scene.primitives.add(primitive)

    // 定位相机到几何体
    focusOnGeometry(props.geometryType)

    // 如果正在播放但动画循环未运行，启动动画
    if (props.isPlaying && !animationFrameId) {
      startAnimation()
    }
  } catch (error) {
    console.error('Shader 编译错误:', error)
  }
}

/**
 * 更新多通道 Primitive
 */
function updateMultipassPrimitive() {
  if (!viewer || !props.passes || props.passes.length === 0) return

  // 清理旧的纹理缓存
  cesiumTextures.clear()

  // 销毁旧的多通道渲染器（切换预设时需要完全重建）
  if (multipassRenderer) {
    multipassRenderer.destroy()
    multipassRenderer = null
  }

  // 获取 Cesium 的 WebGL context
  const canvas = viewer.canvas
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')

  // 创建新的多通道渲染器
  if (gl) {
    multipassRenderer = new MultipassRenderer(
      gl as WebGL2RenderingContext,
      canvas.width,
      canvas.height,
    )
  }

  // 初始化通道 FBO
  multipassRenderer?.initPasses(props.passes)

  // 销毁旧的 primitive
  if (primitive) {
    viewer.scene.primitives.remove(primitive)
  }

  // 获取 Image 通道
  const imagePass = props.passes.find((p) => p.type === 'Image')
  if (!imagePass || !imagePass.code) {
    console.warn('未找到 Image 通道')
    return
  }

  // 转换 Image shader（添加 iChannel 支持）
  const fragmentShader = convertMultipassShader(imagePass.code)

  // 获取需要初始化的通道索引
  const channels = imagePass.inputs.map((input) => input.channel)

  try {
    // 创建材质
    const material = createCesiumMaterial(
      Cesium,
      fragmentShader,
      {
        iTime: 0,
        iResolution: [viewer.canvas.width, viewer.canvas.height, 1],
        iMouse: [0, 0, 0, 0],
        iFrame: 0,
      },
      channels,
    )

    // 创建几何体
    const geometryInstance = createGeometry(Cesium, props.geometryType, 200000, geoPosition)

    // 创建 primitive
    primitive = createPrimitive(Cesium, geometryInstance, material)
    viewer.scene.primitives.add(primitive)

    // 定位相机
    focusOnGeometry(props.geometryType)

    // 启动动画
    if (props.isPlaying && !animationFrameId) {
      startAnimation()
    }
  } catch (error) {
    console.error('多通道 Shader 编译错误:', error)
    console.error('Image Pass:', imagePass)
    console.error('Fragment Shader:', fragmentShader)
  }
}

/**
 * 转换多通道 Shader（添加纹理 uniform）
 */
function convertMultipassShader(code: string): string {
  // 检测需要的通道索引
  const channels: number[] = []
  for (let i = 0; i < 4; i++) {
    if (code.includes(`iChannel${i}`)) {
      channels.push(i)
    }
  }

  // 使用支持 channels 的转换函数
  return convertShaderToyToCesium(code, channels)
}
</script>

<template>
  <div ref="containerRef" class="cesium-container"></div>
</template>

<style scoped>
.cesium-container {
  width: 100%;
  height: 100%;
}
</style>
