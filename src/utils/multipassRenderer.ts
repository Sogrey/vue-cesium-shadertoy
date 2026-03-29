/**
 * 多通道 Shader 渲染器
 * 
 * 使用 WebGL 原生 FBO 实现 ShaderToy 多通道渲染架构
 * 
 * 流程：
 * 1. Buffer A/B/C/D 渲染到离屏 FBO
 * 2. Image 通道读取 Buffer 输出纹理
 * 3. 支持自反馈（Buffer 读取自己的上一帧）
 */

import type { PassConfig } from '@/types'

/**
 * FBO 配置
 */
interface FBOConfig {
  framebuffer: WebGLFramebuffer
  texture: WebGLTexture
  prevTexture?: WebGLTexture // 用于自反馈
  width: number
  height: number
}

/**
 * 多通道渲染器
 */
export class MultipassRenderer {
  private gl: WebGL2RenderingContext | WebGLRenderingContext
  private fboMap: Map<string, FBOConfig> = new Map()
  private width: number
  private height: number
  private frameCount: number = 0
  private quadBuffer: WebGLBuffer | null = null
  private shaderPrograms: Map<string, WebGLProgram> = new Map()

  constructor(gl: WebGL2RenderingContext | WebGLRenderingContext, width: number, height: number) {
    this.gl = gl
    this.width = width
    this.height = height
    this.createQuadBuffer()
  }

  /**
   * 创建全屏四边形顶点缓冲
   */
  private createQuadBuffer() {
    const gl = this.gl
    this.quadBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
    
    // 顶点数据: position (x, y), texcoord (u, v)
    const vertices = new Float32Array([
      -1, -1,  0, 0,
       1, -1,  1, 0,
      -1,  1,  0, 1,
       1,  1,  1, 1,
    ])
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
  }

  /**
   * 创建 FBO
   */
  private createFBO(width: number, height: number): FBOConfig {
    const gl = this.gl

    // 创建纹理
    const texture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)

