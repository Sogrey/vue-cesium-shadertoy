<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const code = ref(props.modelValue)

watch(
  () => props.modelValue,
  (newVal) => {
    code.value = newVal
  },
)

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  code.value = target.value
  emit('update:modelValue', target.value)
}
</script>

<template>
  <div class="editor-container">
    <textarea
      :value="code"
      class="code-editor"
      spellcheck="false"
      @input="handleInput"
    ></textarea>
  </div>
</template>

<style scoped>
.editor-container {
  position: relative;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #0f3460;
}

.code-editor {
  width: 100%;
  height: 300px;
  padding: 12px;
  background: #0d1117;
  color: #c9d1d9;
  border: none;
  resize: vertical;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
  outline: none;
}

.code-editor:focus {
  box-shadow: 0 0 0 2px rgba(0, 217, 255, 0.3);
}
</style>
