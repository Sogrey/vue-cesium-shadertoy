<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { convertShaderToyToCesium, createCesiumMaterial } from '@/utils/shaderConverter'
import { createGeometry, createPrimitive } from '@/utils/geometryFactory'
import type { GeometryType, PassConfig } from '@/types'

// 配置 Cesium Ion Access Token
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3ODZkMDQzOS03ZGJjLTQzZWUtYjlmYy04ZmM5Y2UwNzNhMmYiLCJpZCI6MjU5LCJpYXQiOjE2MzgyMDYwMDB9.cK1hsaFBgz0l2dG9Ry5vBFHWp-HF2lwjLC0tcK8Z8tY'

const props = defineProps<{
  shaderCode: string
  geometryType: GeometryType
  isPlaying: boolean
  passes?: PassConfig[]
}>()

const containerRef = ref<HTMLDivElement>()
let viewer: Cesium.Viewer | null = null
let primitive: Cesium.Primitive | null = null
let animationFrameId: number | null = null
let startTime = Date.now()
const mousePos = { x: 0, y: 0, z: 0, w: 0 }

// TODO: 多通道 FBO 渲染将在后续版本实现
// 当前版本仅支持单通道预览，多通道 shader 需要在外部项目中使用

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

  // 初始创建
  updatePrimitive()

  // 开始动画循环（如果正在播放）
  if (props.isPlaying) {
    startAnimation()
  }
})

onUnmounted(() => {
  stopAnimation()
  if (viewer) {
    viewer.destroy()
    viewer = null
  }
})

watch(() => props.shaderCode, updatePrimitive)
watch(() => props.geometryType, updatePrimitive)
watch(() => props.passes, (newPasses) => {
  // 多通道模式：只渲染 Image 通道
  if (newPasses && newPasses.length > 0) {
    const imagePass = newPasses.find(p => p.type === 'Image')
    if (imagePass) {
      updatePrimitive(imagePass.code)
    }
  }
}, { deep: true })
watch(() => props.isPlaying, (playing) => {
  if (playing) {
    startTime = Date.now() - pausedTime // 恢复时从暂停位置继续
    startAnimation()
  } else {
    stopAnimation()
  }
})

let pausedTime = 0 // 记录暂停时的时间偏移

function startAnimation() {
  const animate = () => {
    if (!viewer || !primitive) return
    
    // 检查是否暂停
    if (!props.isPlaying) {
      return
    }

    // 更新 material uniforms
    if (primitive.appearance) {
      const appearance = primitive.appearance as Cesium.MaterialAppearance
      if (appearance.material) {
        const material = appearance.material
        material.uniforms.u_time = (Date.now() - startTime) / 1000
        
        // 更新 resolution (Cartesian2)
        if (material.uniforms.u_resolution) {
          material.uniforms.u_resolution.x = viewer.canvas.width
          material.uniforms.u_resolution.y = viewer.canvas.height
        }
        
        // 更新 mouse (Cartesian4)
        if (material.uniforms.u_mouse) {
          material.uniforms.u_mouse.x = mousePos.x
          material.uniforms.u_mouse.y = mousePos.y
          material.uniforms.u_mouse.z = mousePos.z
          material.uniforms.u_mouse.w = mousePos.w
        }
        
        // 记录当前时间偏移（用于暂停恢复）
        pausedTime = material.uniforms.u_time
      }
    }

    animationFrameId = requestAnimationFrame(animate)
  }

  animate()
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
  const cameraLongitude = geoPosition.longitude - 0.01 * distance / 111000 // 约 1° = 111km
  const cameraLatitude = geoPosition.latitude - 0.008 * distance / 111000
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

  // 移除旧的 primitive
  if (primitive) {
    viewer.scene.primitives.remove(primitive)
  }

  try {
    // 使用传入的 shader 或 props 中的 shader
    const code = shaderOverride || props.shaderCode
    
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
  } catch (error) {
    console.error('Shader 编译错误:', error)
  }
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
