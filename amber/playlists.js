// ============================================================
//  amber playlists v3 — 播放列表侧栏 (独立)
//  用法: 面板脚本只保留一行
//    include(fb.ProfilePath + 'amber\\playlists.js');
//  单击切换列表 · 滚轮滚动 · 右键管理(新建/重命名/删除)
//  搜索: 检索所有列表 → 侧栏变身结果列表, 点击跳转, ←/Esc 返回
// ============================================================
window.DefinePanel('amber playlists', {author: 'amber'});
include(fb.ProfilePath + 'amber\\amber-lib.js');

// ---------- 可调参数 ----------
var PL_ROWH     = 42;    // 列表行高
var PL_RES_ROWH = 54;    // 搜索结果行高(双行)
var PL_F_NAME   = 17;    // 列表名字号
var PL_F_CNT    = 15;    // 计数/副行字号
var PL_MAX_RES  = 400;   // 结果上限
// ------------------------------

var plW = 0, plH = 0;
var pl_rows = [];
var pl_mode = 0;                 // 0=列表 1=搜索结果
var pl_results = [], pl_query = "", pl_resSel = -1, pl_capped = false;
var pl_scroll = 0, pl_hover = -1;
var pl_rowsTop = 0, pl_maxRows = 0, pl_visH = 0, pl_curRowH = 1;
var pl_backHover = false;
var pl_colBg, pl_colTxt, pl_colSub, pl_colFaint, pl_colAcc;
var pl_fName = gdi.Font("Microsoft YaHei UI", PL_F_NAME, 0);
var pl_fCnt  = gdi.Font("Microsoft YaHei UI", PL_F_CNT, 0);

var PL_L = 0x4 | 0x20 | 0x800 | 0x8000;
var PL_R = PL_L | 0x2;
var MF_STRING = 0x0;
var PL_SEARCH_H = 40;
var PL_RESHEAD_H = 34;
var pl_searchHover = false;

var PL_TF_T   = fb.TitleFormat("$if2(%title%,%filename%)");
var PL_TF_SUB = fb.TitleFormat("$if2(%artist%,'未知艺术家')  ·  $if2(%album%,'(单曲)')");

function pl_colors() {
	pl_colBg  = (typeof AMBER_BG != "undefined" && AMBER_BG) ? AMBER_BG : window.GetColourDUI(ColorTypeDUI.background);
	pl_colTxt = window.GetColourDUI(ColorTypeDUI.text);
	pl_colAcc = (typeof AMBER_ACCENT != "undefined" && AMBER_ACCENT) ? AMBER_ACCENT : window.GetColourDUI(ColorTypeDUI.highlight);
	pl_colSub   = blendColors(pl_colBg, pl_colTxt, 0.60);
	pl_colFaint = blendColors(pl_colBg, pl_colTxt, 0.35);
}

function pl_bgParts() {
	return [(pl_colBg >> 16) & 0xFF, (pl_colBg >> 8) & 0xFF, pl_colBg & 0xFF];
}

function pl_hidden(name) {
	return name.indexOf("媒体库视图") === 0;
}

function pl_build() {
	pl_rows = [];
	var total = plman.PlaylistCount;
	for (var i = 0; i < total; i++) {
		var name = plman.GetPlaylistName(i);
		if (pl_hidden(name)) continue;
		pl_rows.push({ idx: i, name: name, count: plman.PlaylistItemCount(i) });
	}
	window.Repaint();
}

// ---------- 全局搜索 → 结果模式 ----------
function pl_doSearch() {
	if (typeof utils.InputBox !== "function") return;
	var q = "";
	try { q = utils.InputBox(0, "搜索所有列表 (标题 / 艺术家 / 专辑):", "Amber 搜索", pl_query); } catch (e) { return; }
	if (!q) return;
	var ql = String(q).toLowerCase();
	var TF = fb.TitleFormat("%title%|[%artist%]|[%album%]");
	var res = [];
	pl_capped = false;
	for (var p = 0; p < plman.PlaylistCount; p++) {
		var pname = plman.GetPlaylistName(p);
		if (pl_hidden(pname)) continue;
		var list = plman.GetPlaylistItems(p);
		for (var i = 0; i < list.Count; i++) {
			if (TF.EvalWithMetadb(list[i]).toLowerCase().indexOf(ql) >= 0) {
				res.push({ pl: p, idx: i, title: PL_TF_T.EvalWithMetadb(list[i]), sub: PL_TF_SUB.EvalWithMetadb(list[i]) });
				if (res.length >= PL_MAX_RES) { pl_capped = true; break; }
			}
		}
		if (pl_capped) break;
	}
	if (!res.length) {
		try { fb.ShowPopupMessage("没有找到匹配「" + q + "」的歌曲。", "Amber 搜索"); } catch (e2) {}
		return;
	}
	pl_query = q;
	pl_results = res;
	pl_resSel = -1;
	pl_mode = 1;
	pl_scroll = 0;
	pl_hover = -1;
	window.Repaint();
}

