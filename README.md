# Ali OSS FMS Plus 🚀

Ali OSS FMS Plus 是一个基于 React + Vite + TypeScript 构建的阿里云 OSS 文件管理系统。它专注于提供移动优先、极简且功能完备的文件管理体验。

**演示地址**: [ali-oss-fms-plus.vercel.app](https://ali-oss-fms-plus.vercel.app)

---

## ✨ 主要特性

- 🎨 **Cosmic Glass 设计系统**: 
  - 全新 **UI/UX Pro Max** 升级，采用 "Cosmic Glass" 玻璃拟态设计语言。
  - 全应用覆盖磨砂玻璃效果 (`backdrop-blur`)、动态渐变背景与悬浮式卡片。
  - 底部导航栏升级为 **悬浮灵动岛** 样式，带动态指示器与流畅动画。
- 📱 **沉浸式移动体验**: 
  - 列表滚动时 **自动隐藏** 顶部工具栏与底部导航栏，提供最大的内容展示空间。
  - 专为移动端优化的紧凑型列表视图，一屏展示更多文件。
  - 支持手势操作（侧滑删除/下载）。
- 📂 **全方位文件管理**:
  - 支持文件和目录的浏览、重命名、移动和删除。
  - **回收站** 功能：误删文件可轻松找回。
  - **文件名净化**: 预设规则一键移除文件名中的多余字符（如广告标签）。
- 🔍 **全局递归搜索**: 支持跨目录快速搜索文件。
- 📖 **离线阅读模式**: 
  - 支持下载 `.txt` 文件到本地存储，随时随地离线阅读。
  - 阅读器支持沉浸式全屏阅读，菜单栏自动隐形。
- 🔐 **安全可靠**: 所有的阿里云 OSS 密钥均存储在您的本地浏览器中，不会上传到任何服务器。
- ⚙️ **高级设置**: 提供缓存清理、配置重置、多主题切换（深色/浅色/护眼模式）及 OSS 参数管理。

## 🛠️ 技术栈

- **开发工具**: **[Trae IDE](https://www.trae.ai/)** (由 ByteDance 开发的 AI 驱动型 IDE)
- **开发方式**: **100% AI 对话驱动开发**。本项目全流程由 AI 协助完成，包括架构设计、UI 样式重构、功能实现及文档编写。
- **框架**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **路由**: [React Router](https://reactrouter.com/)
- **语言**: [TypeScript](https://www.typescriptlang.org/)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **组件库**: [Shadcn UI](https://ui.shadcn.com/) (基于 Radix UI)
- **状态管理**: [Zustand](https://zustand-demo.pmnd.rs/)
- **本地存储**: [localforage](https://localforage.github.io/localForage/) (用于离线文件)
- **图标**: [Lucide React](https://lucide.dev/)
- **OSS SDK**: [ali-oss](https://github.com/ali-sdk/ali-oss)

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/your-username/oss-fms-plus.git
cd oss-fms-plus
```

### 2. 安装依赖
```bash
pnpm install
# 或者使用 npm
npm install
```

### 3. 运行开发服务器
```bash
pnpm dev
```

### 4. 构建生产版本
```bash
pnpm build
```

## ⚙️ 配置说明

在使用系统前，您需要在 **Settings > OSS Configuration** 中配置您的阿里云 OSS 信息：

1. **Region**: 例如 `oss-cn-hangzhou`
2. **Bucket**: 您的存储空间名称
3. **AccessKeyId**: 您的阿里云访问密钥 ID
4. **AccessKeySecret**: 您的阿里云访问密钥 Secret
5. **Root Path** (可选): 默认浏览的根目录
6. **Recycle Path** (可选): 回收站文件存储目录（默认为 `trash/`）

> [!IMPORTANT]
> **CORS 配置**: 为了在浏览器中正常使用，您必须在阿里云 OSS 控制台中为您的 Bucket 配置 CORS 规则（允许您的域名、允许所有 Methods、允许所有 Headers、暴露 ETag）。

## 📄 许可证

MIT License
