# Amber — foobar2000 独立主题包 v1.0

由用户与 Claude 共同设计打造，2026-07。零外部依赖（仅需 JSplitter 组件），
所有面板从零手写，琥珀暖色体系。

## 面板清单

| 文件 | 面板 | 说明 |
|---|---|---|
| `amber-lib.js` | 公共库 | 工具函数 + 琥珀调色板（全局改色只动这里） |
| `playlists.js` | 播放列表侧栏 | 列表/计数/琥珀高亮/右键管理/全局搜索（命中直接跳转到对应专辑） |
| `coverflow.js` | 封面墙 | 伪3D轮播/倒影/时间基缓动/自动回到播放专辑/联动广播 |
| `albumcard.js` | 专辑播放卡 | 歌手·居中控制键·走字时间 + 曲目行(序号/标题/编码/时长/年份) |
| `controls.js` | 独立播放条 | 备用（专辑卡已内建控制键） |

## 安装

任意 JSplitter 面板的配置里只写一行（把 `xxx` 换成上面的文件名）：

    include(fb.ProfilePath + 'amber\\xxx.js');

注意：脚本文件必须保留 UTF-8 BOM，否则中文乱码。

## 联动协议

coverflow 停稳时广播 `NotifyOthers("cf_album", [playlistIndex, firstItemIndex])`，
albumcard 监听并切换显示。任何自定义面板都可以接入。

## 调色板（amber-lib.js）

- `AMBER_ACCENT` #EBA546 强调色 · `AMBER_ROW` #8A6228 选中行
- `AMBER_SEL` #41341F 次级选中 · `AMBER_TXT_ON` #FFF3DC 琥珀底文字
- `AMBER_BG` = 0 跟随系统背景（推荐配暖炭 RGB 32,27,20 + 系统高亮 235,165,70）

## 每个面板头部都有「可调参数」区

字号/行高/尺寸/动画速度等，改完重启 foobar2000 生效。
