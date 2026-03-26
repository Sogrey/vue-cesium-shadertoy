import type { ShaderToyUniforms } from '@/types'

/**
 * 将 ShaderToy 的 mainImage 函数转换为 Cesium 可用的 fragment shader
 */
export function convertShaderToyToCesium(shaderToyCode: string): string {
  // ShaderToy 使用 mainImage(out vec4 fragColor, in vec2 fragCoord)
  // Cesium Material 需要不同的入口点

  const fragmentShader = `
// ShaderToy uniforms
uniform float u_time;
uniform vec2 u_resolution;
uniform vec4 u_mouse;

// ShaderToy 内置变量
#define iTime u_time
#define iResolution u_resolution
#define iMouse u_mouse
#define texture(sampler, uv) czm_texture(sampler, uv)

// 用户自定义函数
${shaderToyCode}

// Cesium Material 入口
czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);
    
    vec2 fragCoord = materialInput.st * u_resolution;
    vec4 fragColor;
    
    mainImage(fragColor, fragCoord);
    
    material.diffuse = fragColor.rgb;
    material.alpha = fragColor.a;
    
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
) {
  const { Material, Cartesian2, Cartesian4 } = cesium

  return new Material({
    fabric: {
      type: 'ShaderToy',
      uniforms: {
        u_time: uniforms.iTime,
        u_resolution: new Cartesian2(uniforms.iResolution[0], uniforms.iResolution[1]),
        u_mouse: new Cartesian4(uniforms.iMouse[0], uniforms.iMouse[1], uniforms.iMouse[2], uniforms.iMouse[3]),
      },
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
