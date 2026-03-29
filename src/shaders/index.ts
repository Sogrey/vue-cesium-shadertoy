/**
 * Shader 预设集合
 * 
 * 使用 Vite 的 ?raw 后缀导入 glsl 文件作为字符串
 * 文档: https://vitejs.dev/guide/assets.html#importing-asset-as-string
 */

import type { ShaderPreset } from '@/types'

// 导入 glsl 文件（作为原始字符串）
import plasmaCode from './plasma.glsl?raw'
import fractalCode from './fractal.glsl?raw'
import neonCode from './neon.glsl?raw'
import wavesCode from './waves.glsl?raw'
import windows95Code from './windows95.glsl?raw'
import loopingSplineCode from './loopingSpline.glsl?raw'

/**
 * 所有预设 Shader 列表
 */
export const shaderPresets: ShaderPreset[] = [
  {
    id: 'plasma',
    name: '等离子体',
    author: 'ShaderToy',
    code: plasmaCode,
  },
  {
    id: 'fractal',
    name: '分形波纹',
    author: 'ShaderToy',
    code: fractalCode,
  },
  {
    id: 'neon',
    name: '霓虹隧道',
    author: 'ShaderToy',
    code: neonCode,
  },
  {
    id: 'waves',
    name: '波浪',
    author: 'ShaderToy',
    code: wavesCode,
  },
  {
    id: 'windows95',
    name: 'Windows 95',
    author: 'ShaderToy',
    code: windows95Code,
  },
  {
    id: 'loopingSpline',
    name: '循环样条',
    author: 'Sébastien Bérubé',
    code: loopingSplineCode,
  },
]

/**
 * 根据 ID 获取预设 Shader
 */
export function getPresetById(id: string): ShaderPreset | undefined {
  return shaderPresets.find((preset) => preset.id === id)
}

/**
 * 获取所有预设 ID
 */
export function getPresetIds(): string[] {
  return shaderPresets.map((preset) => preset.id)
}
