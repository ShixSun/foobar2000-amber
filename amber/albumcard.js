// ============================================================
//  amber album card v4 — 极简播放卡 (配合 coverflow 封面墙)
//  用法: 面板脚本只保留一行
//    include(fb.ProfilePath + 'amber\\albumcard.js');
//  头部: 歌手 · 播放控制(居中) · 播放时间
//  行内: 序号 · 标题 · 年份 · 编码采样率 · 时长
//  滚轮滚动 · 双击曲目播放
// ============================================================
window.DefinePanel('amber album card', {author: 'amber'});
include(fb.ProfilePath + 'amber\\amber-lib.js');
var zdpi = 1, dark_mode = 0;

// ---------- 可调参数 ----------
var AC_ROWH   = 46;    // 曲目行高
var AC_F_ART  = 22;    // 歌手名字号
var AC_F_TIME = 18;    // 播放时间字号
var AC_F_ROW  = 18;    // 曲目字号
var AC_F_NUM  = 16;    // 序号/数据列字号
var AC_CTL_R  = 22;    // 播放键圆环半径
// ------------------------------

var acW = 0, acH = 0;
var ac_pl = -1, ac_key = null;
var ac_meta = null;
var ac_tracks = [];
var ac_scroll = 0, ac_hover = -1;
var ac_rowsTop = 0, ac_rowH = 1, ac_maxRows = 0, ac_visH = 0;
var ac_centerPending = false;
var ac_ctl = [];
var ac_ctlHover = "", ac_ctlDown = "";
var ac_npHover = false;

var ac_colBg, ac_colTxt, ac_colSub, ac_colFaint, ac_colGhost, ac_colAcc;
var ac_fArt  = gdi.Font("Microsoft YaHei UI", AC_F_ART, 1);
var ac_fTime = gdi.Font("Microsoft YaHei UI", AC_F_TIME, 0);
var ac_fRow  = gdi.Font("Microsoft YaHei UI", AC_F_ROW, 0);
var ac_fNum  = gdi.Font("Microsoft YaHei UI", AC_F_NUM, 0);
var ac_fQ    = gdi.Font("Microsoft YaHei UI", 12, 1);

var AC_L = 0x4 | 0x20 | 0x800 | 0x8000;
var AC_R = AC_L | 0x2;
var AC_C = AC_L | 0x1;
var MF_STRING = 0x0;

var AC_TF_KEY   = fb.TitleFormat("[%album artist%]|$if2(%album%,'(单曲)')|[%date%]");
var AC_TF_ART   = fb.TitleFormat("$if2(%album artist%,$if2(%artist%,'未知艺术家'))");
var AC_TF_DATE  = fb.TitleFormat("[%date%]");
var AC_TF_NUM   = fb.TitleFormat("$if2($num(%discnumber%,1)'.',)$if2($num(%tracknumber%,2),'--')");
var AC_TF_TITLE = fb.TitleFormat("$if2(%title%,%filename%)");
var AC_TF_LEN   = fb.TitleFormat("[%length%]");
var AC_TF_SECS  = fb.TitleFormat("[%length_seconds%]");
var AC_TF_CODEC = fb.TitleFormat("[%codec%]");
var AC_TF_SR    = fb.TitleFormat("[%samplerate%]");
var AC_TF_BR    = fb.TitleFormat("[%bitrate%]");
var AC_TF_NP    = fb.TitleFormat("%title%");

function ac_colors() {
	ac_colBg  = (typeof AMBER_BG != "undefined" && AMBER_BG) ? AMBER_BG : window.GetColourDUI(ColorTypeDUI.background);
	ac_colTxt = window.GetColourDUI(ColorTypeDUI.text);
	ac_colAcc = (typeof AMBER_ACCENT != "undefined" && AMBER_ACCENT) ? AMBER_ACCENT : window.GetColourDUI(ColorTypeDUI.highlight);
	ac_colSub   = blendColors(ac_colBg, ac_colTxt, 0.55);
	ac_colFaint = blendColors(ac_colBg, ac_colTxt, 0.32);
	ac_colGhost = blendColors(ac_colBg, ac_colTxt, 0.24);
}

