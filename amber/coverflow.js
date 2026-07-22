// ============================================================
//  amber coverflow — 伪3D封面轮播 (为琥珀主题定制)
//  用法: 面板脚本只保留一行
//    include(fb.ProfilePath + 'amber\\coverflow.js');
//  滚轮/←→ 切换 · 单击侧面封面居中 · 双击中心/回车 播放该专辑
//  数据源: 当前激活的播放列表, 按专辑分组
// ============================================================
window.DefinePanel('amber coverflow', {author: 'amber'});
include(fb.ProfilePath + 'amber\\amber-lib.js');
var zdpi = 1, dark_mode = 0;

// ---------- 可调参数 ----------
var CF_CACHE_PX   = 500;   // 封面缓存分辨率
var CF_SIZE_W     = 0.30;  // 中心封面宽占面板宽比例
var CF_SIZE_H     = 0.62;  // 中心封面高占面板高比例
var CF_STEP       = 0.34;  // 相邻封面间距(相对中心封面)
var CF_CENTER_GAP = 0.24;  // 中心封面两侧额外留白
var CF_SCALE_K    = 0.42;  // 侧面缩小速率
var CF_DIM_K      = 95;    // 侧面压暗速率
var CF_REFL       = 0.32;  // 倒影高度比例
var CF_RANGE      = 4;     // 单侧绘制数量
// ------------------------------

var cfW = 0, cfH = 0;
var cf_albums = [];
var cf_pos = 0, cf_target = 0, cf_animTimer = null;
var cf_srcPl = -1;
var cf_hits = [];
var cf_artCache = {};
var CF_HAS_FLIP = true;

var cf_colBg, cf_colTxt, cf_colSub, cf_colAcc;
var cf_fontTitle = gdi.Font("Microsoft YaHei UI", 32, 1);
var cf_fontSub   = gdi.Font("Microsoft YaHei UI", 18, 0);
var cf_fontNote  = gdi.Font("Segoe UI Symbol", 40, 0);

var CF_FMT = 0x1 | 0x4 | 0x20 | 0x800 | 0x8000; // center|vcenter|single|noprefix|ellipsis
var CF_FMT_R = 0x2 | 0x4 | 0x20 | 0x800;        // right|vcenter|single|noprefix

var CF_TF_KEY  = fb.TitleFormat("[%album artist%]|$if2(%album%,'(单曲)')|[%date%]");
var CF_TF_ALB  = fb.TitleFormat("$if2(%album%,'(单曲)')");
var CF_TF_ART  = fb.TitleFormat("$if2(%album artist%,$if2(%artist%,'未知艺术家'))");
var CF_TF_DATE = fb.TitleFormat("[%date%]");

function cf_getColors() {
	cf_colBg  = (typeof AMBER_BG != "undefined" && AMBER_BG) ? AMBER_BG : window.GetColourDUI(ColorTypeDUI.background);
	cf_colTxt = window.GetColourDUI(ColorTypeDUI.text);
	cf_colAcc = (typeof AMBER_ACCENT != "undefined" && AMBER_ACCENT) ? AMBER_ACCENT : window.GetColourDUI(ColorTypeDUI.highlight);
	cf_colSub = blendColors(cf_colBg, cf_colTxt, 0.55);
}

function cf_bgParts() {
	return [(cf_colBg >> 16) & 0xFF, (cf_colBg >> 8) & 0xFF, cf_colBg & 0xFF];
}

function cf_clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

// ---------- 数据 ----------
function cf_build(keepPos) {
	cf_srcPl = plman.ActivePlaylist;
	cf_albums = [];
	if (cf_srcPl < 0) { window.Repaint(); return; }
	var list = plman.GetPlaylistItems(cf_srcPl);
	var total = list.Count;
	var idx = {};
	for (var i = 0; i < total; i++) {
		var hnd = list[i];
		var key = CF_TF_KEY.EvalWithMetadb(hnd);
		if (idx[key] === undefined) {
			idx[key] = cf_albums.length;
			cf_albums.push({
				key: key,
				name: CF_TF_ALB.EvalWithMetadb(hnd),
				artist: CF_TF_ART.EvalWithMetadb(hnd),
				year: String(CF_TF_DATE.EvalWithMetadb(hnd)).substring(0, 4),
				metadb: hnd,
				firstIdx: i,
				count: 1,
				img: undefined, refl: null, pending: false,
				isPlaying: false
			});
		} else {
			cf_albums[idx[key]].count++;
		}
	}
	cf_markPlaying();
	var n = cf_albums.length;
	if (!keepPos) {
		var start = 0;
		for (var j = 0; j < n; j++) if (cf_albums[j].isPlaying) { start = j; break; }
		cf_pos = cf_target = n ? cf_clamp(start, 0, n - 1) : 0;
		cf_notifyFocus();
	} else {
		cf_pos = cf_clamp(cf_pos, 0, Math.max(0, n - 1));
		cf_target = cf_clamp(Math.round(cf_target), 0, Math.max(0, n - 1));
	}
	window.Repaint();
}

