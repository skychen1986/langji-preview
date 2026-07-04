# 朗迹 · 产品场景预览系统

## 快速开始

```
浏览器打开 index.html  →  2D 产品场景组合器
浏览器打开 splat-viewer.html  →  3D 高斯泼溅查看器
```

## 生成 3DGS 文件（.ply / .splat）

### 方式一：Luma AI（最简单，手机就行）
1. 手机打开 https://lumalabs.ai
2. 绕产品拍 20-30 张照片（不同角度，间距均匀）
3. 上传 → 等待生成 → 下载 .ply 文件
4. 把 .ply 文件放入 `splat-test/` 目录

### 方式二：Postshot（桌面免费）
1. 下载 https://github.com/NVlabs/instant-ngp （Windows 版）
2. 照片拖进去 → 自动计算 → 导出 .ply

### 方式三：TripoSplat（开源，需 ComfyUI）
1. 安装 ComfyUI → 安装 TripoSplat 节点
2. 上传图片 → LLM 清理背景 → 生成 .splat

## 查看生成的 3DGS 文件
1. 浏览器打开 `splat-viewer.html`
2. 把 .ply 或 .splat 文件拖入窗口
3. 鼠标拖拽旋转 · 滚轮缩放 · 右键平移

## 文件结构
```
langji-preview/
├── index.html           # 2D 产品场景组合器（MVP）
├── splat-viewer.html    # 3DGS 高斯泼溅查看器
├── scenes/              # 场景底图
├── products/            # 产品 PNG（去底）
└── splat-test/          # 3DGS 文件（放入 .ply/.splat）
```