function ac_bgParts() {
	return [(ac_colBg >> 16) & 0xFF, (ac_colBg >> 8) & 0xFF, ac_colBg & 0xFF];
}

function ac_fmtSec(sec) {
	sec = Math.max(0, Math.round(sec));
	var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
	function p2(v) { return (v < 10 ? "0" : "") + v; }
	return h > 0 ? h + ":" + p2(m) + ":" + p2(s) : m + ":" + p2(s);
}

function ac_playingIdx() {
	if (fb.IsPlaying && plman.PlayingPlaylist === ac_pl) {
		var loc = plman.GetPlayingItemLocation();
		return loc.PlaylistItemIndex;
	}
	return -1;
}

function ac_build(pl, seedIdx) {
	ac_pl = pl; ac_key = null; ac_meta = null; ac_tracks = [];
	ac_scroll = 0; ac_hover = -1;
	if (pl < 0 || seedIdx < 0) { window.Repaint(); return; }
	var list = plman.GetPlaylistItems(pl);
	if (seedIdx >= list.Count) { window.Repaint(); return; }
	ac_key = AC_TF_KEY.EvalWithMetadb(list[seedIdx]);
	var pIdx = ac_playingIdx();
	var secs = 0;
	for (var i = 0; i < list.Count; i++) {
		var h = list[i];
		if (AC_TF_KEY.EvalWithMetadb(h) !== ac_key) continue;
		if (!ac_meta) {
			ac_meta = { artist: AC_TF_ART.EvalWithMetadb(h), total: "" };
		}
		secs += parseFloat(AC_TF_SECS.EvalWithMetadb(h)) || 0;
		var cod = AC_TF_CODEC.EvalWithMetadb(h);
		var tbr = AC_TF_BR.EvalWithMetadb(h);
		ac_tracks.push({
			idx: i,
			metadb: h,
			num: AC_TF_NUM.EvalWithMetadb(h),
			title: AC_TF_TITLE.EvalWithMetadb(h),
			len: AC_TF_LEN.EvalWithMetadb(h),
			year: String(AC_TF_DATE.EvalWithMetadb(h)).substring(0, 4),
			cod: cod,
			br: (tbr ? tbr + "kbps" : ""),
			isPlaying: (i === pIdx)
		});
	}
	if (ac_meta) ac_meta.total = ac_fmtSec(secs);
	ac_centerPending = true;
	window.Repaint();
}

function ac_rebuildByKey() {
	if (ac_pl < 0 || !ac_key) return;
	var list = plman.GetPlaylistItems(ac_pl);
	for (var i = 0; i < list.Count; i++) {
		if (AC_TF_KEY.EvalWithMetadb(list[i]) === ac_key) { ac_build(ac_pl, i); return; }
	}
	ac_meta = null; ac_tracks = []; window.Repaint();
}

function ac_updPlaying() {
	var pIdx = ac_playingIdx();
	for (var i = 0; i < ac_tracks.length; i++) ac_tracks[i].isPlaying = (ac_tracks[i].idx === pIdx);
	if (pIdx >= 0) ac_centerPending = true;
	window.Repaint();
}

function ac_selfInit() {
	var pl = plman.ActivePlaylist;
	if (pl < 0) { ac_build(-1, -1); return; }
	var seed = -1;
	if (fb.IsPlaying && plman.PlayingPlaylist === pl) {
		seed = plman.GetPlayingItemLocation().PlaylistItemIndex;
	} else if (plman.PlaylistItemCount(pl) > 0) seed = 0;
	ac_build(pl, seed);
}

// ---------- 播放控制 ----------
function ac_ctlCol(id) {
	if (ac_ctlDown === id) return blendColors(ac_colBg, ac_colAcc, 0.65);
	if (ac_ctlHover === id) return ac_colAcc;
	return blendColors(ac_colBg, ac_colTxt, 0.72);
}

