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
import renkliTaslarCode from './renkliTaslar.glsl?raw'
import shaderArtIntroCode from './shaderArtIntro.glsl?raw'
import zero7Code from './zero7.glsl?raw'
import selfReflectCode from './selfReflect.glsl?raw'
import rocailleCode from './rocaille.glsl?raw'
import cosmicPearlBufferA from './cosmicPearl_bufferA.glsl?raw'
import cosmicPearlImage from './cosmicPearl_image.glsl?raw'

/**
 * 辅助函数：创建单通道预设
 */
function createSinglePassPreset(
  id: string,
  name: string,
  author: string,
  code: string
): ShaderPreset {
  return {
    id,
    name,
    author,
    passes: [
      {
        id: 'image',
        type: 'Image',
        code,
        inputs: [],
      },
    ],
  }
}

/**
 * 所有预设 Shader 列表
 */
export const shaderPresets: ShaderPreset[] = [
  // 单通道预设
  createSinglePassPreset('plasma', '等离子体', 'ShaderToy', plasmaCode),
  createSinglePassPreset('fractal', '分形波纹', 'ShaderToy', fractalCode),
  createSinglePassPreset('neon', '霓虹隧道', 'ShaderToy', neonCode),
  createSinglePassPreset('waves', '波浪', 'ShaderToy', wavesCode),
  createSinglePassPreset('windows95', 'Windows 95', 'ShaderToy', windows95Code),
  createSinglePassPreset('loopingSpline', '循环样条', 'Sébastien Bérubé', loopingSplineCode),
  createSinglePassPreset('renkliTaslar', '彩色石头', 'ShaderToy', renkliTaslarCode),
  createSinglePassPreset('shaderArtIntro', 'Shader 艺术入门', 'Kishimisu', shaderArtIntroCode),
  createSinglePassPreset('zero7', 'Zero7', 'ShaderToy', zero7Code),
  createSinglePassPreset('selfReflect', '自我反射', 'ShaderToy', selfReflectCode),
  createSinglePassPreset('rocaille', 'Rocaille', 'XorDev', rocailleCode),

  // 多通道预设
  {
    id: 'multipassFeedback',
    name: '多通道反馈（演示）',
    author: 'Demo',
    passes: [
      {
        id: 'bufferA',
        type: 'BufferA',
        code: `
// Buffer A - 简单的反馈测试
void mainImage(out vec4 O, vec2 I)
{
    vec2 uv = I / iResolution.xy;

    // 从上一帧读取（自反馈）
    vec4 prev = texture(iChannel0, uv);

    // 简单的衰减 + 新颜色（更明显的效果）
    vec3 newColor = vec3(uv.x, uv.y, 0.5 + 0.5 * sin(iTime));
    O = mix(prev, vec4(newColor, 1.0), 0.03);
}
`,
        inputs: [
          { channel: 0, source: 'self' },
        ],
      },
      {
        id: 'image',
        type: 'Image',
        code: `
// Image 通道 - 显示 Buffer A 的结果
void mainImage(out vec4 O, vec2 I)
{
    vec2 uv = I / iResolution.xy;
    O = texture(iChannel0, uv);
}
`,
        inputs: [
          { channel: 0, source: 'bufferA' },
        ],
      },
    ],
  },
  {
    id: 'cosmicPearl',
    name: 'Cosmic Pearl',
    author: 'Nishitsuji',
    passes: [
      {
        id: 'bufferA',
        type: 'BufferA',
        code: cosmicPearlBufferA,
        inputs: [
          { channel: 0, source: 'self' },
        ],
      },
      {
        id: 'image',
        type: 'Image',
        code: cosmicPearlImage,
        inputs: [
          { channel: 0, source: 'bufferA' },
        ],
      },
    ],
  },
]

/**
 * 判断预设是否为多通道
 */
export function isMultipassPreset(preset: ShaderPreset): boolean {
  if (!preset.passes) return false
  return preset.passes.some(p => p.type.startsWith('Buffer'))
}

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