function pl_exitResults() {
	pl_mode = 0;
	pl_scroll = 0;
	pl_hover = -1;
	pl_backHover = false;
	window.Repaint();
}

function pl_jumpTo(r) {
	if (r.pl >= plman.PlaylistCount || r.idx >= plman.PlaylistItemCount(r.pl)) return;
	plman.ActivePlaylist = r.pl;
	window.NotifyOthers("amber_locate", [r.pl, r.idx]);
	window.Repaint();
}

// ---------- 绘制 ----------
function on_paint(gr) {
	if (!pl_colBg) pl_colors();
	gr.FillSolidRect(0, 0, plW, plH, pl_colBg);
	var L = z(18), R = z(14);
	// 搜索行
	var sy = z(6), sh = z(PL_SEARCH_H);
	var scol = pl_searchHover ? pl_colAcc : pl_colFaint;
	try { gr.SetSmoothingMode(2); } catch (e) {}
	gr.DrawEllipse(L + z(2), sy + Math.round(sh / 2) - z(8), z(11), z(11), z(2), scol);
	var lx = L + z(2) + z(10), ly = sy + Math.round(sh / 2) + z(4);
	gr.DrawLine(lx, ly, lx + z(6), ly + z(6), z(2), scol);
	var hint = pl_mode === 1 ? ("“" + pl_query + "”") : "搜索所有列表…";
	gr.GdiDrawText(hint, pl_fCnt, pl_searchHover ? blendColors(pl_colBg, pl_colTxt, 0.75) : pl_colFaint, L + z(26), sy, plW - L - R - z(26), sh, PL_L);
	var y = sy + sh + z(6);

	if (pl_mode === 1) {
		// 结果头: 返回 + 计数
		var hcol = pl_backHover ? pl_colAcc : pl_colSub;
		gr.DrawLine(L + z(2), y + Math.round(z(PL_RESHEAD_H) / 2), L + z(12), y + Math.round(z(PL_RESHEAD_H) / 2) - z(6), z(2), hcol);
		gr.DrawLine(L + z(2), y + Math.round(z(PL_RESHEAD_H) / 2), L + z(12), y + Math.round(z(PL_RESHEAD_H) / 2) + z(6), z(2), hcol);
		gr.DrawLine(L + z(2), y + Math.round(z(PL_RESHEAD_H) / 2), L + z(20), y + Math.round(z(PL_RESHEAD_H) / 2), z(2), hcol);
		var cnt = pl_results.length + " 个结果" + (pl_capped ? " (前" + PL_MAX_RES + ")" : "");
		gr.GdiDrawText(cnt, pl_fCnt, hcol, L + z(30), y, plW - L - R - z(30), z(PL_RESHEAD_H), PL_L);
		y += z(PL_RESHEAD_H) + z(2);
	}

	var rowH = pl_mode === 1 ? z(PL_RES_ROWH) : z(PL_ROWH);
	var items = pl_mode === 1 ? pl_results : pl_rows;
	var visH = plH - y - z(8);
	var maxRows = Math.max(1, Math.floor(visH / rowH));
	if (pl_scroll > Math.max(0, items.length - maxRows)) pl_scroll = Math.max(0, items.length - maxRows);
	pl_rowsTop = y; pl_maxRows = maxRows; pl_visH = visH; pl_curRowH = rowH;
	var divCol = blendColors(pl_colBg, pl_colTxt, 0.08);

	if (pl_mode === 1) {
		for (var r = 0; r < maxRows; r++) {
			var ri = pl_scroll + r;
			if (ri >= pl_results.length) break;
			var it = pl_results[ri];
			var ry = y + r * rowH;
			if (ri === pl_hover) gr.FillSolidRect(0, ry, plW, rowH, blendColors(pl_colBg, 0xFFFFFFFF, 0.05));
			if (ri === pl_resSel) gr.FillSolidRect(0, ry + z(6), z(3), rowH - z(12), pl_colAcc);
			gr.GdiDrawText(it.title, pl_fName, blendColors(pl_colBg, pl_colTxt, ri === pl_resSel ? 0.95 : 0.86), L, ry + z(5), plW - L - R, z(24), PL_L);
			gr.GdiDrawText(it.sub, pl_fCnt, pl_colFaint, L, ry + z(29), plW - L - R, z(20), PL_L);
			if (ri < pl_results.length - 1) gr.FillSolidRect(L, ry + rowH - 1, plW - L - R, 1, divCol);
		}
	} else {
		var active = plman.ActivePlaylist;
		var cntW = z(56);
		for (var r2 = 0; r2 < maxRows; r2++) {
			var ri2 = pl_scroll + r2;
			if (ri2 >= pl_rows.length) break;
			var p = pl_rows[ri2];
			var ry2 = y + r2 * rowH;
			var isActive = (p.idx === active);
			var isPlayingRow = (!isActive && fb.IsPlaying && p.idx === plman.PlayingPlaylist);
			if (isActive) {
				var rowCol = (typeof AMBER_ROW != "undefined" && AMBER_ROW) ? AMBER_ROW : pl_colAcc;
				gr.FillSolidRect(0, ry2, plW, rowH, rowCol);
			} else if (isPlayingRow) {
				var pwCol = (typeof AMBER_ROW != "undefined" && AMBER_ROW) ? AMBER_ROW : pl_colAcc;
				gr.FillSolidRect(0, ry2, plW, rowH, blendColors(pl_colBg, pwCol, ri2 === pl_hover ? 0.45 : 0.34));
				gr.FillEllipse(z(6), ry2 + Math.round(rowH / 2) - z(3), z(6), z(6), pl_colAcc);
			} else if (ri2 === pl_hover) {
				gr.FillSolidRect(0, ry2, plW, rowH, blendColors(pl_colBg, 0xFFFFFFFF, 0.05));
			}
			var nameCol = isActive ? ((typeof AMBER_TXT_ON != "undefined" && AMBER_TXT_ON) ? AMBER_TXT_ON : c_white) : blendColors(pl_colBg, pl_colTxt, isPlayingRow ? 0.93 : 0.85);
			var cntCol  = isActive ? blendColors(pl_colBg, nameCol, 0.85) : pl_colFaint;
			gr.GdiDrawText(p.name, pl_fName, nameCol, L, ry2, plW - L - R - cntW, rowH, PL_L);
			gr.GdiDrawText(String(p.count), pl_fCnt, cntCol, plW - R - cntW, ry2, cntW, rowH, PL_R);
			if (!isActive && !isPlayingRow && ri2 < pl_rows.length - 1) gr.FillSolidRect(L, ry2 + rowH - 1, plW - L - R, 1, divCol);
		}
	}
	// 滚动渐隐与指示条
	var bp = pl_bgParts();
	if (pl_scroll > 0)
		gr.FillGradRect(0, y, plW, z(18), 90, RGBA(bp[0], bp[1], bp[2], 235), RGBA(bp[0], bp[1], bp[2], 0), 1.0);
	if (pl_scroll + maxRows < items.length)
		gr.FillGradRect(0, y + visH - z(18), plW, z(18), 90, RGBA(bp[0], bp[1], bp[2], 0), RGBA(bp[0], bp[1], bp[2], 235), 1.0);
	if (items.length > maxRows) {
		var thumbH = Math.max(z(24), visH * maxRows / items.length);
		var thumbY = y + (visH - thumbH) * (pl_scroll / (items.length - maxRows));
		gr.FillSolidRect(plW - z(4), thumbY, z(2), thumbH, (pl_colAcc & 0x00FFFFFF) | 0x60000000);
	}
}