function ac_drawControls(gr, ccx, ccy) {
	ac_ctl = [];
	var R = z(AC_CTL_R);
	var s = z(9);
	var gap = R + z(36);
	var px = ccx - gap;
	var pc = ac_ctlCol("prev");
	gr.FillSolidRect(px - s, ccy - s, z(3), s * 2, pc);
	gr.FillPolygon(pc, 0, [px + s, ccy - s, px + s, ccy + s, px - s + z(4), ccy]);
	ac_ctl.push({ id: "prev", x: px - z(18), y: ccy - z(18), w: z(36), h: z(36) });
	var nx = ccx + gap;
	var nc = ac_ctlCol("next");
	gr.FillSolidRect(nx + s - z(3), ccy - s, z(3), s * 2, nc);
	gr.FillPolygon(nc, 0, [nx - s, ccy - s, nx - s, ccy + s, nx + s - z(4), ccy]);
	ac_ctl.push({ id: "next", x: nx - z(18), y: ccy - z(18), w: z(36), h: z(36) });
	var ringCol = (ac_ctlHover === "play" || ac_ctlDown === "play") ? ac_colAcc : blendColors(ac_colBg, ac_colAcc, 0.78);
	gr.DrawEllipse(ccx - R, ccy - R, R * 2, R * 2, z(2), ringCol);
	var pcol = ac_ctlCol("play");
	if (fb.IsPlaying && !fb.IsPaused) {
		var bw = Math.max(2, Math.round(R * 0.24)), bh = Math.round(R * 0.88), off = Math.round(R * 0.24);
		gr.FillSolidRect(ccx - off - bw, ccy - bh / 2, bw, bh, pcol);
		gr.FillSolidRect(ccx + off, ccy - bh / 2, bw, bh, pcol);
	} else {
		var t = R * 0.52;
		gr.FillPolygon(pcol, 0, [ccx - t * 0.5, ccy - t, ccx - t * 0.5, ccy + t, ccx + t * 0.95, ccy]);
	}
	ac_ctl.push({ id: "play", x: ccx - R - z(4), y: ccy - R - z(4), w: R * 2 + z(8), h: R * 2 + z(8) });
}

// 回到正在播放的专辑
function ac_goHome() {
	if (!fb.IsPlaying) return;
	var pp = plman.PlayingPlaylist;
	if (pp < 0) return;
	var loc = plman.GetPlayingItemLocation();
	plman.ActivePlaylist = pp;
	window.NotifyOthers("amber_locate", [pp, loc.PlaylistItemIndex]);
	ac_build(pp, loc.PlaylistItemIndex);
}

// 播放顺序按钮组 (顺序/循环/随机, 当前模式选中带下划线)
function ac_ordIcon(gr, id, mode, cx, cy) {
	var order = plman.PlaybackOrder;
	var isCur = (mode === 0 && order === 0) || (mode === 1 && (order === 1 || order === 2)) || (mode === 4 && order >= 3);
	var col = isCur ? ac_colAcc : (ac_ctlHover === id ? blendColors(ac_colBg, ac_colAcc, 0.70) : blendColors(ac_colBg, ac_colTxt, 0.38));
	var s = z(8);
	if (mode === 1) {
		gr.DrawEllipse(cx - s, cy - s + z(1), s * 2, s * 2 - z(2), z(2), col);
		gr.FillPolygon(col, 0, [cx + s - z(2), cy - s - z(3), cx + s + z(5), cy - s + z(2), cx + s - z(6), cy - s + z(5)]);
	} else if (mode === 4) {
		gr.DrawLine(cx - s, cy + s - z(3), cx + s - z(3), cy - s + z(3), z(2), col);
		gr.DrawLine(cx - s, cy - s + z(3), cx + s - z(3), cy + s - z(3), z(2), col);
		gr.FillPolygon(col, 0, [cx + s + z(3), cy - s + z(3), cx + s - z(4), cy - s, cx + s - z(2), cy - s + z(7)]);
		gr.FillPolygon(col, 0, [cx + s + z(3), cy + s - z(3), cx + s - z(4), cy + s, cx + s - z(2), cy + s - z(7)]);
	} else {
		gr.DrawLine(cx - s, cy, cx + s - z(4), cy, z(2), col);
		gr.FillPolygon(col, 0, [cx + s + z(1), cy, cx + s - z(6), cy - z(5), cx + s - z(6), cy + z(5)]);
	}
	ac_ctl.push({ id: id, x: cx - z(15), y: cy - z(17), w: z(30), h: z(36) });
}
function ac_drawOrder(gr, baseX, cy) {
	ac_ordIcon(gr, "ord0", 0, baseX - z(72), cy);
	ac_ordIcon(gr, "ord1", 1, baseX - z(36), cy);
	ac_ordIcon(gr, "ord4", 4, baseX, cy);
}

