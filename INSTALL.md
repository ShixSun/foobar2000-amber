# Amber 安装指南 / Installation

foobar2000 独立主题：琥珀暖色 · 封面墙 · 极简播放卡。
所有面板为原创 JSplitter 脚本，零第三方主题依赖。

## 环境要求

- foobar2000 **v2.x 64 位**（v2.24+ 测试通过）
- 必装组件：**JSplitter**（foo_uie_jsplitter，v4.0.4+）
- 可选组件（本主题默认布局用到，缺失时对应面板留空即可替换）：
  - ESLyric（歌词面板）
  - Spectrum Analyzer（foo_vis_spectrum_analyzer，频谱）
  - Waveform Minibar mod（foo_wave_minibar_mod，波形进度条）

> 请从各组件的官方页面下载，本仓库不分发任何第三方二进制。

## 安装步骤

1. 安装上述组件，重启 foobar2000
2. 把 `amber` 整个文件夹放进 foobar2000 的 **profile 目录**
   （便携版 = 安装目录下的 `profile\`；标准版 = `%appdata%\foobar2000-v2\`）
3. 关闭 foobar2000，用本仓库的 `theme.fth` 覆盖 profile 下的 `theme.fth`
   （或在 参数选择 → 显示 → 默认用户界面 里导入主题）
4. 配色：参数选择 → 显示 → **颜色和字体** → 深色方案 → 自定义：
   - 背景 `32, 27, 20`（暖炭）
   - 高亮 `235, 165, 70`（琥珀）
5. 启动 foobar2000 完成

## 不用 theme.fth 的手动接线

任何 JSplitter（JS 分离器）面板的「配置」里删光模板、只写一行即可挂载对应面板：

    include(fb.ProfilePath + 'amber\\coverflow.js');   // 封面墙
    include(fb.ProfilePath + 'amber\\albumcard.js');   // 专辑播放卡
    include(fb.ProfilePath + 'amber\\playlists.js');   // 播放列表侧栏
    include(fb.ProfilePath + 'amber\\controls.js');    // 独立播放条(备用)

## 常见问题

- **面板中文乱码** → 脚本文件必须保留 UTF-8 BOM（用支持 BOM 的编辑器保存）
- **「包未找到」报错** → 布局引用的某个组件未安装，装上或在布局编辑模式里替换该面板
- **新建面板报 `redeclaration of let wh`** → 配置框里 JSplitter 自带的模板代码没删干净，删光只留 include 行
- 字号/行高/动画速度等参数都在各脚本头部的「可调参数」区

## 致谢

- 灵感与生态：[foobox](https://github.com/dream7180/foobox-cn)（dream7180）
- 运行时：JSplitter（always_beta）
- 设计与代码：Amber 用户 & Claude，2026-07