// ---------- 交互 ----------
function pl_rowAt(x, y) {
	var items = pl_mode === 1 ? pl_results : pl_rows;
	if (y < pl_rowsTop || !items.length) return -1;
	var r = Math.floor((y - pl_rowsTop) / pl_curRowH);
	if (r < 0 || r >= pl_maxRows) return -1;
	var ri = pl_scroll + r;
	return ri < items.length ? ri : -1;
}

function pl_inSearch(y) { return y >= z(6) && y <= z(6) + z(PL_SEARCH_H); }
function pl_inResHead(y) {
	if (pl_mode !== 1) return false;
	var top = z(6) + z(PL_SEARCH_H) + z(6);
	return y >= top && y <= top + z(PL_RESHEAD_H);
}

function on_mouse_move(x, y) {
	var sh = pl_inSearch(y);
	var bh = pl_inResHead(y);
	var h = (sh || bh) ? -1 : pl_rowAt(x, y);
	if (h !== pl_hover || sh !== pl_searchHover || bh !== pl_backHover) {
		pl_hover = h; pl_searchHover = sh; pl_backHover = bh; window.Repaint();
	}
}

function on_mouse_leave() {
	if (pl_hover !== -1 || pl_searchHover || pl_backHover) { pl_hover = -1; pl_searchHover = false; pl_backHover = false; window.Repaint(); }
}