function ac_ctlAt(x, y) {
	for (var i = ac_ctl.length - 1; i >= 0; i--) {
		var r = ac_ctl[i];
		if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.id;
	}
	return "";
}

// ---------- 绘制 ----------
function on_paint(gr) {
	if (!ac_colBg) ac_colors();
	try { gr.SetSmoothingMode(2); } catch (e) {}
	gr.FillSolidRect(0, 0, acW, acH, ac_colBg);
	var L = z(26), R = z(20);
	if (!ac_meta) {
		gr.GdiDrawText("在上方封面墙选择一张专辑", ac_fTime, ac_colFaint, 0, 0, acW, acH, AC_C);
		ac_ctl = [];
		return;
	}
	var y0 = z(12);
	var stripH = z(56);
	var ccy = y0 + Math.round(stripH / 2);
	// 正在播放的歌曲 (左, 可点击回到该专辑); 未播放时显示歌手
	var npTitle = fb.IsPlaying ? AC_TF_NP.Eval() : ac_meta.artist;
	var npCol = ac_npHover ? ac_colAcc : blendColors(ac_colBg, ac_colTxt, 0.95);
	gr.GdiDrawText(npTitle, ac_fArt, npCol, L, y0, Math.round(acW * 0.34), stripH, AC_L);
	// 播放控制 (居中)
	ac_drawControls(gr, Math.round(acW / 2), ccy);
	// 播放时间 (右): 播放中显示 当前/总长, 否则显示专辑总时长
	var timeStr;
	if (fb.IsPlaying) timeStr = ac_fmtSec(fb.PlaybackTime) + " / " + ac_fmtSec(fb.PlaybackLength);
	else timeStr = ac_meta.total;
	gr.GdiDrawText(timeStr, ac_fTime, ac_colSub, acW - R - z(190), y0, z(190), stripH, AC_R);
	// 播放顺序切换 (时间左侧)
	ac_drawOrder(gr, acW - R - z(190) - z(26), ccy);
	// 琥珀短线
	gr.FillSolidRect(L, y0 + stripH + z(4), z(56), z(2), ac_colAcc);

	var y = y0 + stripH + z(18);
	var rowH = z(AC_ROWH);
	var visH = acH - y - z(8);
	var maxRows = Math.max(1, Math.floor(visH / rowH));
	if (ac_centerPending) {
		ac_centerPending = false;
		for (var pr = 0; pr < ac_tracks.length; pr++) {
			if (ac_tracks[pr].isPlaying) {
				ac_scroll = Math.max(0, Math.min(pr - Math.floor(maxRows / 2), Math.max(0, ac_tracks.length - maxRows)));
				break;
			}
		}
	}
	if (ac_scroll > Math.max(0, ac_tracks.length - maxRows)) ac_scroll = Math.max(0, ac_tracks.length - maxRows);
	ac_rowsTop = y; ac_rowH = rowH; ac_maxRows = maxRows; ac_visH = visH;
	// 列: 序号 | 标题 | 年份 编码采样率 时长
	var numW = z(52), lenW = z(64), techW = z(150), yrW = z(54);
	var yrX   = acW - R - yrW;
	var lenX  = yrX - lenW - z(22);
	var techX = lenX - techW - z(22);
	var titleX = L + numW + z(10);
	var titleW = techX - titleX - z(14);
	for (var r = 0; r < maxRows; r++) {
		var ti = ac_scroll + r;
		if (ti >= ac_tracks.length) break;
		var t = ac_tracks[ti];
		var ry = y + r * rowH;
		if (ti === ac_hover) gr.FillSolidRect(L - z(8), ry, acW - L - R + z(16), rowH, blendColors(ac_colBg, 0xFFFFFFFF, 0.045));
		if (t.isPlaying) {
			gr.FillSolidRect(L - z(8), ry, acW - L - R + z(16), rowH, (ac_colAcc & 0x00FFFFFF) | 0x16000000);
			gr.FillSolidRect(L - z(14), ry + z(7), z(3), rowH - z(14), ac_colAcc);
		}
		var q = plman.FindPlaybackQueueItemIndex(t.metadb, ac_pl, t.idx) + 1;
		if (q > 0) {
			gr.FillEllipse(z(3), ry + Math.round(rowH / 2) - z(9), z(18), z(18), ac_colAcc);
			gr.GdiDrawText(String(q), ac_fQ, ac_colBg, z(3), ry + Math.round(rowH / 2) - z(9), z(18), z(18), AC_C);
		}
		var tcol = t.isPlaying ? ac_colAcc : blendColors(ac_colBg, ac_colTxt, 0.88);
		gr.GdiDrawText(t.num, ac_fNum, ac_colFaint, L, ry, numW, rowH, AC_L);
		gr.GdiDrawText(t.title, ac_fRow, tcol, titleX, ry, titleW, rowH, AC_L);
		gr.GdiDrawText(t.year, ac_fNum, ac_colFaint, yrX, ry, yrW, rowH, AC_R);
		gr.GdiDrawText(t.cod, ac_fNum, ac_colGhost, techX, ry, techW, rowH, AC_L);
		gr.GdiDrawText(t.br, ac_fNum, ac_colFaint, techX, ry, techW, rowH, AC_R);
		gr.GdiDrawText(t.len, ac_fNum, ac_colSub, lenX, ry, lenW, rowH, AC_R);
	}
	// 滚动渐隐与指示条
	var bp = ac_bgParts();
	if (ac_scroll > 0)
		gr.FillGradRect(0, y, acW, z(20), 90, RGBA(bp[0], bp[1], bp[2], 235), RGBA(bp[0], bp[1], bp[2], 0), 1.0);
	if (ac_scroll + maxRows < ac_tracks.length)
		gr.FillGradRect(0, y + visH - z(20), acW, z(20), 90, RGBA(bp[0], bp[1], bp[2], 0), RGBA(bp[0], bp[1], bp[2], 235), 1.0);
	if (ac_tracks.length > maxRows) {
		var thumbH = Math.max(z(24), visH * maxRows / ac_tracks.length);
		var thumbY = y + (visH - thumbH) * (ac_scroll / (ac_tracks.length - maxRows));
		gr.FillSolidRect(acW - z(5), thumbY, z(2), thumbH, (ac_colAcc & 0x00FFFFFF) | 0x60000000);
	}
}

