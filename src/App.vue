<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import CesiumViewer from './components/CesiumViewer.vue'
import ControlPanel from './components/ControlPanel.vue'
import type { GeometryType, PassConfig } from './types'

// 初始为空，等待 ControlPanel 初始化
const shaderCode = ref('')
const geometryType = ref<GeometryType>('plane')
const isPlaying = ref(true)
const passes = ref<PassConfig[]>([])
const needRender = ref(0)

// 移动端控制面板展开/收起状态
const isPanelOpen = ref(false)
const isMobile = ref(false)

// 检测移动端
function checkMobile() {
  isMobile.value = window.innerWidth <= 768
  // 桌面端自动展开，移动端默认收起
  if (!isMobile.value) {
    isPanelOpen.value = true
  }
}

// 切换控制面板
function togglePanel() {
  isPanelOpen.value = !isPanelOpen.value
}

// 手动触发重渲染
function handleRender() {
  needRender.value++
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<template>
  <div class="app-container">
    <!-- 移动端切换按钮 -->
    <button
      v-if="isMobile"
      class="toggle-panel-btn"
      @click="togglePanel"
      :title="isPanelOpen ? '收起面板' : '展开面板'"
    >
      <span class="hamburger" :class="{ 'is-open': isPanelOpen }">
        <span></span>
        <span></span>
        <span></span>
      </span>
    </button>

    <!-- 遮罩层（移动端） -->
    <div
      v-if="isMobile && isPanelOpen"
      class="panel-overlay"
      @click="togglePanel"
    ></div>

    <!-- 控制面板 -->
    <ControlPanel
      :class="['control-panel', { 'panel-open': isPanelOpen, 'panel-closed': !isPanelOpen }]"
      @update:shader-code="val => shaderCode = val"
      @update:geometry-type="val => geometryType = val"
      @update:is-playing="val => isPlaying = val"
      @update:passes="val => passes = val"
      @render="handleRender"
    />

    <!-- Cesium 渲染区域 -->
    <CesiumViewer
      class="cesium-viewer"
      :shader-code="shaderCode"
      :geometry-type="geometryType"
      :is-playing="isPlaying"
      :passes="passes"
      :need-render="needRender"
      @render="handleRender"
    />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.app-container {
  display: flex;
  width: 100%;
  height: 100vh;
  background: #1a1a2e;
  position: relative;
}

/* 桌面端布局 */
@media (min-width: 769px) {
  .control-panel {
    width: 400px;
    height: 100%;
    overflow-y: auto;
    background: #16213e;
    border-right: 1px solid #0f3460;
    transition: transform 0.3s ease;
  }

  .toggle-panel-btn {
    display: none;
  }

  .panel-overlay {
    display: none;
  }

  .cesium-viewer {
    flex: 1;
    height: 100%;
  }
}

/* 移动端布局 */
@media (max-width: 768px) {
  .cesium-viewer {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
  }

  /* 切换按钮 */
  .toggle-panel-btn {
    position: fixed;
    top: 20px;
    left: 20px;
    z-index: 1001;
    width: 52px;
    height: 52px;
    border: none;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  }

  .toggle-panel-btn:hover {
    transform: scale(1.05) rotate(90deg);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
  }

  .toggle-panel-btn:active {
    transform: scale(0.95);
  }

  /* 汉堡菜单图标 */
  .hamburger {
    width: 20px;
    height: 14px;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .hamburger span {
    display: block;
    width: 100%;
    height: 2px;
    background: white;
    border-radius: 2px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform-origin: center;
  }

  .hamburger.is-open span:nth-child(1) {
    transform: translateY(6px) rotate(45deg);
  }

  .hamburger.is-open span:nth-child(2) {
    opacity: 0;
    transform: scaleX(0);
  }

  .hamburger.is-open span:nth-child(3) {
    transform: translateY(-6px) rotate(-45deg);
  }

  /* 遮罩层 */
  .panel-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 998;
    backdrop-filter: blur(2px);
  }

  /* 控制面板 */
  .control-panel {
    position: fixed;
    top: 0;
    left: 0;
    width: 320px;
    max-width: 85vw;
    height: 100%;
    overflow-y: auto;
    background: #16213e;
    z-index: 999;
    transform: translateX(0);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.5);
  }

  .control-panel.panel-closed {
    transform: translateX(-100%);
  }

  .control-panel.panel-open {
    transform: translateX(0);
  }
}
</style>
