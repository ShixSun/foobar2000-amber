// ============================================================
//  amber playlists — 播放列表侧栏 (独立)
//  用法: 面板脚本只保留一行
//    include(fb.ProfilePath + 'amber\\playlists.js');
//  单击切换列表 · 滚轮滚动 · 右键管理(新建/重命名/删除)
//  顶部搜索: 检索所有列表, 命中后直接跳转到对应专辑
// ============================================================
window.DefinePanel('amber playlists', {author: 'amber'});
include(fb.ProfilePath + 'amber\\amber-lib.js');

// ---------- 可调参数 ----------
var PL_ROWH   = 42;    // 行高
var PL_F_NAME = 17;    // 列表名字号
var PL_F_CNT  = 15;    // 计数字号
// ------------------------------

var plW = 0, plH = 0;
var pl_rows = [];
var pl_scroll = 0, pl_hover = -1;
var pl_rowsTop = 0, pl_maxRows = 0, pl_visH = 0;
var pl_colBg, pl_colTxt, pl_colSub, pl_colFaint, pl_colAcc;
var pl_fName = gdi.Font("Microsoft YaHei UI", PL_F_NAME, 0);
var pl_fCnt  = gdi.Font("Microsoft YaHei UI", PL_F_CNT, 0);

var PL_L = 0x4 | 0x20 | 0x800 | 0x8000;
var PL_R = PL_L | 0x2;
var MF_STRING = 0x0;

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

// ---------- 全局搜索: 所有列表, 命中即跳 ----------
var PL_SEARCH_H = 40;
var pl_searchHover = false;
function pl_doSearch() {
	if (typeof utils.InputBox !== "function") return;
	var q = "";
	try { q = utils.InputBox(0, "搜索所有列表 (标题 / 艺术家 / 专辑):", "Amber 搜索", ""); } catch (e) { return; }
	if (!q) return;
	q = String(q).toLowerCase();
	var TF = fb.TitleFormat("%title%|[%artist%]|[%album%]");
	var order = [];
	var act = plman.ActivePlaylist;
	if (act >= 0 && !pl_hidden(plman.GetPlaylistName(act))) order.push(act);
	for (var p = 0; p < plman.PlaylistCount; p++) {
		if (p !== act && !pl_hidden(plman.GetPlaylistName(p))) order.push(p);
	}
	for (var oi = 0; oi < order.length; oi++) {
		var pi = order[oi];
		var list = plman.GetPlaylistItems(pi);
		for (var i = 0; i < list.Count; i++) {
			if (TF.EvalWithMetadb(list[i]).toLowerCase().indexOf(q) >= 0) {
				plman.ActivePlaylist = pi;
				window.NotifyOthers("amber_locate", [pi, i]);
				window.Repaint();
				return;
			}
		}
	}
	try { fb.ShowPopupMessage("没有找到匹配「" + q + "」的歌曲。", "Amber 搜索"); } catch (e2) {}
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
	gr.GdiDrawText("搜索所有列表…", pl_fCnt, pl_searchHover ? blendColors(pl_colBg, pl_colTxt, 0.75) : pl_colFaint, L + z(26), sy, plW - L - R - z(26), sh, PL_L);
	var y = sy + sh + z(6);
	var rowH = z(PL_ROWH);
	var visH = plH - y - z(8);
	var maxRows = Math.max(1, Math.floor(visH / rowH));
	if (pl_scroll > Math.max(0, pl_rows.length - maxRows)) pl_scroll = Math.max(0, pl_rows.length - maxRows);
	pl_rowsTop = y; pl_maxRows = maxRows; pl_visH = visH;
	var active = plman.ActivePlaylist;
	var cntW = z(56);
	var divCol = blendColors(pl_colBg, pl_colTxt, 0.08);
	for (var r = 0; r < maxRows; r++) {
		var ri = pl_scroll + r;
		if (ri >= pl_rows.length) break;
		var p = pl_rows[ri];
		var ry = y + r * rowH;
		var isActive = (p.idx === active);
		if (isActive) {
			var rowCol = (typeof AMBER_ROW != "undefined" && AMBER_ROW) ? AMBER_ROW : pl_colAcc;
			gr.FillSolidRect(0, ry, plW, rowH, rowCol);
		} else if (ri === pl_hover) {
			gr.FillSolidRect(0, ry, plW, rowH, blendColors(pl_colBg, 0xFFFFFFFF, 0.05));
		}
		var nameCol = isActive ? ((typeof AMBER_TXT_ON != "undefined" && AMBER_TXT_ON) ? AMBER_TXT_ON : c_white) : blendColors(pl_colBg, pl_colTxt, 0.85);
		var cntCol  = isActive ? blendColors(pl_colBg, nameCol, 0.85) : pl_colFaint;
		gr.GdiDrawText(p.name, pl_fName, nameCol, L, ry, plW - L - R - cntW, rowH, PL_L);
		gr.GdiDrawText(String(p.count), pl_fCnt, cntCol, plW - R - cntW, ry, cntW, rowH, PL_R);
		// 行间浅分割线
		if (!isActive && ri < pl_rows.length - 1) gr.FillSolidRect(L, ry + rowH - 1, plW - L - R, 1, divCol);
	}
	// 滚动渐隐与指示条
	var bp = pl_bgParts();
	if (pl_scroll > 0)
		gr.FillGradRect(0, y, plW, z(18), 90, RGBA(bp[0], bp[1], bp[2], 235), RGBA(bp[0], bp[1], bp[2], 0), 1.0);
	if (pl_scroll + maxRows < pl_rows.length)
		gr.FillGradRect(0, y + visH - z(18), plW, z(18), 90, RGBA(bp[0], bp[1], bp[2], 0), RGBA(bp[0], bp[1], bp[2], 235), 1.0);
	if (pl_rows.length > maxRows) {
		var thumbH = Math.max(z(24), visH * maxRows / pl_rows.length);
		var thumbY = y + (visH - thumbH) * (pl_scroll / (pl_rows.length - maxRows));
		gr.FillSolidRect(plW - z(4), thumbY, z(2), thumbH, (pl_colAcc & 0x00FFFFFF) | 0x60000000);
	}
}