// ---------- 交互 ----------
function ac_rowAt(x, y) {
	if (y < ac_rowsTop || !ac_tracks.length) return -1;
	var r = Math.floor((y - ac_rowsTop) / ac_rowH);
	if (r < 0 || r >= ac_maxRows) return -1;
	var ti = ac_scroll + r;
	return ti < ac_tracks.length ? ti : -1;
}

function on_mouse_move(x, y) {
	var c = ac_ctlAt(x, y);
	var np = (!c && fb.IsPlaying && x >= z(26) && x <= z(26) + Math.round(acW * 0.34) && y >= z(12) && y <= z(12) + z(56));
	var h = (c || np) ? -1 : ac_rowAt(x, y);
	if (c !== ac_ctlHover || h !== ac_hover || np !== ac_npHover) { ac_ctlHover = c; ac_hover = h; ac_npHover = np; window.Repaint(); }
}

function on_mouse_leave() {
	if (ac_hover !== -1 || ac_ctlHover || ac_ctlDown || ac_npHover) { ac_hover = -1; ac_ctlHover = ""; ac_ctlDown = ""; ac_npHover = false; window.Repaint(); }
}

function on_mouse_lbtn_down(x, y) {
	var c = ac_ctlAt(x, y);
	if (c) { ac_ctlDown = c; window.Repaint(); }
}

