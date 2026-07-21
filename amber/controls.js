// ============================================================
//  amber transport — 播放控制条 (配合琥珀主题)
//  用法: 面板脚本只保留一行
//    include(fb.ProfilePath + 'amber\\controls.js');
//  单击: 上一曲/播放暂停/下一曲 · 音量条可点可拖 · 面板上滚轮调音量
// ============================================================
window.DefinePanel('amber transport', {author: 'amber'});
include(fb.ProfilePath + 'amber\\amber-lib.js');
var zdpi = 1, dark_mode = 0;

var tpW = 0, tpH = 0;
var tp_hover = "", tp_down = "";
var tp_dragVol = false;
var tp_hits = [];
var tp_colBg, tp_colTxt, tp_colAcc;

function tp_colors() {
	tp_colBg  = (typeof AMBER_BG != "undefined" && AMBER_BG) ? AMBER_BG : window.GetColourDUI(ColorTypeDUI.background);
	tp_colTxt = window.GetColourDUI(ColorTypeDUI.text);
	tp_colAcc = (typeof AMBER_ACCENT != "undefined" && AMBER_ACCENT) ? AMBER_ACCENT : window.GetColourDUI(ColorTypeDUI.highlight);
}

function tp_vol2frac(db) { return Math.max(0, Math.min(1, Math.pow(10, db / 50))); }
function tp_frac2vol(f) { return f <= 0.001 ? -100 : Math.max(-100, 50 * Math.log10(f)); }

function tp_iconCol(id) {
	if (tp_down === id) return blendColors(tp_colBg, tp_colAcc, 0.65);
	if (tp_hover === id) return tp_colAcc;
	return blendColors(tp_colBg, tp_colTxt, 0.72);
}

function on_paint(gr) {
	if (!tp_colBg) tp_colors();
	try { gr.SetSmoothingMode(2); } catch (e) {}
	gr.FillSolidRect(0, 0, tpW, tpH, tp_colBg);
	tp_hits = [];
	var cy = tpH / 2;
	var cx = tpW / 2;
	var R = Math.max(z(14), Math.min(tpH * 0.34, z(26)));
	var s = Math.max(z(7), Math.min(tpH * 0.16, z(11)));
	var gap = R + z(42);

	// 上一曲  |◀
	var px = cx - gap;
	var pc = tp_iconCol("prev");
	gr.FillSolidRect(px - s, cy - s, z(3), s * 2, pc);
	gr.FillPolygon(pc, 0, [px + s, cy - s, px + s, cy + s, px - s + z(4), cy]);
	tp_hits.push({ id: "prev", x: px - z(18), y: cy - z(18), w: z(36), h: z(36) });

	// 下一曲  ▶|
	var nx = cx + gap;
	var nc = tp_iconCol("next");
	gr.FillSolidRect(nx + s - z(3), cy - s, z(3), s * 2, nc);
	gr.FillPolygon(nc, 0, [nx - s, cy - s, nx - s, cy + s, nx + s - z(4), cy]);
	tp_hits.push({ id: "next", x: nx - z(18), y: cy - z(18), w: z(36), h: z(36) });

	// 播放/暂停 (琥珀圆环)
	var ringCol = (tp_hover === "play" || tp_down === "play") ? tp_colAcc : blendColors(tp_colBg, tp_colAcc, 0.78);
	gr.DrawEllipse(cx - R, cy - R, R * 2, R * 2, z(2), ringCol);
	var pcol = tp_iconCol("play");
	if (fb.IsPlaying && !fb.IsPaused) {
		var bw = Math.max(2, Math.round(R * 0.24)), bh = Math.round(R * 0.88), off = Math.round(R * 0.24);
		gr.FillSolidRect(cx - off - bw, cy - bh / 2, bw, bh, pcol);
		gr.FillSolidRect(cx + off, cy - bh / 2, bw, bh, pcol);
	} else {
		var t = R * 0.52;
		gr.FillPolygon(pcol, 0, [cx - t * 0.5, cy - t, cx - t * 0.5, cy + t, cx + t * 0.95, cy]);
	}
	tp_hits.push({ id: "play", x: cx - R - z(4), y: cy - R - z(4), w: R * 2 + z(8), h: R * 2 + z(8) });

	// 音量条 (右侧, 空间足够时)
	if (tpW > z(330)) {
		var vw = Math.min(z(130), Math.round(tpW * 0.24));
		var vx = tpW - vw - z(26), vy = cy;
		var f = tp_vol2frac(fb.Volume);
		gr.FillSolidRect(vx, vy - z(1), vw, z(2), blendColors(tp_colBg, tp_colTxt, 0.22));
		gr.FillSolidRect(vx, vy - z(1), Math.round(vw * f), z(2), tp_colAcc);
		var kx = vx + vw * f;
		var kcol = (tp_hover === "vol" || tp_dragVol) ? tp_colAcc : blendColors(tp_colBg, tp_colAcc, 0.85);
		gr.FillEllipse(kx - z(5), vy - z(5), z(10), z(10), kcol);
		tp_hits.push({ id: "vol", x: vx - z(8), y: vy - z(14), w: vw + z(16), h: z(28), vx: vx, vw: vw });
	}
}

// ---------- 交互 ----------
function tp_hitAt(x, y) {
	for (var i = tp_hits.length - 1; i >= 0; i--) {
		var r = tp_hits[i];
		if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
	}
	return null;
}

function tp_setVolByX(hit, x) {
	var f = (x - hit.vx) / hit.vw;
	fb.Volume = tp_frac2vol(Math.max(0, Math.min(1, f)));
}

function on_mouse_move(x, y) {
	if (tp_dragVol) {
		for (var i = 0; i < tp_hits.length; i++) if (tp_hits[i].id === "vol") { tp_setVolByX(tp_hits[i], x); break; }
		return;
	}
	var h = tp_hitAt(x, y);
	var id = h ? h.id : "";
	if (id !== tp_hover) { tp_hover = id; window.Repaint(); }
}

function on_mouse_leave() {
	if (tp_hover || tp_down) { tp_hover = ""; tp_down = ""; window.Repaint(); }
}

function on_mouse_lbtn_down(x, y) {
	var h = tp_hitAt(x, y);
	if (!h) return;
	tp_down = h.id;
	if (h.id === "vol") { tp_dragVol = true; tp_setVolByX(h, x); }
	window.Repaint();
}

function on_mouse_lbtn_up(x, y) {
	var h = tp_hitAt(x, y);
	if (h && h.id === tp_down) {
		if (h.id === "prev") fb.Prev();
		else if (h.id === "play") fb.PlayOrPause();
		else if (h.id === "next") fb.Next();
	}
	tp_down = ""; tp_dragVol = false;
	window.Repaint();
}

function on_mouse_wheel(step) {
	fb.Volume = Math.max(-100, Math.min(0, fb.Volume + step * 2.0));
}

// ---------- 回调 ----------
function on_playback_starting() { window.Repaint(); }
function on_playback_pause() { window.Repaint(); }
function on_playback_stop() { window.Repaint(); }
function on_playback_new_track() { window.Repaint(); }
function on_volume_change() { window.Repaint(); }
function on_size() { tpW = window.Width; tpH = window.Height; }
function on_colours_changed() { tp_colors(); window.Repaint(); }

on_size();
tp_colors();