    // 创建帧缓冲
    const framebuffer = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)

    // 创建深度缓冲
    const depthBuffer = gl.createRenderbuffer()
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height)
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer)

    // 检查完整性
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('FBO 创建失败:', status)
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    return { framebuffer, texture, width, height }
  }

  /**
   * 初始化通道 FBO
   */
  initPasses(passes: PassConfig[]) {
    const bufferPasses = passes.filter(p => p.type.startsWith('Buffer'))
    
    for (const pass of bufferPasses) {
      if (!this.fboMap.has(pass.id)) {
        this.fboMap.set(pass.id, this.createFBO(this.width, this.height))
      }
    }
  }

  /**
   * 编译着色器
   */
  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('FBO Shader 编译错误:', gl.getShaderInfoLog(shader))
      console.error('Shader source:', source)
      gl.deleteShader(shader)
      return null
    }
    return shader
  }

  /**
   * 创建着色器程序
   */
  private createShaderProgram(fragmentSource: string): WebGLProgram | null {
    const gl = this.gl

    // 顶点着色器
    const vertexSource = `#version 300 es
      in vec2 a_position;
      in vec2 a_texcoord;
      out vec2 v_texcoord;
      
      void main() {
        v_texcoord = a_texcoord;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `

    // 片段着色器包装
    const fullFragmentSource = `#version 300 es
      precision highp float;

      uniform sampler2D iChannel0;
      uniform sampler2D iChannel1;
      uniform sampler2D iChannel2;
      uniform sampler2D iChannel3;
      uniform float iTime;
      uniform vec3 iResolution;
      uniform vec4 iMouse;
      uniform int iFrame;

      in vec2 v_texcoord;
      out vec4 fragColor;

      ${fragmentSource}

      void main() {
        // ShaderToy 的 fragCoord 是浮点数，表示像素中心坐标
        // 像素(0,0)的中心在(0.5, 0.5)，像素(width-1, height-1)的中心在(width-0.5, height-0.5)
        vec2 fragCoord = v_texcoord * iResolution.xy + 0.5;
        mainImage(fragColor, fragCoord);
      }
    `

    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource)
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fullFragmentSource)
    
    if (!vertexShader || !fragmentShader) return null

    const program = gl.createProgram()!
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program 链接错误:', gl.getProgramInfoLog(program))
      gl.deleteProgram(program)
      return null
    }

    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)

    return program
  }

  /**
   * 渲染 Buffer 通道
   */
  renderBufferPass(
    pass: PassConfig,
    uniforms: { time: number; resolution: [number, number, number]; mouse: [number, number, number, number] }
  ) {
    const gl = this.gl
    const fboConfig = this.fboMap.get(pass.id)
    if (!fboConfig) {
      console.error('[FBO] No FBO config for pass:', pass.id)
      return
    }

    // 创建或获取着色器程序
    let program = this.shaderPrograms.get(pass.id)
    if (!program) {
      program = this.createShaderProgram(pass.code)!
      if (!program) {
        console.error('[FBO] Failed to create shader program for pass:', pass.id)
        return
      }
      this.shaderPrograms.set(pass.id, program)
    }

    // 处理自反馈
    const hasSelfFeedback = pass.inputs.some(input => input.source === 'self')
    if (hasSelfFeedback && !fboConfig.prevTexture) {
      fboConfig.prevTexture = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, fboConfig.prevTexture)
      // 初始化为黑色纹理
      const blackPixels = new Uint8Array(this.width * this.height * 4)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, blackPixels)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    }

    // 绑定 FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboConfig.framebuffer)
    gl.viewport(0, 0, this.width, this.height)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    // 使用程序
    gl.useProgram(program)

    // 设置顶点属性
    const posLoc = gl.getAttribLocation(program, 'a_position')
    const texLoc = gl.getAttribLocation(program, 'a_texcoord')
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0)
    gl.enableVertexAttribArray(texLoc)
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 16, 8)

    // 设置 uniforms
    gl.uniform1f(gl.getUniformLocation(program, 'iTime'), uniforms.time)
    gl.uniform3fv(gl.getUniformLocation(program, 'iResolution'), uniforms.resolution)
    gl.uniform4fv(gl.getUniformLocation(program, 'iMouse'), uniforms.mouse)
    gl.uniform1i(gl.getUniformLocation(program, 'iFrame'), this.frameCount)

    // 绑定 iChannel 纹理
    for (const input of pass.inputs) {
      const textureUnit = input.channel
      gl.activeTexture(gl.TEXTURE0 + textureUnit)
      
      let texture: WebGLTexture | null = null
      if (input.source === 'self') {
        texture = fboConfig.prevTexture || fboConfig.texture
      } else {
        const sourceFBO = this.fboMap.get(input.source)
        texture = sourceFBO?.texture || null
      }
      
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.uniform1i(gl.getUniformLocation(program, `iChannel${input.channel}`), textureUnit)
    }

    // 绘制
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    // 自反馈：复制当前纹理到 prevTexture
    if (hasSelfFeedback && fboConfig.prevTexture) {
      // 读取当前 FBO 内容
      const pixels = new Uint8Array(this.width * this.height * 4)
      gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      
      // 写入 prevTexture
      gl.bindTexture(gl.TEXTURE_2D, fboConfig.prevTexture)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    }

    // 解绑 FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    
    // 恢复 WebGL 状态
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.useProgram(null)
    gl.disableVertexAttribArray(posLoc)
    if (texLoc >= 0) gl.disableVertexAttribArray(texLoc)
  }

  /**
   * 获取通道纹理（用于 Image 通道）
   */
  getPassTexture(passId: string): WebGLTexture | null {
    return this.fboMap.get(passId)?.texture || null
  }

  /**
   * 读取通道纹理内容到像素数组
   */
  readPassPixels(passId: string): Uint8Array | null {
    const fboConfig = this.fboMap.get(passId)
    if (!fboConfig) return null

    const gl = this.gl as WebGL2RenderingContext
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fboConfig.framebuffer)
    const pixels = new Uint8Array(this.width * this.height * 4)
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)

    return pixels
  }

  /**
   * 调整尺寸
   */
  resize(width: number, height: number) {
    if (this.width === width && this.height === height) return
    
    this.width = width
    this.height = height
    
    // 重建所有 FBO
    const gl = this.gl
    for (const [passId, fboConfig] of this.fboMap) {
      gl.deleteFramebuffer(fboConfig.framebuffer)
      gl.deleteTexture(fboConfig.texture)
      if (fboConfig.prevTexture) gl.deleteTexture(fboConfig.prevTexture)
      this.fboMap.set(passId, this.createFBO(width, height))
    }
  }

  /**
   * 递增帧计数
   */
  incrementFrame() {
    this.frameCount++
  }

  /**
   * 获取帧数
   */
  getFrameCount(): number {
    return this.frameCount
  }

  /**
   * 销毁所有资源
   */
  destroy() {
    const gl = this.gl

    for (const program of this.shaderPrograms.values()) {
      gl.deleteProgram(program)
    }

    for (const fboConfig of this.fboMap.values()) {
      gl.deleteFramebuffer(fboConfig.framebuffer)
      gl.deleteTexture(fboConfig.texture)
      if (fboConfig.prevTexture) gl.deleteTexture(fboConfig.prevTexture)
    }

    if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer)

    this.shaderPrograms.clear()
    this.fboMap.clear()
    this.frameCount = 0 // 重置帧计数
  }
}

/**
 * 创建多通道渲染器
 */
export function createMultipassRenderer(
  canvas: HTMLCanvasElement,
  passes: PassConfig[]
): MultipassRenderer | null {
  if (!passes || passes.length === 0) return null
  
  const bufferPasses = passes.filter(p => p.type.startsWith('Buffer'))
  if (bufferPasses.length === 0) return null
  
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
  if (!gl) {
    console.error('WebGL 不可用')
    return null
  }
  
  const renderer = new MultipassRenderer(gl as WebGL2RenderingContext, canvas.width, canvas.height)
  renderer.initPasses(passes)
  
  return renderer
}
