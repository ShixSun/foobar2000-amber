// ============================================================
//  amber-lib.js — Amber 主题公共库 (独立, 不依赖 foobox)
//  被 amber 目录下所有面板引用
// ============================================================

// ---------- 基础工具 ----------
function RGBA(r, g, b, a) { return ((a << 24) | (r << 16) | (g << 8) | (b)); }
function RGB(r, g, b) { return (0xff000000 | (r << 16) | (g << 8) | (b)); }
var c_black = RGB(0, 0, 0);
var c_white = RGB(255, 255, 255);

ColorTypeDUI = { text: 0, background: 1, highlight: 2, selection: 3 };

function toRGB(c) { return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff]; }

function blendColors(c1, c2, factor) {
	var a = toRGB(c1), b = toRGB(c2);
	var r = Math.round(a[0] + factor * (b[0] - a[0]));
	var g = Math.round(a[1] + factor * (b[1] - a[1]));
	var bl = Math.round(a[2] + factor * (b[2] - a[2]));
	return (0xff000000 | (r << 16) | (g << 8) | (bl));
}

var zdpi = 1;
function z(value) { return Math.round(value * zdpi); }

// ---------- Amber 调色板 ----------
var AMBER_ACCENT = 0xFFEBA546;  // 琥珀强调色 RGB(235,165,70), 改 0 跟随系统高亮
var AMBER_ROW    = 0xFF8A6228;  // 中琥珀(选中行/当前项背景)
var AMBER_SEL    = 0xFF41341F;  // 暗琥珀(次级选中)
var AMBER_TXT_ON = 0xFFFFF3DC;  // 琥珀底上的暖白文字
var AMBER_BG     = 0;           // 面板背景, 0 = 跟随系统背景色(推荐)