function on_mouse_lbtn_up(x, y) {
	var c = ac_ctlAt(x, y);
	if (c && c === ac_ctlDown) {
		if (c === "prev") fb.Prev();
		else if (c === "play") fb.PlayOrPause();
		else if (c === "next") fb.Next();
		else if (c === "ord0") plman.PlaybackOrder = 0;
		else if (c === "ord1") plman.PlaybackOrder = 1;
		else if (c === "ord4") plman.PlaybackOrder = 4;
	} else if (!c && ac_npHover) ac_goHome();
	if (ac_ctlDown) { ac_ctlDown = ""; window.Repaint(); }
}

function on_mouse_wheel(step) {
	if (!ac_tracks.length) return;
	ac_scroll -= step * 3;
	if (ac_scroll < 0) ac_scroll = 0;
	if (ac_scroll > Math.max(0, ac_tracks.length - ac_maxRows)) ac_scroll = Math.max(0, ac_tracks.length - ac_maxRows);
	window.Repaint();
}

function on_mouse_lbtn_dblclk(x, y) {
	if (ac_ctlAt(x, y)) return;
	var ti = ac_rowAt(x, y);
	if (ti < 0 || ac_pl < 0) return;
	plman.ActivePlaylist = ac_pl;
	plman.ExecutePlaylistDefaultAction(ac_pl, ac_tracks[ti].idx);
}

// 原生右键菜单 (与 foobar2000 原版一致: 移除/队列/标签/转换/属性...)
function on_mouse_rbtn_up(x, y) {
	var ti = ac_rowAt(x, y);
	if (ti < 0 || ac_pl < 0) return;
	var t = ac_tracks[ti];
	plman.ClearPlaylistSelection(ac_pl);
	plman.SetPlaylistSelectionSingle(ac_pl, t.idx, true);
	plman.SetPlaylistFocusItem(ac_pl, t.idx);
	var sel = plman.GetPlaylistSelectedItems(ac_pl);
	var menu = window.CreatePopupMenu();
	var Context = fb.CreateContextMenuManager();
	Context.InitContext(sel);
	menu.AppendMenuItem(MF_STRING, 1, "移除");
	menu.AppendMenuSeparator();
	Context.BuildMenu(menu, 10, -1);
	var ret = menu.TrackPopupMenu(x, y);
	if (ret === 1) plman.RemovePlaylistSelection(ac_pl, false);
	else if (ret >= 10) Context.ExecuteByID(ret - 10);
	return true;
}

// ---------- 回调 ----------
function on_notify_data(name, info) {
	if (name === "cf_album" && info && info.length >= 2) ac_build(info[0], info[1]);
}
function on_init() { ac_colors(); ac_selfInit(); }
function on_size() { acW = window.Width; acH = window.Height; }
function on_colours_changed() { ac_colors(); window.Repaint(); }
function on_playlist_switch() { ac_selfInit(); }
function on_playlist_items_added(p) { if (p === ac_pl) ac_rebuildByKey(); }
function on_playlist_items_removed(p) { if (p === ac_pl) ac_rebuildByKey(); }
function on_playlist_items_reordered(p) { if (p === ac_pl) ac_rebuildByKey(); }
function on_playback_new_track() { ac_updPlaying(); }
function on_playback_time() { window.RepaintRect(Math.max(0, acW - z(240)), 0, z(240), z(70)); }
function on_playback_pause() { window.Repaint(); }
function on_playback_order_changed() { window.Repaint(); }
function on_playback_queue_changed() { window.Repaint(); }
function on_playback_starting() { window.Repaint(); }
function on_playback_stop(reason) { if (reason !== 2) ac_updPlaying(); }

on_size();
ac_colors();
ac_selfInit();
