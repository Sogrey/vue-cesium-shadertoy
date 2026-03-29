# Vue Cesium ShaderToy

基于 Vue 3 + Cesium 的 ShaderToy 可视化演示工具。支持从 ShaderToy 网站导入 Shader 并在多种 3D 几何体上展示效果。

![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js)
![Cesium](https://img.shields.io/badge/Cesium-1.x-6CADDF?logo=cesium)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)

## 功能特性

- **🎨 ShaderToy 导入** - 输入 Shader ID 或 URL 直接获取代码
- **📦 多种几何体** - 支持平面、球体、立方体、圆柱体
- **📝 代码编辑** - 实时编辑和预览 Shader 代码
- **🎬 动画控制** - 播放/暂停时间动画
- **🖱️ 鼠标交互** - 支持 ShaderToy 的 `iMouse` uniform
- **🎯 自动定位** - 切换几何体自动调整相机视角
- **🔄 多通道渲染** - 支持多通道/多缓冲区 Shader（如反馈循环、缓冲区链等）
- **🖼️ 纹理支持** - 支持 `iChannel0`、`iChannel1` 等纹理输入
- **⚡ WebGL 2.0** - 完全兼容 WebGL 2.0（`texture()`, `texelFetch()` 等）

## 快速开始

### 安装依赖

```sh
pnpm install
```

### 开发模式

```sh
pnpm dev
```

访问 http://localhost:5173

### 构建生产版本

```sh
pnpm build
```

## 使用指南

### 1. 从 ShaderToy 导入

在「从 ShaderToy 导入」区域：

```
输入框支持两种格式：
- Shader ID: XstXR2
- 完整 URL: https://www.shadertoy.com/view/XstXR2
```

点击「获取」按钮即可自动加载 Shader 代码。

### 2. 选择几何体

点击几何体图标切换展示形状：

| 几何体 | 说明 | 最佳视角 |
|--------|------|----------|
| 📐 平面 | 适合 2D 效果 | 俯视 |
| 🔮 球体 | 适合环境映射 | 斜角 45° |
| 📦 立方体 | 适合 3D 效果 | 斜角 45° |
| 🥫 圆柱体 | 适合环绕效果 | 斜角 60° |

### 3. 编辑 Shader

ShaderToy 代码使用以下格式：

```glsl
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.xy;
    fragColor = vec4(uv.x, uv.y, 0.5 + 0.5 * sin(iTime), 1.0);
}
```

### 4. 可用 Uniforms

| Uniform | 类型 | 说明 |
|---------|------|------|
| `iTime` | float | 时间（秒） |
| `iResolution` | vec2 | 画布分辨率 |
| `iMouse` | vec4 | 鼠标位置 (x, y, clickX, clickY) |
| `iChannel0-3` | sampler2D | 纹理通道（多通道渲染使用） |
| `iFrame` | int | 帧计数器（多通道渲染使用） |

## 项目结构

```
src/
├── components/
│   ├── CesiumViewer.vue      # Cesium 渲染容器
│   ├── ControlPanel.vue      # 控制面板
│   ├── ShaderEditor.vue      # 代码编辑器
│   └── GeometrySelector.vue  # 几何体选择器
├── utils/
│   ├── shadertoyApi.ts       # ShaderToy API 工具
│   ├── shaderConverter.ts    # Shader 代码转换器
│   ├── multipassRenderer.ts  # 多通道渲染器
│   └── geometryFactory.ts    # 几何体创建工厂
├── shaders/
│   ├── index.ts              # Shader 预设定义
│   └── *.glsl                # Shader 源文件
├── types/
│   └── index.ts              # TypeScript 类型定义
├── App.vue                   # 主应用
└── main.ts                   # 入口文件
```

## 技术栈

- **前端框架**: Vue 3 + TypeScript
- **3D 引擎**: Cesium
- **构建工具**: Vite
- **样式**: Scoped CSS

## API Key 配置（可选）

默认已内置公开 API Key，可直接使用。如需更高请求配额：

1. 访问 [shadertoy.com/myapps](https://www.shadertoy.com/myapps)
2. 登录并创建 App 获取 API Key
3. 点击「配置 API Key」输入并保存

## 开发配置

### IDE 推荐

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

### Vite 代理配置

开发环境已配置 ShaderToy API 代理：

```ts
// vite.config.ts
server: {
  proxy: {
    '/api/shadertoy': {
      target: 'https://www.shadertoy.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/shadertoy/, '/api/v1'),
    },
  },
}
```

## 参考资源

- [ShaderToy](https://www.shadertoy.com/) - Shader 分享平台
- [Cesium 文档](https://cesium.com/docs/) - Cesium API 文档
- [GLSL 语法参考](https://www.khronos.org/opengl/wiki/Core_Language_(GLSL)) - GLSL 语言规范

## License

MIT
