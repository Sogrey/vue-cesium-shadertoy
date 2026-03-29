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

/**
 * 所有支持的通道类型常量数组
 */
export const PASS_TYPES: PassType[] = [
  'Image',
  'BufferA',
  'BufferB',
  'BufferC',
  'BufferD',
  'Common',
  'Sound',
  'CubemapA',
]

/**
 * 根据通道类型获取默认代码模板
 * 对应 ShaderToy 各通道的默认函数签名
 */
export function getDefaultCodeForType(type: PassType): string {
  switch (type) {
    case 'Sound':
      return `vec2 mainSound( int samp, float time )
{
    // A 440 Hz wave that attenuates quickly overt time
    return vec2( sin(6.2831*440.0*time)*exp(-3.0*time) );
}`
    case 'CubemapA':
      return `void mainCubemap( out vec4 fragColor, in vec2 fragCoord, in vec3 rayOri, in vec3 rayDir )
{
    // Ray direction as color
    vec3 col = 0.5 + 0.5*rayDir;

    // Output to cubemap
    fragColor = vec4(col,1.0);
}`
    case 'BufferA':
    case 'BufferB':
    case 'BufferC':
    case 'BufferD':
      return `void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragColor = vec4(0.0,0.0,1.0,1.0);
}`
    case 'Common':
      return `vec4 someFunction( vec4 a, float b )
{
    return a+b;
}`
    case 'Image':
    default:
      return `void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord / iResolution.xy;

    // Time varying pixel color
    vec3 col = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));

    // Output to screen
    fragColor = vec4(col,1.0);
}`
  }
}

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
