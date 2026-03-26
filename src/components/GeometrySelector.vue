<script setup lang="ts">
import type { GeometryType } from '@/types'

const props = defineProps<{
  modelValue: GeometryType
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: GeometryType): void
}>()

const geometries: { type: GeometryType; name: string; icon: string }[] = [
  { type: 'plane', name: '平面', icon: '📐' },
  { type: 'sphere', name: '球体', icon: '🔮' },
  { type: 'cube', name: '立方体', icon: '📦' },
  { type: 'cylinder', name: '圆柱体', icon: '🥫' },
]

function select(type: GeometryType) {
  emit('update:modelValue', type)
}
</script>

<template>
  <div class="geometry-selector">
    <button
      v-for="geo in geometries"
      :key="geo.type"
      :class="['geo-btn', { active: modelValue === geo.type }]"
      @click="select(geo.type)"
    >
      <span class="icon">{{ geo.icon }}</span>
      <span class="name">{{ geo.name }}</span>
    </button>
  </div>
</template>

<style scoped>
.geometry-selector {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.geo-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 12px;
  border: 2px solid #0f3460;
  background: #1a1a2e;
  color: #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.geo-btn:hover {
  border-color: #00d9ff;
  background: #16213e;
  transform: translateY(-2px);
}

.geo-btn.active {
  border-color: #00d9ff;
  background: linear-gradient(135deg, #0f3460 0%, #1a1a2e 100%);
  box-shadow: 0 4px 12px rgba(0, 217, 255, 0.2);
}

.icon {
  font-size: 24px;
}

.name {
  font-size: 13px;
  font-weight: 500;
}
</style>
