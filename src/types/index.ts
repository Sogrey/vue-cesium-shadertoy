// 几何体类型
export type GeometryType = 'plane' | 'sphere' | 'cube' | 'cylinder'

// ShaderToy Uniforms
export interface ShaderToyUniforms {
  iTime: number
  iResolution: [number, number, number]
  iMouse: [number, number, number, number]
  iFrame: number
}

// Shader 预设
export interface ShaderPreset {
  id: string
  name: string
  author?: string
  code: string
}

// 几何体配置
export interface GeometryConfig {
  type: GeometryType
  scale: number
  position: [number, number, number]
}