function cf_markPlaying() {
	var npKey = null;
	if (fb.IsPlaying) {
		var np = fb.GetNowPlaying();
		if (np) npKey = CF_TF_KEY.EvalWithMetadb(np);
	}
	for (var i = 0; i < cf_albums.length; i++) cf_albums[i].isPlaying = (npKey !== null && cf_albums[i].key === npKey);
}

// ---------- 封面加载 ----------
function cf_makeRefl(img) {
	if (!img || !CF_HAS_FLIP) return null;
	try {
		var r = img.Clone(0, 0, img.Width, img.Height);
		r.RotateFlip(6); // RotateNoneFlipY
		return r;
	} catch (e) { CF_HAS_FLIP = false; return null; }
}

function cf_ensureArt(i) {
	var a = cf_albums[i];
	if (!a || a.img !== undefined || a.pending) return;
	var c = cf_artCache[a.key];
	if (c) { a.img = c.img; a.refl = c.refl; return; }
	a.pending = true;
	(async function() {
		var img = null;
		try {
			var r = await utils.GetAlbumArtAsyncV2(0, a.metadb, 0, false);
			img = r ? r.image : null;
		} catch (e) { img = null; }
		try {
			if (img) {
				var s = Math.min(CF_CACHE_PX / img.Width, CF_CACHE_PX / img.Height);
				if (s < 1) img = img.Resize(Math.max(1, Math.floor(img.Width * s)), Math.max(1, Math.floor(img.Height * s)), 2);
			}
		} catch (e2) { img = null; }
		a.img = img || null;
		a.refl = cf_makeRefl(a.img);
		a.pending = false;
		cf_artCache[a.key] = { img: a.img, refl: a.refl };
		window.Repaint();
	})();
}

// ---------- 动画 ----------
function cf_animate() {
	if (cf_animTimer) return;
	var last = Date.now();
	cf_animTimer = setInterval(function() {
		var now = Date.now();
		var dt = Math.min(100, now - last);
		last = now;
		var diff = cf_target - cf_pos;
		if (Math.abs(diff) < 0.002) {
			cf_pos = cf_target;
			clearInterval(cf_animTimer);
			cf_animTimer = null;
			cf_notifyFocus();
		} else {
			var k = 1 - Math.exp(-dt / 110);
			cf_pos += diff * k;
		}
		window.Repaint();
	}, 16);
}

// 通知下方播放列表滚动到当前居中的专辑
function cf_notifyFocus() {
	if (!cf_albums.length) return;
	var i = cf_clamp(Math.round(cf_pos), 0, cf_albums.length - 1);
	var a = cf_albums[i];
	if (a && cf_srcPl === plman.ActivePlaylist) {
		window.NotifyOthers("cf_focus", a.firstIdx);
		window.NotifyOthers("cf_album", [cf_srcPl, a.firstIdx]);
	}
}

// ---------- 自动回到正在播放的专辑 ----------
var CF_RETURN_SEC = 8;   // 手动浏览停止 N 秒后回到正在播放的专辑
var cf_returnTimer = null, cf_lastUser = 0;
function cf_touchUser() {
	cf_lastUser = Date.now();
	if (cf_returnTimer) { clearTimeout(cf_returnTimer); cf_returnTimer = null; }
	cf_returnTimer = setTimeout(cf_returnToPlaying, CF_RETURN_SEC * 1000);
}
function cf_returnToPlaying() {
	cf_returnTimer = null;
	for (var i = 0; i < cf_albums.length; i++) {
		if (cf_albums[i].isPlaying) {
			if (cf_target !== i) { cf_target = i; cf_animate(); }
			return;
		}
	}
}

function cf_play(i) {
	var a = cf_albums[i];
	if (!a || cf_srcPl < 0) return;
	plman.ActivePlaylist = cf_srcPl;
	plman.ExecutePlaylistDefaultAction(cf_srcPl, a.firstIdx);
}