// ---------- 交互 ----------
function pl_rowAt(x, y) {
	if (y < pl_rowsTop || !pl_rows.length) return -1;
	var r = Math.floor((y - pl_rowsTop) / z(PL_ROWH));
	if (r < 0 || r >= pl_maxRows) return -1;
	var ri = pl_scroll + r;
	return ri < pl_rows.length ? ri : -1;
}

function on_mouse_move(x, y) {
	var sh = (y >= z(6) && y <= z(6) + z(PL_SEARCH_H));
	var h = sh ? -1 : pl_rowAt(x, y);
	if (h !== pl_hover || sh !== pl_searchHover) { pl_hover = h; pl_searchHover = sh; window.Repaint(); }
}

function on_mouse_leave() {
	if (pl_hover !== -1 || pl_searchHover) { pl_hover = -1; pl_searchHover = false; window.Repaint(); }
}

function on_mouse_lbtn_up(x, y) {
	if (y >= z(6) && y <= z(6) + z(PL_SEARCH_H)) { pl_doSearch(); return; }
	var ri = pl_rowAt(x, y);
	if (ri < 0) return;
	plman.ActivePlaylist = pl_rows[ri].idx;
	window.Repaint();
}

function on_mouse_wheel(step) {
	if (!pl_rows.length) return;
	pl_scroll -= step * 2;
	if (pl_scroll < 0) pl_scroll = 0;
	if (pl_scroll > Math.max(0, pl_rows.length - pl_maxRows)) pl_scroll = Math.max(0, pl_rows.length - pl_maxRows);
	window.Repaint();
}

function on_mouse_rbtn_up(x, y) {
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

on_size();
pl_colors();
pl_build();
