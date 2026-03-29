<script setup lang="ts">
import { ref } from 'vue'
import CesiumViewer from './components/CesiumViewer.vue'
import ControlPanel from './components/ControlPanel.vue'
import type { GeometryType, PassConfig } from './types'

const shaderCode = ref(`
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.xy;
    fragColor = vec4(uv.x, uv.y, 0.5 + 0.5 * sin(iTime), 1.0);
}
`)
const geometryType = ref<GeometryType>('plane')
const isPlaying = ref(true)
const passes = ref<PassConfig[]>([])
</script>

<template>
  <div class="app-container">
    <ControlPanel
      class="control-panel"
      @update:shader-code="shaderCode = $event"
      @update:geometry-type="geometryType = $event"
      @update:is-playing="isPlaying = $event"
      @update:passes="passes = $event"
    />
    <CesiumViewer
      class="cesium-viewer"
      :shader-code="shaderCode"
      :geometry-type="geometryType"
      :is-playing="isPlaying"
      :passes="passes"
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
}

.control-panel {
  width: 400px;
  height: 100%;
  overflow-y: auto;
  background: #16213e;
  border-right: 1px solid #0f3460;
}

.cesium-viewer {
  flex: 1;
  height: 100%;
}
</style>