function on_mouse_lbtn_up(x, y) {
	if (pl_inSearch(y)) { pl_doSearch(); return; }
	if (pl_inResHead(y)) { pl_exitResults(); return; }
	var ri = pl_rowAt(x, y);
	if (ri < 0) return;
	if (pl_mode === 1) {
		pl_resSel = ri;
		pl_jumpTo(pl_results[ri]);
	} else {
		plman.ActivePlaylist = pl_rows[ri].idx;
		window.Repaint();
	}
}

function on_mouse_wheel(step) {
	var items = pl_mode === 1 ? pl_results : pl_rows;
	if (!items.length) return;
	pl_scroll -= step * 2;
	if (pl_scroll < 0) pl_scroll = 0;
	if (pl_scroll > Math.max(0, items.length - pl_maxRows)) pl_scroll = Math.max(0, items.length - pl_maxRows);
	window.Repaint();
}

function on_key_down(vkey) {
	if (vkey === 27 && pl_mode === 1) pl_exitResults();
}

function on_mouse_rbtn_up(x, y) {
	if (pl_mode === 1) { pl_exitResults(); return true; }
	var ri = pl_rowAt(x, y);
	var menu = window.CreatePopupMenu();
	menu.AppendMenuItem(MF_STRING, 1, "新建播放列表");
	if (ri >= 0) {
		menu.AppendMenuSeparator();
		menu.AppendMenuItem(MF_STRING, 2, "重命名「" + pl_rows[ri].name + "」");
		menu.AppendMenuItem(MF_STRING, 3, "删除「" + pl_rows[ri].name + "」");
	}
	var ret = menu.TrackPopupMenu(x, y);
	if (ret === 1) {
		var pidx = plman.PlaylistCount;
		plman.CreatePlaylist(pidx, "新建列表");
		plman.ActivePlaylist = pidx;
		pl_build();
	} else if (ret === 2 && ri >= 0) {
		try {
			var nn = utils.InputBox(0, "新名称:", "重命名播放列表", pl_rows[ri].name);
			if (nn && nn !== pl_rows[ri].name) plman.RenamePlaylist(pl_rows[ri].idx, nn);
		} catch (e) {}
		pl_build();
	} else if (ret === 3 && ri >= 0) {
		var cm = window.CreatePopupMenu();
		cm.AppendMenuItem(MF_STRING, 1, "确认删除「" + pl_rows[ri].name + "」(" + pl_rows[ri].count + " 首)");
		cm.AppendMenuItem(MF_STRING, 2, "取消");
		if (cm.TrackPopupMenu(x, y) === 1) {
			plman.RemovePlaylist(pl_rows[ri].idx);
			pl_build();
		}
	}
	return true; // 阻止默认菜单
}

// ---------- 回调 ----------
function on_init() { pl_colors(); pl_build(); }
function on_size() { plW = window.Width; plH = window.Height; }
function on_colours_changed() { pl_colors(); window.Repaint(); }
function on_playlists_changed() { pl_build(); }
function on_playlist_switch() { window.Repaint(); }
function on_playlist_items_added(p) { pl_build(); }
function on_playlist_items_removed(p) { pl_build(); }
function on_playback_new_track() { window.Repaint(); }
function on_playback_stop() { window.Repaint(); }

on_size();
pl_colors();
pl_build();
