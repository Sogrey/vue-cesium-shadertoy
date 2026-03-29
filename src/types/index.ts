// 几何体类型
export type GeometryType = 'plane' | 'sphere' | 'cube' | 'cylinder'

// ShaderToy Uniforms
export interface ShaderToyUniforms {
  iTime: number
  iResolution: [number, number, number]
  iMouse: [number, number, number, number]
  iFrame: number
}

/**
 * 通道类型（对应 ShaderToy 的 Pass 类型）
 *
 * - Image: 最终图像输出（必须有一个）
 * - BufferA/B/C/D: 离屏缓冲区，用于多通道渲染
 * - Common: 公共代码，可被其他通道引用
 * - Sound: 音频输出通道
 * - CubemapA: 立方体贴图通道
 */
export type PassType =
  | 'BufferA'
  | 'BufferB'
  | 'BufferC'
  | 'BufferD'
  | 'Image'
  | 'Common'
  | 'Sound'
  | 'CubemapA'

// 通道输入源
export interface PassInput {
  channel: number // 0-3 对应 iChannel0-iChannel3
  source: string // 引用哪个 pass 的 id，如 'BufferA'，或 'self' 表示自反馈
}

// 单个通道配置
export interface PassConfig {
  id: string // 通道唯一标识
  type: PassType // 通道类型
  code: string // GLSL 代码
  inputs: PassInput[] // 该通道的输入配置
}

// Shader 预设（支持单通道和多通道）
export interface ShaderPreset {
  id: string
  name: string
  author?: string
  code?: string // 单通道模式（向后兼容）
  passes?: PassConfig[] // 多通道模式
}

// 几何体配置
export interface GeometryConfig {
  type: GeometryType
  scale: number
  position: [number, number, number]
}
