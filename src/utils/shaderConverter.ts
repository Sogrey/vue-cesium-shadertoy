import type { ShaderToyUniforms } from '@/types'

// 用于生成唯一 Material type 的计数器
let materialIdCounter = 0

/**
 * 将 ShaderToy 的 mainImage 函数转换为 Cesium 可用的 fragment shader
 */
export function convertShaderToyToCesium(shaderToyCode: string, channels?: number[]): string {
  // ShaderToy 使用 mainImage(out vec4 fragColor, in vec2 fragCoord)
  // Cesium Material 需要不同的入口点

  // Cesium 使用 WebGL 2.0，texture2D 应转换为 texture
  let convertedCode = shaderToyCode.replace(
    /\btexture2D\s*\(/g,
    'texture('
  )

  // 添加 iChannel uniform 声明
  const channelUniforms = (channels || [])
    .map(i => `uniform sampler2D iChannel${i};`)
    .join('\n')

  const fragmentShader = `
// ShaderToy uniforms
uniform float u_time;
uniform vec3 u_resolution;
uniform vec4 u_mouse;

// ShaderToy 内置变量
#define iTime u_time
#define iResolution u_resolution
#define iMouse u_mouse

// iChannel 纹理（多通道模式）
${channelUniforms}

// 用户自定义函数
${convertedCode}

// Cesium Material 入口
czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);

    // ShaderToy 的 fragCoord 是浮点数，表示像素中心坐标
    vec2 fragCoord = materialInput.st * u_resolution.xy + 0.5;
    vec4 fragColor;

    mainImage(fragColor, fragCoord);

    material.diffuse = fragColor.rgb;
    material.alpha = clamp(fragColor.a, 0.0, 1.0);

    return material;
}
`

  return fragmentShader
}

/**
 * 创建 Cesium Material
 */
export function createCesiumMaterial(
  cesium: typeof import('cesium'),
  fragmentShader: string,
  uniforms: ShaderToyUniforms,
  channels?: number[] // 需要初始化的通道索引
) {
  const { Material, Cartesian3, Cartesian4 } = cesium

  // 构建 uniforms 对象
  const materialUniforms: Record<string, unknown> = {
    u_time: uniforms.iTime,
    u_resolution: new Cartesian3(uniforms.iResolution[0], uniforms.iResolution[1], uniforms.iResolution[2] || 1.0),
    u_mouse: new Cartesian4(uniforms.iMouse[0], uniforms.iMouse[1], uniforms.iMouse[2], uniforms.iMouse[3]),
  }

  // 为 iChannel 设置默认纹理（黑色 1x1 纹理）
  // 必须在创建时设置，否则 Cesium 会报 "Unknown uniform" 错误
  if (channels && channels.length > 0) {
    for (const channel of channels) {
      materialUniforms[`iChannel${channel}`] = Material.DefaultImageId
    }
  }

  // 使用唯一的 type 名称避免 Cesium Material 缓存冲突
  const uniqueType = `ShaderToy_${materialIdCounter++}`

  return new Material({
    fabric: {
      type: uniqueType,
      uniforms: materialUniforms,
      source: fragmentShader,
    },
  })
}

/**
 * 验证 ShaderToy 代码
 */
export function validateShaderToyCode(code: string): { valid: boolean; error?: string } {
  if (!code.includes('mainImage')) {
    return { valid: false, error: '缺少 mainImage 函数' }
  }

  // 基本语法检查
  const braceCount = (code.match(/{/g) || []).length - (code.match(/}/g) || []).length
  if (braceCount !== 0) {
    return { valid: false, error: '括号不匹配' }
  }

  return { valid: true }
}