// ---------- 绘制 ----------
function on_paint(gr) {
	if (!cf_colBg) cf_getColors();
	try { gr.SetInterpolationMode(cf_animTimer ? 0 : 7); } catch (e) {}
	gr.FillSolidRect(0, 0, cfW, cfH, cf_colBg);
	cf_hits = [];
	var n = cf_albums.length;
	if (!n) {
		gr.GdiDrawText("当前列表没有曲目", cf_fontSub, cf_colSub, 0, 0, cfW, cfH, CF_FMT);
		return;
	}
	var S = Math.min(cfW * CF_SIZE_W, cfH * CF_SIZE_H, (cfH * 0.34 - z(100)) / CF_REFL);
	if (S < z(60)) S = z(60);
	var cx = cfW / 2;
	var floorY = Math.round(cfH * 0.61);
	var iMin = cf_clamp(Math.floor(cf_pos) - CF_RANGE, 0, n - 1);
	var iMax = cf_clamp(Math.ceil(cf_pos) + CF_RANGE, 0, n - 1);
	var order = [];
	for (var i = iMin; i <= iMax; i++) { cf_ensureArt(i); order.push(i); }
	order.sort(function(a, b) { return Math.abs(b - cf_pos) - Math.abs(a - cf_pos); });

	var bp = cf_bgParts();
	for (var k = 0; k < order.length; k++) {
		var idx2 = order[k];
		var a = cf_albums[idx2];
		var d = idx2 - cf_pos;
		var ad = Math.abs(d);
		var scale = 1 / (1 + CF_SCALE_K * ad);
		var size = S * scale;
		var sgn = d > 0 ? 1 : (d < 0 ? -1 : 0);
		var x = cx + d * S * CF_STEP + sgn * Math.min(1, ad) * S * CF_CENTER_GAP;
		var alpha = Math.round(255 - Math.min(140, CF_DIM_K * ad));
		var dw = size, dh = size, iw = 0, ih = 0;
		if (a.img) {
			iw = a.img.Width; ih = a.img.Height;
			var rr = Math.min(size / iw, size / ih);
			dw = iw * rr; dh = ih * rr;
		}
		var dx = x - dw / 2;
		var dy = floorY - dh;
		if (a.img) {
			gr.DrawImage(a.img, dx, dy, dw, dh, 0, 0, iw, ih, 0, alpha);
			if (a.refl) {
				var rH = Math.round(dh * CF_REFL);
				var srcH = Math.max(1, Math.round(ih * (rH / dh)));
				gr.DrawImage(a.refl, dx, floorY + z(2), dw, rH, 0, 0, iw, srcH, 0, Math.round(alpha * 0.30));
			}
		} else {
			gr.FillSolidRect(dx, dy, dw, dh, blendColors(cf_colBg, 0xFFFFFFFF, 0.06));
			gr.GdiDrawText("♪", cf_fontNote, cf_colSub, dx, dy, dw, dh, CF_FMT);
		}
		if (ad < 0.6) {
			var ga = Math.round((1 - ad / 0.6) * 210);
			gr.DrawRect(dx - 1, dy - 1, dw + 1, dh + 1, 1, (cf_colAcc & 0x00FFFFFF) | (ga << 24));
		}
		if (a.isPlaying) {
			gr.FillEllipse(dx + dw - z(17), dy + z(7), z(10), z(10), RGBA(0, 0, 0, 130));
			gr.FillEllipse(dx + dw - z(15), dy + z(9), z(6), z(6), cf_colAcc);
		}
		cf_hits.push({ x: dx, y: dy, w: dw, h: dh, i: idx2 });
	}
	// 倒影渐隐幕布
	gr.FillGradRect(0, floorY + z(1), cfW, Math.round(S * CF_REFL) + z(6), 90,
		RGBA(bp[0], bp[1], bp[2], 150), RGBA(bp[0], bp[1], bp[2], 255), 1.0);
	// 右上角位置计数 (专辑信息已移交下方专辑卡)
	gr.GdiDrawText((Math.round(cf_pos) + 1) + " / " + n, cf_fontSub, blendColors(cf_colBg, cf_colTxt, 0.38), cfW - z(120), z(8), z(104), z(22), CF_FMT_R);
	// 中心专辑标题/副标题
	var cur = cf_albums[cf_clamp(Math.round(cf_pos), 0, n - 1)];
	if (cur) {
		var ty = Math.min(cfH - z(100), floorY + Math.round(S * CF_REFL) + z(8));
		gr.GdiDrawText(cur.name, cf_fontTitle, blendColors(cf_colBg, cf_colTxt, 0.94), z(10), ty, cfW - z(20), z(50), CF_FMT);
		var sub = cur.artist + (cur.year ? "  ·  " + cur.year : "") + "  ·  " + cur.count + " 首";
		gr.GdiDrawText(sub, cf_fontSub, cf_colSub, z(10), ty + z(52), cfW - z(20), z(32), CF_FMT);
	}
}

