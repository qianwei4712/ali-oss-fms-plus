# Ali OSS FMS Plus 🚀

Ali OSS FMS Plus 是一个基于 React + Vite + TypeScript 构建的阿里云 OSS 文件管理系统。它专注于提供移动优先、极简且功能完备的文件管理体验。

**演示地址**: [ali-oss-fms-plus.vercel.app](https://ali-oss-fms-plus.vercel.app)

---

## ✨ 主要特性

- 📱 **移动优先设计**: 专为移动端优化的响应式界面，支持手势操作（如侧滑删除/下载）。
- 🎨 **多主题支持**: 预置 **浅色 (Light)**、**深色 (Dark)** 和 **羊皮纸 (Sepia)** 三种精美主题。
- 📂 **全方位文件管理**:
  - 支持文件和目录的浏览。
  - 支持文件重命名、移动和删除。
  - **回收站** 功能：误删文件可轻松找回。
- 🔍 **全局递归搜索**: 支持跨目录快速搜索文件。
- 📖 **离线阅读模式**: 支持下载 `.txt` 文件到本地存储，随时随地离线阅读。
- 🔐 **安全可靠**: 所有的阿里云 OSS 密钥均存储在您的本地浏览器中，不会上传到任何服务器。
- 🧊 **磨砂玻璃效果**: 现代化的 UI 设计，带有背景模糊和优雅的过渡动画。
- 🧹 **文件名净化**: 预设文件名清理规则，在重命名文件时一键移除多余字符（如广告标签）。
- ⬇️ **下载管理**: 集中管理已下载的离线文件，支持按时间排序、快速阅读及删除。
- ⚙️ **高级设置**: 提供缓存清理、配置重置、多主题切换及 OSS 参数管理。

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