// ---------- 交互 ----------
function cf_hitTest(x, y) {
	for (var k = cf_hits.length - 1; k >= 0; k--) {
		var r = cf_hits[k];
		if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.i;
	}
	return -1;
}

function on_mouse_wheel(step) {
	if (!cf_albums.length) return;
	cf_touchUser();
	cf_target = cf_clamp(Math.round(cf_target) - step, 0, cf_albums.length - 1);
	cf_animate();
}

function on_mouse_lbtn_up(x, y) {
	var i = cf_hitTest(x, y);
	if (i < 0) return;
	cf_touchUser();
	if (i !== Math.round(cf_pos) || i !== cf_target) { cf_target = i; cf_animate(); }
}

function on_mouse_lbtn_dblclk(x, y) {
	var i = cf_hitTest(x, y);
	if (i >= 0 && i === Math.round(cf_pos)) cf_play(i);
}

// 整张专辑的原生右键菜单 (播放/队列/标签/转换/属性 作用于全部曲目)
function cf_albumHandles(i) {
	var a = cf_albums[i];
	var res = plman.GetPlaylistItems(-1);
	if (!a || cf_srcPl < 0) return res;
	var list = plman.GetPlaylistItems(cf_srcPl);
	for (var k = 0; k < list.Count; k++) {
		if (CF_TF_KEY.EvalWithMetadb(list[k]) === a.key) res.Add(list[k]);
	}
	return res;
}

function on_mouse_rbtn_up(x, y) {
	var i = cf_hitTest(x, y);
	if (i < 0) return;
	cf_touchUser();
	var handles = cf_albumHandles(i);
	if (!handles.Count) return;
	var menu = window.CreatePopupMenu();
	var Context = fb.CreateContextMenuManager();
	Context.InitContext(handles);
	Context.BuildMenu(menu, 10, -1);
	var ret = menu.TrackPopupMenu(x, y);
	if (ret >= 10) Context.ExecuteByID(ret - 10);
	return true;
}

function on_key_down(vkey) {
	var n = cf_albums.length;
	if (!n) return;
	cf_touchUser();
	switch (vkey) {
		case 37: cf_target = cf_clamp(Math.round(cf_target) - 1, 0, n - 1); cf_animate(); break;
		case 39: cf_target = cf_clamp(Math.round(cf_target) + 1, 0, n - 1); cf_animate(); break;
		case 36: cf_target = 0; cf_animate(); break;
		case 35: cf_target = n - 1; cf_animate(); break;
		case 13: cf_play(cf_clamp(Math.round(cf_pos), 0, n - 1)); break;
	}
}

// ---------- 生命周期与回调 ----------
function on_init() { cf_getColors(); cf_build(false); }
function on_size() { cfW = window.Width; cfH = window.Height; }
function on_colours_changed() { cf_getColors(); window.Repaint(); }
function on_playlist_switch() { cf_build(false); }
function on_playlists_changed() { if (plman.ActivePlaylist !== cf_srcPl) cf_build(false); }
function on_playlist_items_added(p) { if (p === cf_srcPl) cf_build(true); }
function on_playlist_items_removed(p) { if (p === cf_srcPl) cf_build(true); }
function on_playlist_items_reordered(p) { if (p === cf_srcPl) cf_build(true); }
function on_notify_data(name, info) {
	if (name === "amber_locate" && info && info.length >= 2) {
		if (cf_srcPl !== info[0]) cf_build(false);
		var list = plman.GetPlaylistItems(info[0]);
		if (info[1] >= list.Count) return;
		var key = CF_TF_KEY.EvalWithMetadb(list[info[1]]);
		for (var i = 0; i < cf_albums.length; i++) {
			if (cf_albums[i].key === key) {
				cf_target = i;
				cf_touchUser();
				cf_animate();
				break;
			}
		}
	}
}
function on_playback_new_track() {
	cf_markPlaying();
	if (Date.now() - cf_lastUser > 4000) cf_returnToPlaying();
	window.Repaint();
}
function on_playback_stop(reason) { if (reason !== 2) { cf_markPlaying(); window.Repaint(); } }
function on_script_unload() {
	if (cf_animTimer) { clearInterval(cf_animTimer); cf_animTimer = null; }
	if (cf_returnTimer) { clearTimeout(cf_returnTimer); cf_returnTimer = null; }
}

on_size();
cf_getColors();
cf_build(false);
