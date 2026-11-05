// Snowed Under: the step-by-step story. Each step sets its copy and the state of every visual
// (sky, snow's word-dots, the chart, the quizzes), so moving forward or back always lands cleanly.
(function () {
  var D = window.SNOW_DATA;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s) { return document.querySelector(s); }
  function fmt(n) { return n.toLocaleString('en-US'); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function seeded(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function noTransition(node, fn) {
    var all = [node].concat(Array.prototype.slice.call(node.querySelectorAll('*')));
    all.forEach(function (n) { n.style.transition = 'none'; });
    fn(); void node.offsetWidth;
    all.forEach(function (n) { n.style.transition = ''; });
  }

  var copyEl = $('#copy'), viz = $('#viz'), body = document.body;
  var nextBtn = $('#next'), backBtn = $('#back'), folio = $('#folio'), rhRight = $('#rhRight');
  var HOOK_N = D.top.reduce(function (s, d) { return s + d.s; }, 0);
  var AVG_M = D.top.reduce(function (s, d) { return s + d.m; }, 0) / D.top.length;

  var st = { i: -1, meaningsGuess: null, found: {}, pairsDone: {}, pairsShown: false, prevWords: 'off', titleDone: false };

  // ---------- Geometry ----------
  function geo() { var W = innerWidth, H = innerHeight; return { W: W, H: H, phone: W < 760 }; }
  // Three page layouts: 'center' (text in the middle of the page, figures around it),
  // 'cols' (desktop: text column and figure side by side, centered as a pair) and
  // 'phone' (text on top, figure below).
  var GAP = 72;
  function stepLayout() {
    var s = STEPS[st.i] || {}, g = geo();
    if (s.center && !(g.phone && s.center === 'desktop')) return 'center';
    return g.phone ? 'phone' : 'cols';
  }
  function colGeom(g, s) {
    var cw = Math.min(380, g.W * 0.3);
    var vw = s.vw ? Math.min(s.vw, g.W - cw - GAP - 160) : 0;
    var total = cw + (vw ? GAP + vw : 0), left = Math.max(64, (g.W - total) / 2);
    return { left: left, copyW: cw, vx: left + cw + GAP, vw: vw };
  }
  function placeCopy() {
    var g = geo(), s = STEPS[st.i] || {}, mode = stepLayout();
    copyEl.classList.toggle('centered', mode === 'center');
    if (mode === 'center') {
      var w = g.phone ? g.W - 56 : Math.min(540, g.W * 0.42);
      var top0 = g.phone ? 56 : 80, bot = g.H - (g.phone ? 64 : 80);
      copyEl.style.width = w + 'px'; copyEl.style.left = ((g.W - w) / 2) + 'px';
      copyEl.style.maxHeight = (bot - top0) + 'px';
      copyEl.style.top = Math.max(top0, top0 + (bot - top0 - copyEl.offsetHeight) / 2 + (g.phone ? 0 : (s.copyDy || 0))) + 'px';
    } else if (mode === 'phone') {
      copyEl.style.left = '24px'; copyEl.style.top = '56px'; copyEl.style.width = (g.W - 24 - 40) + 'px';
      copyEl.style.maxHeight = (g.H - 56 - 66) + 'px';
    } else {
      var c = colGeom(g, s);
      copyEl.style.left = c.left + 'px'; copyEl.style.width = c.copyW + 'px'; copyEl.style.maxHeight = (g.H - 84 - 80) + 'px';
      copyEl.style.top = Math.max(84, (g.H - copyEl.offsetHeight) / 2 - 10) + 'px';
    }
    // Only scroll when the text is genuinely taller than its space (never for a tilted note).
    copyEl.style.overflowY = 'visible';
    copyEl.style.overflowY = copyEl.scrollHeight > parseFloat(copyEl.style.maxHeight) + 4 ? 'auto' : 'visible';
  }
  function vizRect() {
    var g = geo(), s = STEPS[st.i] || {}, mode = stepLayout();
    var c = copyEl.getBoundingClientRect();
    if (mode === 'center') {
      var x = g.phone ? 20 : 64, y = g.phone ? 52 : 70;
      return { x: x, y: y, w: g.W - x - (g.phone ? 30 : 80), h: g.H - y - (g.phone ? 62 : 76),
        copy: { x: c.left, y: c.top, w: c.width, h: c.height } };
    }
    if (mode === 'phone') {
      var top = Math.max(c.bottom + 16, g.H * 0.24);
      return { x: 24, y: top, w: g.W - 24 - 36, h: g.H - 64 - top };
    }
    var cg = colGeom(g, s);
    return { x: cg.vx, y: 84, w: cg.vw, h: g.H - 84 - 80 };
  }

  // ---------- Placing words along a path (a ring around the text, or a butt) ----------
  function pathLengths(pts) {
    var L = [0];
    for (var i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return L;
  }
  function pointAt(pts, L, s) {
    var lo = 0, hi = L.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (L[mid] < s) lo = mid; else hi = mid; }
    var seg = (L[hi] - L[lo]) || 1, f = (s - L[lo]) / seg;
    return { x: pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, y: pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f,
      a: Math.atan2(pts[hi][1] - pts[lo][1], pts[hi][0] - pts[lo][0]) };
  }
  // Spaces upright words evenly along the path, shrinking them if they don't fit. Words that
  // still don't fit at the smallest size are left out (returned in `rest`).
  function placeOnPath(list, pts, o) {
    o = o || {};
    var L = pathLengths(pts), P = L[L.length - 1], start = o.start || 0, end = P - (o.end || 0);
    function foot(w, a) { var lh = curSize * 1.25; return Math.abs(w.lw * Math.cos(a)) + Math.abs(lh * Math.sin(a)); }
    function greedy(gap) {
      var sPos = start, out = [];
      for (var i = 0; i < list.length; i++) {
        var w = list[i], f = foot(w, pointAt(pts, L, sPos + 10).a);
        var c = sPos + f / 2;
        f = foot(w, pointAt(pts, L, Math.min(c, P)).a); c = sPos + f / 2;
        if (sPos + f > end) break;
        out.push([w, c]); sPos += f + gap;
      }
      return { out: out, used: sPos };
    }
    var sizes = o.sizes || sizesToTry(), res;
    for (var si = 0; si < sizes.length; si++) { wordSize(sizes[si]); res = greedy(10); if (res.out.length === list.length) break; }
    var n = res.out.length, slack = n ? Math.max(0, (end - res.used) / n) : 0;
    res = greedy(10 + slack);
    var r = seeded(o.seed || 1), lh = curSize * 1.25;
    var targets = res.out.map(function (p) {
      var pt = pointAt(pts, L, p[1]), j = o.jitter ? (r() - 0.5) * 2 * o.jitter : 0;
      var nx = -Math.sin(pt.a), ny = Math.cos(pt.a);
      return [p[0], pt.x + nx * j - p[0].lw / 2, pt.y + ny * j - lh / 2];
    });
    return { targets: targets, rest: list.slice(n) };
  }
  function ellipsePts(cx, cy, a, b, n) {
    var pts = [];
    for (var k = 0; k <= n; k++) { var t = -Math.PI / 2 + 2 * Math.PI * k / n; pts.push([cx + a * Math.cos(t), cy + b * Math.sin(t)]); }
    return pts;
  }
  // Snow's words around centered text: an oval on desktop, above and below the text on phones.
  function aroundLayout(list, R, seed) {
    var c = R.copy, g = geo();
    if (g.phone) {
      var above = { x: R.x, y: R.y, w: R.w, h: Math.max(0, c.y - 16 - R.y) };
      var by = c.y + c.h + 16, below = { x: R.x, y: by, w: R.w, h: Math.max(0, R.y + R.h - by) };
      var nA = Math.round(list.length * above.h / Math.max(1, above.h + below.h));
      return { targets: driftLayout(list.slice(0, nA), above, seed).concat(driftLayout(list.slice(nA), below, seed + 1)), rest: [] };
    }
    var cx = c.x + c.w / 2, cy = Math.min(Math.max(c.y + c.h / 2, R.y + R.h / 2 - 40), R.y + R.h / 2 + 40);
    var a = Math.min(R.w / 2 - 70, c.w / 2 + 210);
    var b = Math.max(c.h / 2 + 46, Math.min(Math.min(cy - R.y, R.y + R.h - cy) - 22, c.h / 2 + 150));
    return placeOnPath(list, ellipsePts(cx, cy, a, b, 480), { jitter: 14, seed: seed });
  }

  // ---------- Snow's 29 word-dots ----------
  var WD = [];
  D.senses.forEach(function (s) {
    s.words.forEach(function (w) {
      var e = el('div', 'wd hide nolabel');
      var b = el('span', 'bob');
      var d = el('i', 'd'); var l = el('span', 'l', w);
      b.appendChild(d); b.appendChild(l); e.appendChild(b); viz.appendChild(e);
      WD.push({ el: e, dot: d, word: w, sense: s.n, color: s.color, x: 0, y: -60 });
    });
  });
  // The afterword's buttocks synonyms, drifting like the snow words did in the preface.
  var BD = D.buttocks.map(function (w) {
    var e = el('div', 'wd hide drift');
    e.innerHTML = '<span class="bob"><i class="d"></i><span class="l">' + w + '</span></span>';
    viz.appendChild(e);
    return { el: e, word: w, x: 0, y: -60 };
  });
  var bumShown = false;
  function measureBum() {
    BD.forEach(function (w) { var c = w.el.className; w.el.className = 'wd'; w.lw = w.el.offsetWidth; w.el.className = c; });
  }
  // Scattered grid: one cell per word, jittered, centered in the figure area.
  function driftLayout(list, R, seed) {
    var sizes = sizesToTry(), cols, rows, cw, ch, out = [];
    for (var si = 0; si < sizes.length; si++) {
      wordSize(sizes[si]);
      cols = Math.max(2, Math.floor(R.w / 125)); rows = Math.ceil(list.length / cols);
      ch = Math.min(64, R.h / rows);
      if (ch >= sizes[si] * 1.5) break;
    }
    cw = R.w / cols;
    var r = seeded(seed), dy = Math.max(0, (R.h - rows * ch) / 2);
    list.forEach(function (w, i) {
      var c = i % cols, rr = Math.floor(i / cols);
      out.push([w, R.x + c * cw + r() * Math.max(0, cw - w.lw - 8), R.y + dy + rr * ch + r() * Math.max(0, ch - curSize * 1.3)]);
    });
    return out;
  }
  // A butt from behind: two round cheeks (the outline of two overlapping ovals) with a flat
  // waistline across the top.
  function buttShape(R) {
    var g = geo(), c = R.copy, cx, cy, rx, ry;
    if (!g.phone && c) {
      cx = c.x + c.w / 2; cy = R.y + R.h / 2;
      ry = Math.min(R.h / 2 - 18, 340); rx = Math.min((R.w - 40) / 3.4, ry * 0.95, 330);
      ry = Math.min(ry, rx * 1.05);
    } else {
      cx = R.x + R.w / 2; cy = R.y + R.h * 0.45;
      rx = Math.min((R.w - 12) / 3.4, (R.h - 24) / 2 / 1.15); ry = Math.min((R.h - 24) / 2, rx * 1.15);
    }
    // Cheeks overlap less than ovals usually would, so the crease at the bottom shows.
    var d = rx * 0.7, phi = Math.acos(-d / rx), notch = ry * Math.sqrt(1 - (d / rx) * (d / rx));
    var yCut = cy - notch + ry * 0.07, pts = [], n = 260, k, t;
    for (k = 0; k <= n; k++) { t = -phi + 2 * phi * k / n; pts.push([cx + d + rx * Math.cos(t), Math.max(yCut, cy + ry * Math.sin(t))]); }
    for (k = 1; k <= n; k++) { t = phi - 2 * phi * k / n; pts.push([cx - d - rx * Math.cos(t), Math.max(yCut, cy + ry * Math.sin(t))]); }
    return { pts: pts, cx: cx, yCut: yCut };
  }
  function showBum(R, o) {
    // On phones the outline is small, so keep the words readable and show fewer of them.
    var shape = buttShape(R), placed = placeOnPath(BD, shape.pts, { start: 6, end: 6, seed: 9, sizes: geo().phone ? [14, 13] : null }), t = placed.targets;
    placed.rest.forEach(function (w) { w.el.classList.add('hide'); });
    BD.forEach(function (w) { w.el.classList.remove('drift'); });
    t.forEach(function (p, i) {
      var w = p[0];
      if (!bumShown && !o.relayout) {
        noTransition(w.el, function () { moveWord(w, p[1], -40 - Math.random() * 120); });
        w.el.style.transitionDelay = reduce ? '0ms' : Math.round(i * 22 + Math.random() * 160) + 'ms';
        setTimeout(function () { w.el.style.transitionDelay = ''; }, 1400);
      }
      moveWord(w, p[1], p[2]); w.el.classList.remove('hide');
    });
    bumShown = true;
  }
  function hideBum() { BD.forEach(function (w) { w.el.classList.add('hide'); }); bumShown = false; }
  var cloudOrder = WD.slice(), driftOrder = WD.slice();
  (function () { var r = seeded(7); cloudOrder.sort(function () { return r() - 0.5; }); var q = seeded(21); driftOrder.sort(function () { return q() - 0.5; }); })();

  // Word labels shrink a step at a time when a layout would otherwise run into the page buttons.
  var curSize = null;
  function sizesToTry() { return geo().phone ? [15, 14, 13, 12, 11] : [17, 16, 15, 14, 13]; }
  function wordSize(px) {
    if (px === curSize) return;
    curSize = px;
    viz.style.setProperty('--wfs', px + 'px');
    measureWords(); measureBum();
  }
  function measureWords() {
    WD.forEach(function (w) {
      var c = w.el.className; w.el.className = 'wd';
      w.lw = w.el.offsetWidth; w.el.className = c;
    });
  }
  function moveWord(w, x, y) { w.x = x; w.y = y; w.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; }

  // mode: off | drift | specks | cloud | senses | row | point
  function setWords(mode, R, opts) {
    opts = opts || {};
    var wasHidden = st.prevWords === 'off' || st.prevWords === 'specks' || st.prevWords === 'point';
    var targets = [];
    var leftOut = [];
    if (mode === 'drift') {
      targets = driftLayout(driftOrder, R, 3);
    } else if (mode === 'around') {
      var ar = aroundLayout(cloudOrder, R, 3); targets = ar.targets; leftOut = ar.rest;
    } else if (mode === 'cloud') {
      var lines, lh, sizes = sizesToTry(), gap = 18, cwid = Math.min(R.w, 640);
      for (var si = 0; si < sizes.length; si++) {
        wordSize(sizes[si]);
        lines = []; var line = [], lw = 0;
        cloudOrder.forEach(function (w) {
          if (line.length && lw + gap + w.lw > cwid) { lines.push([line, lw]); line = []; lw = 0; }
          lw += (line.length ? gap : 0) + w.lw; line.push(w);
        });
        if (line.length) lines.push([line, lw]);
        lh = Math.min(36, R.h / lines.length);
        if (lh >= sizes[si] * 1.6) break;
      }
      var top = R.y + Math.max(0, (R.h - lines.length * lh) / 2), jr = seeded(11);
      lines.forEach(function (L, li) {
        var x = R.x + (R.w - L[1]) / 2;
        L[0].forEach(function (w) { targets.push([w, x, top + li * lh + (jr() - 0.5) * Math.min(10, lh - curSize * 1.3)]); x += w.lw + gap; });
      });
    } else if (mode === 'senses') {
      targets = layoutSenses(R);
    } else if (mode === 'row') {
      viz.style.setProperty('--mini', opts.dot + 'px');
      WD.forEach(function (w, i) { targets.push([w, opts.x + i * opts.pitch, opts.y]); });
    } else if (mode === 'point') {
      WD.forEach(function (w) { targets.push([w, opts.x - 2.5, opts.y - 2.5]); });
    }

    WD.forEach(function (w) {
      w.el.classList.toggle('drift', mode === 'drift' || mode === 'around');
      w.el.classList.toggle('mini', mode === 'row' || mode === 'point' || mode === 'specks');
      w.el.classList.toggle('nolabel', mode === 'row' || mode === 'point' || mode === 'specks' || mode === 'off');
      w.dot.style.background = (mode === 'senses' || mode === 'row' || mode === 'point') ? w.color : '';
    });

    if (mode === 'off' || mode === 'specks') {
      WD.forEach(function (w) { w.el.classList.add('hide'); });
    } else {
      targets.forEach(function (t, i) {
        var w = t[0];
        if (wasHidden && mode !== 'point' && !opts.relayout) {
          // Drop in from above, a few at a time.
          noTransition(w.el, function () { moveWord(w, t[1], -40 - Math.random() * 120); });
          w.el.style.transitionDelay = reduce ? '0ms' : Math.round(i * 22 + Math.random() * 160) + 'ms';
          setTimeout(function () { w.el.style.transitionDelay = ''; }, 1400);
        }
        moveWord(w, t[1], t[2]);
        w.el.classList.remove('hide');
      });
      leftOut.forEach(function (w) { w.el.classList.add('hide'); });
      if (mode === 'point') {
        clearTimeout(setWords.ht);
        setWords.ht = setTimeout(function () { if (st.prevWords === 'point') WD.forEach(function (w) { w.el.classList.add('hide'); }); }, reduce ? 0 : 950);
      }
    }
    st.prevWords = mode;
  }

  // ---------- Fig. 1: snow's senses, laid out like a dictionary entry ----------
  var fig1 = el('div', 'fig off');
  fig1.innerHTML = '<div class="stack"></div><div class="stack-n"></div><div class="caption">Fig. 1. Snow’s 29 synonyms, by meaning</div>';
  viz.appendChild(fig1);
  var senseHeads = D.senses.map(function (s) {
    var h = el('div', 'sense-h fig off', '<span class="sw" style="background:' + s.color + '"></span><b>' + s.n + '</b> <i>' + s.pos + '</i> ' + s.gloss + ' <span class="k">· ' + s.words.length + '</span>');
    viz.appendChild(h); return h;
  });
  function layoutSenses(R) {
    var w = Math.min(R.w, 560), x0 = R.x + (geo().phone ? 0 : (R.w - w) / 2), sizes = sizesToTry(), first;
    for (var i = 0; i < sizes.length; i++) {
      wordSize(sizes[i]);
      first = senseRun(x0, R.y, w);
      if (first.end - R.y <= R.h) break;
    }
    var dy = Math.max(0, (R.h - (first.end - R.y)) / 2);
    return senseRun(x0, R.y + dy, w).targets;
  }
  function senseRun(x0, y, w) {
    var targets = [], tight = curSize < sizesToTry()[0];
    // stacked bar
    fig1.style.left = x0 + 'px'; fig1.style.top = y + 'px'; fig1.style.width = w + 'px';
    var stack = fig1.querySelector('.stack'), nums = fig1.querySelector('.stack-n'), acc = 0;
    stack.innerHTML = ''; nums.innerHTML = '';
    D.senses.forEach(function (s) {
      var segW = w * s.words.length / 29;
      stack.appendChild(el('div', null)).style.cssText = 'width:' + segW + 'px;background:' + s.color;
      nums.appendChild(el('span', null, s.n)).style.left = (acc + segW / 2) + 'px';
      acc += segW;
    });
    y += fig1.offsetHeight + (tight ? 10 : 16);
    var gap = 12, lh = Math.round(curSize * 1.4);
    D.senses.forEach(function (s, si) {
      var h = senseHeads[si], pos = 'translate(' + x0 + 'px,' + y + 'px)';
      h.style.width = w + 'px'; h.style.left = '0px'; h.style.top = '0px';
      if (h.classList.contains('off')) noTransition(h, function () { h.style.transform = pos; }); else h.style.transform = pos;
      h.style.fontSize = curSize + 'px';
      y += h.offsetHeight + 4;
      var x = x0 + 2;
      WD.filter(function (d) { return d.sense === s.n; }).forEach(function (d) {
        if (x + d.lw > x0 + w) { x = x0 + 2; y += lh; }
        targets.push([d, x, y]); x += d.lw + gap;
      });
      y += lh + (tight ? 6 : 12);
    });
    return { targets: targets, end: y - (tight ? 6 : 12) };
  }
  function showSenses(on) {
    fig1.classList.toggle('off', !on);
    senseHeads.forEach(function (h) { h.classList.toggle('off', !on); });
  }

  // ---------- Fig. 2: snow vs cut, one dot per synonym ----------
  var fig2a = el('div', 'figlabel fig off', '<b>snow</b> <span>4 meanings · 29 synonyms</span>');
  var CMP = D.compare;
  var fig2b = el('div', 'figlabel fig off', '<b>' + CMP.w + '</b> <span>' + CMP.meanings + ' meanings · ' + fmt(CMP.synonyms) + ' synonyms</span>');
  var fig2c = el('div', 'caption fig off', 'Fig. 2. One dot for every synonym. The colors mark meanings; gray ones are hard to place.');
  [fig2a, fig2b, fig2c].forEach(function (e) { viz.appendChild(e); });
  function showFig2(R) {
    var pitch = geo().phone ? 8 : 9, dot = pitch - 2, gw = Math.min(R.w, 420), cols = Math.floor(gw / pitch);
    var blockH = 34 + 26 + 34 + Math.ceil(CMP.synonyms / cols) * pitch + 30;
    var x = R.x + (geo().phone ? 0 : (R.w - gw) / 2), top = R.y + Math.max(0, (R.h - blockH) / 2);
    fig2a.style.left = x + 'px'; fig2a.style.top = top + 'px';
    var rowY = top + 34;
    setWords('row', R, { x: x, y: rowY, pitch: pitch, dot: dot });
    var by = rowY + 26;
    fig2b.style.left = x + 'px'; fig2b.style.top = by + 'px';
    var gy = by + 34;
    var groups = CMP.groups ? CMP.groups.concat(CMP.other ? [CMP.other] : []) : [CMP.synonyms];
    var colors = CMP.groups ? CMP.groups.map(function (g, i) { return [1, 3, 4, 0][i % 4]; }).concat(CMP.other ? [5] : []) : [1];
    var o = { rect: { x: x + dot / 2, y: gy, w: gw }, groups: groups, pitch: pitch, dot: dot, colors: colors };
    Sky.set('grid', o);
    fig2c.style.left = x + 'px'; fig2c.style.top = (gy + (o.height || 180) + 8) + 'px'; fig2c.style.width = gw + 'px';
    [fig2a, fig2b, fig2c].forEach(function (e) { e.classList.remove('off'); });
  }
  function hideFig2() { [fig2a, fig2b, fig2c].forEach(function (e) { e.classList.add('off'); }); }

  // ---------- Chart: the top words as points, then bars ----------
  var keys = [];
  D.top.concat(D.slangTop).forEach(function (d) { if (keys.indexOf(d.w) < 0) keys.push(d.w); });
  keys.push('snow');
  var WP = {};
  keys.forEach(function (k) {
    var e = el('div', 'wp gone' + (k === 'snow' ? ' snow' : ''));
    e.innerHTML = '<span class="mk"></span><span class="nm"></span><span class="vl"></span><span class="mn vl"></span>';
    viz.appendChild(e);
    WP[k] = { el: e, mk: e.querySelector('.mk'), nm: e.querySelector('.nm'), vl: e.querySelector('.vl'), mn: e.querySelector('.mn'), shown: false };
  });
  var axes = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  axes.setAttribute('class', 'axes fig off'); viz.appendChild(axes);
  var chartCap = el('div', 'caption fig off'); viz.appendChild(chartCap);
  var mnHead = el('div', 'caption fig off', 'meanings'); viz.appendChild(mnHead);
  var note = el('div', 'margin-note fig off'); viz.appendChild(note);

  function wpPlace(p, x, y, mk) {
    var reveal = !p.shown;
    var apply = function () {
      p.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      p.mk.style.width = mk.w + 'px'; p.mk.style.height = mk.h + 'px';
      p.mk.style.borderRadius = mk.r; p.mk.style.transform = mk.t;
    };
    if (reveal && mk.from) { noTransition(p.el, function () { p.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; p.mk.style.width = '0px'; p.mk.style.height = mk.h + 'px'; p.mk.style.borderRadius = mk.r; p.mk.style.transform = mk.t; }); }
    else if (reveal) { noTransition(p.el, apply); }
    apply();
    p.el.classList.remove('gone');
    p.shown = true;
  }
  function wpHide(p) { p.el.classList.add('gone'); p.shown = false; }

  // mode: off | scatter | bars
  function setChart(mode, R, o) {
    o = o || {};
    keys.forEach(function (k) { WP[k].el.classList.remove('dim', 'scatter', 'slang', 'hidelabels'); });
    note.classList.add('off'); mnHead.classList.add('off');
    if (mode === 'off') {
      keys.forEach(function (k) { wpHide(WP[k]); });
      axes.classList.add('off'); chartCap.classList.add('off');
      return;
    }
    if (mode === 'scatter') {
      chartCap.textContent = 'Fig. 3. Meanings and synonyms: snow and the 25 words with the most synonyms';
      chartCap.style.width = R.w + 'px';
      var capH = chartCap.offsetHeight || 34;
      var L = R.x + 44, Rr = R.x + R.w - 10, T = R.y + 10, B = R.y + R.h - capH - 44;
      var sx = function (m) { return L + (Rr - L) * m / 30; }, sy = function (s) { return B - (B - T) * s / 1300; };
      keys.forEach(function (k) {
        var p = WP[k], d = k === 'snow' ? { m: 4, s: 29 } : D.top.filter(function (t) { return t.w === k; })[0];
        if (!d) { wpHide(p); return; }
        p.el.classList.add('scatter');
        p.nm.textContent = k === 'snow' ? 'snow' : k; p.nm.style.fontSize = '';
        p.vl.innerHTML = ''; p.mn.innerHTML = '';
        wpPlace(p, sx(d.m), sy(d.s), { w: 9, h: 9, r: '50%', t: 'translate(-4.5px,-4.5px)' });
        if (o.dim) p.el.classList.add('dim');
      });
      // axes
      var ticksX = [0, 10, 20, 30], ticksY = [0, 500, 1000];
      var svg = '<g stroke="#63291B" stroke-width="1" fill="none"><path d="M' + L + ' ' + T + 'V' + B + 'H' + Rr + '"/></g>';
      ticksX.forEach(function (t) { svg += '<line x1="' + sx(t) + '" x2="' + sx(t) + '" y1="' + B + '" y2="' + (B + 5) + '" stroke="#63291B"/><text x="' + sx(t) + '" y="' + (B + 18) + '" text-anchor="middle">' + t + '</text>'; });
      ticksY.forEach(function (t) { svg += '<line x1="' + (L - 5) + '" x2="' + L + '" y1="' + sy(t) + '" y2="' + sy(t) + '" stroke="#63291B"/><text x="' + (L - 8) + '" y="' + (sy(t) + 4) + '" text-anchor="end">' + fmt(t) + '</text>'; });
      svg += '<text x="' + Rr + '" y="' + (B + 34) + '" text-anchor="end" font-style="italic">meanings →</text>';
      svg += '<text x="' + (L + 6) + '" y="' + (T + 4) + '" font-style="italic">↑ synonyms</text>';
      axes.innerHTML = svg; axes.setAttribute('width', geo().W); axes.setAttribute('height', geo().H);
      axes.classList.toggle('off', false); axes.style.opacity = o.dim ? '.25' : '';
      chartCap.style.left = R.x + 'px'; chartCap.style.top = (B + 40) + 'px';
      chartCap.classList.toggle('off', !!o.dim);
      if (!o.dim) {
        note.className = 'margin-note blue fig';
        note.innerHTML = 'nowhere near<br>the top';
        note.style.left = (sx(4) + 18) + 'px'; note.style.top = (sy(29) - 62) + 'px';
        note.style.transform = 'rotate(-4deg)';
      }
      return;
    }
    // bars
    axes.classList.add('off');
    var list = o.list, max = o.max, g = geo();
    chartCap.textContent = o.caption || ''; chartCap.style.width = R.w + 'px';
    var capH = o.caption ? (chartCap.offsetHeight || 34) : 0;
    var labelW = g.phone ? 80 : 104, valW = o.meanings ? 92 : 50;
    var x0 = R.x + labelW, barMax = R.w - labelW - valW;
    var rows = list.length + 1.6 + (o.meanings ? 0.8 : 0), pitch = Math.min(g.phone ? 17 : 22, (R.h - capH - 10) / rows), barH = Math.max(4, pitch * 0.62);
    var chartH = rows * pitch + capH + 10, top = R.y + Math.max(0, (R.h - chartH) / 2);
    var fs = Math.max(8, Math.min(14, pitch * 0.84));
    var y0 = top + (o.meanings ? Math.max(14, pitch) : 4) + pitch / 2;
    var inList = {};
    list.forEach(function (d, i) {
      inList[d.w] = true;
      var p = WP[d.w], bw = Math.max(2, barMax * d.s / max), y = y0 + i * pitch;
      p.el.classList.toggle('slang', !!d.sl);
      p.nm.innerHTML = d.w + (o.found && o.found[d.w] ? '<span class="chk">✓</span>' : '') + (d.sl && o.slLabel ? '<span class="sl">sl.</span>' : '');
      p.vl.textContent = fmt(d.s); p.vl.style.left = (bw + 6) + 'px';
      p.nm.style.fontSize = fs + 'px'; p.vl.style.fontSize = p.mn.style.fontSize = (fs * 0.9) + 'px';
      if (o.meanings) { p.mn.textContent = d.m; p.mn.style.left = (R.x + R.w - 14 - x0) + 'px'; } else p.mn.textContent = '';
      wpPlace(p, x0, y, { w: bw, h: barH, r: '1px', t: 'translate(0,' + (-barH / 2) + 'px)', from: o.grow });
      if (o.highlight && !o.highlight(d)) p.el.classList.add('dim');
      if (o.dimAll) p.el.classList.add('dim');
    });
    keys.forEach(function (k) { if (!inList[k] && k !== 'snow') wpHide(WP[k]); });
    // snow, set a little apart at the bottom
    var sp = WP.snow, sv = o.snow || 29, sbw = Math.max(2, barMax * sv / max), syy = y0 + (list.length + 0.6) * pitch;
    sp.nm.textContent = 'snow'; sp.vl.textContent = fmt(sv); sp.vl.style.left = (sbw + 6) + 'px';
    sp.nm.style.fontSize = fs + 'px'; sp.vl.style.fontSize = sp.mn.style.fontSize = (fs * 0.9) + 'px';
    if (o.meanings) { sp.mn.textContent = '4'; sp.mn.style.left = (R.x + R.w - 14 - x0) + 'px'; } else sp.mn.textContent = '';
    wpPlace(sp, x0, syy, { w: sbw, h: barH, r: '1px', t: 'translate(0,' + (-barH / 2) + 'px)' });
    if (o.dimAll) sp.el.classList.add('dim');
    if (o.meanings) {
      mnHead.style.left = (R.x + R.w - 60) + 'px'; mnHead.style.top = (top - 2) + 'px'; mnHead.style.width = '60px'; mnHead.style.textAlign = 'right';
      mnHead.classList.remove('off');
    }
    chartCap.style.left = R.x + 'px'; chartCap.style.top = (syy + pitch * 0.8) + 'px';
    chartCap.classList.toggle('off', !o.caption || !!o.dimAll);
    if (o.snowNote) {
      note.className = 'margin-note fig';
      note.innerHTML = o.snowNote;
      note.style.left = (x0 + sbw + 44) + 'px'; note.style.top = (syy - 13) + 'px'; note.style.transform = 'rotate(-2deg)';
    }
  }

  // ---------- Ch. II: the 25 blank slots ----------
  var slots = el('div', 'slots fig off');
  D.top.forEach(function (d, i) {
    slots.appendChild(el('div', 'slot', '<span class="no">' + (i + 1) + '.</span><span class="blank"></span>'));
  });
  viz.appendChild(slots);
  function fillSlot(i, flash) {
    var d = D.top[i], s = slots.children[i];
    s.className = 'slot got' + (flash ? ' new' : '');
    s.innerHTML = '<span class="no">' + (i + 1) + '.</span><span class="w">' + d.w + '</span><span class="n">' + fmt(d.s) + '</span>';
  }
  function layoutSlots(R) {
    var g = geo(), cols = g.phone || R.w < 520 ? 2 : 3, rows = Math.ceil(25 / cols);
    var rowH = Math.min(26, R.h / rows), sw = Math.min(R.w, 600);
    slots.style.left = (R.x + (g.phone ? 0 : (R.w - sw) / 2)) + 'px'; slots.style.top = (R.y + Math.max(0, (R.h - rows * rowH) / 2)) + 'px'; slots.style.width = sw + 'px';
    slots.style.gridTemplateRows = 'repeat(' + rows + ',' + rowH + 'px)';
    slots.style.fontSize = Math.min(15, rowH * 0.72) + 'px';
    slots.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';
  }

  // ---------- Ch. III: slang pairs ----------
  var pairsEl = el('div', 'pairs fig off live');
  viz.appendChild(pairsEl);
  var pairSel = null;
  function buildPairs() {
    var r = seeded(5), right = D.pairs.map(function (p, i) { return i; }).sort(function () { return r() - 0.5; });
    var html = '<div class="cols"><div class="col slang">';
    D.pairs.forEach(function (p, i) { html += '<button type="button" class="opt" data-side="s" data-i="' + i + '">' + p.slang + '</button>'; });
    html += '</div><div class="col word">';
    right.forEach(function (i) { html += '<button type="button" class="opt" data-side="w" data-i="' + i + '">' + D.pairs[i].word + '</button>'; });
    html += '</div></div><p class="pfb"></p><button type="button" class="linkbtn show">show the answers</button>';
    pairsEl.innerHTML = html;
    refreshPairs();
  }
  function refreshPairs() {
    var n = 0;
    Array.prototype.forEach.call(pairsEl.querySelectorAll('.opt'), function (b) {
      var i = +b.dataset.i, done = st.pairsDone[i] || st.pairsShown;
      b.classList.toggle('done', !!done); b.disabled = !!done;
      var badge = b.querySelector('.badge'); if (badge) badge.remove();
      if (done) b.appendChild(el('span', 'badge', String(i + 1)));
    });
    D.pairs.forEach(function (p, i) { if (st.pairsDone[i]) n++; });
    var fb = pairsEl.querySelector('.pfb');
    if (st.pairsShown && n < 6) { fb.className = 'pfb'; fb.textContent = 'There they are. You got ' + n + ' of 6.'; }
    else if (n === 6) { fb.className = 'pfb'; fb.textContent = 'All six. Nicely done.'; }
    pairsEl.querySelector('.show').hidden = st.pairsShown || n === 6;
  }
  pairsEl.addEventListener('click', function (e) {
    var b = e.target.closest('.opt');
    if (e.target.closest('.show')) { st.pairsShown = true; pairSel = null; refreshPairs(); return; }
    if (!b || b.disabled) return;
    var fb = pairsEl.querySelector('.pfb');
    if (!pairSel || pairSel.dataset.side === b.dataset.side) {
      if (pairSel) pairSel.classList.remove('sel');
      pairSel = b; b.classList.add('sel'); return;
    }
    var a = pairSel; a.classList.remove('sel'); pairSel = null;
    if (a.dataset.i === b.dataset.i) {
      st.pairsDone[+b.dataset.i] = true;
      var p = D.pairs[+b.dataset.i];
      fb.className = 'pfb'; fb.innerHTML = 'Yes: <i>' + p.slang + '</i> means ' + p.word + '.';
      refreshPairs();
    } else {
      fb.className = 'pfb miss'; fb.textContent = 'Not quite. Try another.';
      b.classList.add('shake'); setTimeout(function () { b.classList.remove('shake'); }, 450);
    }
  });

  // ---------- Ch. II guessing ----------
  function normalize(g) { return g.toLowerCase().trim().replace(/[^a-z' -]/g, '').replace(/^(to|a|an|the) /, ''); }
  function matchTop(g) {
    var c = [g, g.replace(/s$/, ''), g.replace(/es$/, ''), g.replace(/ing$/, ''), g.replace(/ing$/, 'e'), g.replace(/(.)\1ing$/, '$1'), g.replace(/ed$/, ''), g.replace(/d$/, ''), g.replace(/(.)\1ed$/, '$1')];
    for (var i = 0; i < D.top.length; i++) if (c.indexOf(D.top[i].w) >= 0) return i;
    return -1;
  }
  function foundCount() { return Object.keys(st.found).length; }

  // ---------- Steps ----------
  var HEADS = { 0: 'preface', 1: 'chapter i · meanings', 2: 'chapter ii · the winners', 3: 'chapter iii · slang', 4: 'afterword', 5: 'colophon' };
  var STEPS = [
    { ch: 0, center: true, copy: function () { return '<p class="lead">People often say the Inuit have 70 words for snow.</p><p>Contested as this claim may be, it’s meant to express that languages have more synonyms for things that are more pervasive in their culture.</p>'; },
      vis: function (R) { Sky.set('flurry', { count: 140 }); setWords('off'); setChart('off'); } },
    { ch: 0, center: true, copy: function () { return '<p class="lead">English has 29 of its own.</p><p>If we set aside snow’s slang meaning.</p>'; },
      vis: function (R, o) { Sky.set('flurry', { count: 140 }); setWords('around', R, o); setChart('off'); } },
    { ch: 0, center: true, copy: function () { return '<p class="lead">And 29 is nothing.</p><p>Every speck here is a synonym of one of just 25 everyday English words. There are ' + fmt(HOOK_N) + ' of them.</p>'; },
      vis: function (R) { var c = copyEl.getBoundingClientRect(); Sky.set('fill', { count: HOOK_N, avoid: { x: c.left, y: c.top, w: c.width, h: c.height } }); setWords('specks'); setChart('off'); } },
    { ch: -1, title: true, copy: function () { return '<p>Snowed Under: which English words have piled up synonyms. By Ryan.</p>'; },
      vis: function () { Sky.set('drop'); setWords('off'); setChart('off'); } },
    { ch: 1, center: true, copy: function () { return '<p class="lead">Let’s look closer at snow’s 29.</p><p><i>Snowfall</i>, sure. But <i>bamboozle</i>? <i>Hornswaggle</i>? Most of them have nothing to do with the weather.</p>'; },
      vis: function (R, o) { Sky.set('off'); showSenses(false); hideFig2(); setWords('around', R, o); setChart('off'); } },
    { ch: 1, center: true, gate: function () { return st.meaningsGuess != null; },
      copy: function () {
        var v = st.meaningsGuess || 1, locked = st.meaningsGuess != null;
        return '<p class="lead">Words pick up synonyms one meaning at a time.</p><p>So how many different meanings does <i>snow</i> have, not counting slang?</p>' +
          '<div class="guess"><output class="gnum">' + v + '</output><input type="range" min="1" max="10" step="1" value="' + v + '" aria-label="Your guess: number of meanings"' + (locked ? ' disabled' : '') + '><div class="ends"><span>1 meaning</span><span>10 meanings</span></div>' +
          '<button type="button" class="btn solid lock"' + (locked ? ' disabled' : '') + '>' + (locked ? 'Locked in' : 'Lock it in') + '</button>' +
          (locked ? '' : '<p class="kbd-hint">You can also type a number.</p>') + '</div>';
      },
      bind: function () {
        var range = copyEl.querySelector('input'), out = copyEl.querySelector('.gnum'), lock = copyEl.querySelector('.lock');
        range.addEventListener('input', function () { out.textContent = range.value; });
        lock.addEventListener('click', function () {
          st.meaningsGuess = +range.value; range.disabled = true; lock.disabled = true; lock.textContent = 'Locked in';
          updateNav(); setTimeout(function () { if (st.i === 5) go(6); }, reduce ? 200 : 650);
        });
      },
      vis: function (R) { Sky.set('off'); showSenses(false); hideFig2(); setWords('off'); setChart('off'); } },
    { ch: 1, vw: 560, copy: function () {
        var g = st.meaningsGuess, n = '';
        if (g === 4) n = '<p class="note">your guess: <b>4</b>. Spot on!</p>';
        else if (g != null) n = '<p class="note">your guess: <s>' + g + '</s> <b>4</b></p>';
        return '<p class="lead">Just 4.</p><p>A fall of snow, coming down thickly, TV static, and a <i>snow job</i>. That last one, fooling someone, brings 18 of the 29 synonyms on its own.</p>' + n;
      },
      vis: function (R, o) { Sky.set('off'); hideFig2(); showSenses(true); setWords('senses', R, o); setChart('off'); } },
    { ch: 1, vw: 460, copy: function () { return '<p class="lead">More meanings, more synonyms.</p><p><i>Man</i> has 9 meanings, from a person to a game piece to crewing a ship. Between them, they hold 306 synonyms.</p>'; },
      vis: function (R) { showSenses(false); showFig2(R); setChart('off'); } },
    { ch: 1, vw: 620, copy: function () { return '<p class="lead">Snow isn’t anywhere near the top.</p><p>Here it is with the 25 English words that have the most synonyms.</p>'; },
      vis: function (R) {
        Sky.set('off'); showSenses(false); hideFig2();
        setChart('scatter', R);
        var p = WP.snow.el.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px/);
        setWords('point', R, { x: p ? +p[1] : R.x, y: p ? +p[2] : R.y + R.h });
      } },
    { ch: 2, vw: 600, copy: function () {
        var n = foundCount();
        return '<p class="lead">So which word has the most synonyms?</p><p>Guess as many times as you like. Any word you get from the top 25 goes on the list.</p>' +
          '<form class="wguess" autocomplete="off"><input type="text" placeholder="type a word" aria-label="Your guess" autocapitalize="none" spellcheck="false" enterkeyhint="go"><button class="btn solid" type="submit">Guess</button></form>' +
          '<p class="fb"></p><p class="found">' + (n === 25 ? 'You found all 25!' : 'Found ' + n + ' of 25') + '</p><button type="button" class="linkbtn giveup">show me the list →</button>';
      },
      bind: function () {
        var f = copyEl.querySelector('form'), input = f.querySelector('input'), fb = copyEl.querySelector('.fb'), found = copyEl.querySelector('.found');
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          var raw = input.value, g = normalize(raw); if (!g) return;
          var i = matchTop(g);
          if (i >= 0 && st.found[D.top[i].w]) { fb.className = 'fb'; fb.innerHTML = 'You already found <i>' + D.top[i].w + '</i>.'; }
          else if (i >= 0) {
            st.found[D.top[i].w] = true; fillSlot(i, true);
            fb.className = 'fb'; fb.innerHTML = (i === 0 ? 'That’s the one! ' : 'Yes! ') + '<i>' + D.top[i].w + '</i> is #' + (i + 1) + ', with ' + fmt(D.top[i].s) + ' synonyms.';
          } else if (g === 'snow') { fb.className = 'fb miss'; fb.textContent = 'Ha. Snow has 29. Try another.'; }
          else { fb.className = 'fb miss'; fb.innerHTML = '<i>' + g.replace(/</g, '') + '</i> isn’t in the top 25. Try another.'; }
          var n = foundCount(); found.textContent = n === 25 ? 'You found all 25!' : 'Found ' + n + ' of 25';
          input.value = ''; input.focus();
        });
        copyEl.querySelector('.giveup').addEventListener('click', function () { go(10); });
      },
      vis: function (R) {
        Sky.set('off'); setWords('off'); setChart('off');
        D.top.forEach(function (d, i) { if (st.found[d.w]) fillSlot(i, false); });
        layoutSlots(R); slots.classList.remove('off');
      } },
    { ch: 2, vw: 640, copy: function () {
        var n = foundCount(), f = n === 25 ? ' You found all 25!' : n ? ' You found ' + n + ' of them.' : '';
        return '<p class="lead"><i>Cut</i> takes it, with 1,262.</p><p><i>Set</i>, <i>turn</i>, <i>run</i>, and <i>break</i> round out the top five.' + f + '</p>';
      },
      vis: function (R, o) {
        Sky.set('off'); setWords('off'); slots.classList.add('off');
        var opts = { list: D.top, max: 1262, found: st.found, caption: 'Fig. 4. The 25 English words with the most synonyms, not counting slang' };
        if (o.from === 9 && !reduce) {
          // The scatter's dots fly into bars.
          setChart('scatter', R, { dim: false }); note.classList.add('off');
          setTimeout(function () { if (st.i === 10) setChart('bars', vizRect(), opts); }, 60);
        } else setChart('bars', R, opts);
      } },
    { ch: 2, vw: 680, copy: function () { return '<p class="lead">The winners are short and busy.</p><p>22 of the 25 have just one syllable, and they average about ' + Math.round(AVG_M) + ' meanings each. Snow has 4.</p>'; },
      vis: function (R) { Sky.set('off'); setWords('off'); slots.classList.add('off'); setChart('bars', R, { list: D.top, max: 1262, found: st.found, meanings: true, caption: 'Fig. 4. The 25 English words with the most synonyms, with their meanings' }); } },
    { ch: 3, vw: 640, copy: function () { return '<p class="lead">Now let slang in.</p><p><i>Snow</i> is also slang for cocaine, which has 96 slang names of its own, from <i>devil’s dandruff</i> to <i>Bolivian marching powder</i>. Count them, and snow goes from 29 synonyms to 125.</p>'; },
      vis: function (R) { Sky.set('off'); setWords('off'); slots.classList.add('off'); pairsEl.classList.add('off'); setChart('bars', R, { list: D.top, max: 1262, snow: 125, snowNote: '+96 for cocaine', caption: 'Fig. 4. The top 25 again, and snow with its slang' }); } },
    { ch: 3, vw: 560, copy: function () { return '<p class="lead">Slang is made to be hard to place.</p><p>Match each slang term to what it means.</p>'; },
      vis: function (R) {
        Sky.set('off'); setWords('off'); setChart('bars', R, { list: D.top, max: 1262, snow: 125, dimAll: true });
        if (!pairsEl.firstChild) buildPairs(); else refreshPairs();
        pairsEl.style.left = (R.x - 6) + 'px'; pairsEl.style.top = (R.y - 6) + 'px'; pairsEl.style.width = (R.w + 12) + 'px'; pairsEl.style.height = (R.h + 12) + 'px';
        pairsEl.classList.toggle('compact', R.h < 400);
        pairsEl.classList.remove('off');
      } },
    { ch: 3, vw: 640, copy: function () { return '<p class="lead">Slang terms dominate the list.</p><p><i>Money</i> leads with 3,342 synonyms, and 15 of the top 25 are new. <i>Cut</i> drops to ninth.</p>'; },
      vis: function (R) { Sky.set('off'); setWords('off'); pairsEl.classList.add('off'); setChart('bars', R, { list: D.slangTop, max: 3342, snow: 125, grow: true, slLabel: true, caption: 'Fig. 5. The top 25 with slang counted. sl. = new with slang' }); } },
    { ch: 3, vw: 640, copy: function () { return '<p class="lead">Look at what’s new.</p><p>Money, women, drink, fools, men, and sex take the top six places. Most of the other new arrivals are about bodies and sex, plus the police, death, and madness.</p>'; },
      vis: function (R) { Sky.set('off'); setWords('off'); pairsEl.classList.add('off'); setChart('bars', R, { list: D.slangTop, max: 3342, snow: 125, slLabel: true, highlight: function (d) { return d.sl; }, caption: 'Fig. 5. The top 25 with slang counted' }); } },
    { ch: 4, vw: 640, copy: function () { return '<p class="lead">What we have the most words for says something about us.</p><p>We keep inventing new ways to talk about the things we’d rather not say plainly but can’t stop talking about.</p>'; },
      vis: function (R) { Sky.set('flurry', { count: 90 }); setWords('off'); pairsEl.classList.add('off'); setChart('bars', R, { list: D.slangTop, max: 3342, snow: 125, dimAll: true }); } },
    { ch: 4, center: 'desktop', copyDy: 30, copy: function () { return '<p class="lead">So, do the Inuit have 70 words for snow?</p><p>It depends on what counts as a word. Inuit languages build words by adding pieces to a root, so one root can grow into dozens of them. The better question may be what do other languages keep finding new ways to say? In English, it isn’t snow.</p>'; },
      vis: function (R, o) { Sky.set('flurry', { count: 220 }); setChart('off'); setWords('off'); showBum(R, o); } },
    { ch: 5, copy: function () {
        return '<h2>Colophon</h2><p><i>Snowed Under</i>, by Ryan.</p>' +
          '<p class="small">Counts are our own. We started from each thesaurus entry, removed words that aren’t true synonyms, and sorted the rest into meanings, so treat the numbers as close estimates. Data compiled with help from Claude.</p>' +
          '<h3>Sources</h3><ul>' +
          '<li><a href="https://www.gutenberg.org/ebooks/3202">Moby Thesaurus II</a>: standard synonyms</li>' +
          '<li><a href="https://www.dea.gov/sites/default/files/2018-07/DIR-022-18.pdf">DEA, <i>Slang Terms and Code Words</i> (2018)</a>: cocaine slang</li>' +
          '<li><a href="https://greensdictofslang.com/">Green’s Dictionary of Slang</a> and <a href="https://jonathongreen.substack.com/p/poor-me">Jonathon Green, “Poor Me!”</a>: slang totals by topic</li>' +
          '<li><a href="https://mitpressbookstore.mit.edu/book/9781612191430">Paul Dickson, <i>Intoxerated</i></a>: 2,964 words for drunk</li>' +
          '<li><a href="https://pudding.cool/2026/10/kevin-bacon/">The Pudding, “The Real Kevin Bacon”</a> (<a href="https://github.com/the-pudding/kevin-bacon">code</a>, MIT license): the story format this is based on</li></ul>' +
          '<p class="small">Set in EB Garamond and Caveat. Physics by <a href="https://brm.io/matter-js/">Matter.js</a>.</p>' +
          '<button type="button" class="btn again">Read it again</button>';
      },
      bind: function () { copyEl.querySelector('.again').addEventListener('click', function () { st.meaningsGuess = null; st.found = {}; st.pairsDone = {}; st.pairsShown = false; pairsEl.innerHTML = ''; Array.prototype.forEach.call(slots.children, function (s, i) { s.className = 'slot'; s.innerHTML = '<span class="no">' + (i + 1) + '.</span><span class="blank"></span>'; }); go(0); }); },
      vis: function () { Sky.set('flurry', { count: 160 }); setWords('off'); setChart('off'); } }
  ];
  var CH_START = { 1: 4, 2: 9, 3: 12 };

  // ---------- Navigation ----------
  function updateNav() {
    var s = STEPS[st.i];
    backBtn.disabled = st.i === 0;
    nextBtn.disabled = st.i === STEPS.length - 1 || (s.gate && !s.gate());
    nextBtn.textContent = st.i === STEPS.length - 1 ? 'the end' : 'next ›';
  }

  function go(i, opts) {
    opts = opts || {};
    if (i < 0 || i >= STEPS.length) return;
    var from = st.i, s = STEPS[i];
    st.i = i;
    // frame
    body.classList.toggle('titlepage', !!s.title);
    rhRight.textContent = HEADS[s.ch] || '';
    Array.prototype.forEach.call(document.querySelectorAll('.tabs button'), function (b) { b.classList.toggle('on', +b.dataset.ch === s.ch); });
    folio.textContent = s.title ? '' : '— ' + (i + 1) + ' —';
    if (!s.title && Title.isShown()) Title.hide();
    // non-step overlays
    if (i !== 9) slots.classList.add('off');
    if (i !== 13) pairsEl.classList.add('off');
    if (i !== 6) showSenses(false);
    if (i !== 7) { hideFig2(); }
    if (i !== 17) hideBum();
    // copy, then visuals laid out around it
    var render = function () {
      if (st.i !== i) return;   // a later page turn already replaced this one
      copyEl.innerHTML = s.copy();
      placeCopy();
      if (s.bind) s.bind();
      var R = vizRect();
      s.vis(R, { from: from, relayout: !!opts.relayout });
      if (s.title) {
        st.titleDone = false;
        var done = function () { st.titleDone = true; updateNav(); };
        if (from > i || opts.relayout || from === -1) Title.showFinal(done); else Title.start(done);
      }
      copyEl.classList.remove('swap');
      updateNav();
    };
    if (opts.relayout || from === -1 || reduce) render();
    else { copyEl.classList.add('swap'); setTimeout(render, 180); }
  }
  function next() {
    var s = STEPS[st.i];
    if (s.title && Title.busy()) { Title.finish(); return; }
    if (s.gate && !s.gate()) { nudgeGate(); return; }
    go(st.i + 1);
  }
  function back() { go(st.i - 1); }
  function nudgeGate() {
    var b = copyEl.querySelector('.lock');
    if (b) { b.classList.add('shake'); b.animate && b.animate([{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }], { duration: 260 }); }
  }

  nextBtn.addEventListener('click', function (e) { e.stopPropagation(); next(); });
  backBtn.addEventListener('click', function (e) { e.stopPropagation(); back(); });
  Array.prototype.forEach.call(document.querySelectorAll('.tabs button'), function (b) {
    b.addEventListener('click', function (e) { e.stopPropagation(); go(CH_START[+b.dataset.ch]); });
  });
  // Tap or click anywhere else: the left third goes back, the rest turns the page.
  document.addEventListener('click', function (e) {
    if (e.target.closest('button, a, input, label, form, .pairs, .guess, .tabs, .foot')) return;
    if (STEPS[st.i].title) { next(); return; }
    if (e.clientX < innerWidth * 0.3) back(); else next();
  });
  var lastDigit = { k: '', t: 0 };
  function sliderKey(e) {
    if (st.i !== 5 || st.meaningsGuess != null) return false;
    var range = copyEl.querySelector('.guess input'), out = copyEl.querySelector('.gnum');
    if (!range) return false;
    if (e.key === 'Enter') { copyEl.querySelector('.lock').click(); return true; }
    if (!/^[0-9]$/.test(e.key)) return false;
    var now = Date.now(), v = +e.key;
    if (e.key === '0') v = 10;                                   // "0", or "1" then "0", means 10
    lastDigit = { k: e.key, t: now };
    range.value = v; out.textContent = v;
    return true;
  }
  document.addEventListener('keydown', function (e) {
    if (sliderKey(e)) { e.preventDefault(); return; }
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if (e.target.closest && e.target.closest('button, a') && (e.key === ' ' || e.key === 'Enter')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); back(); }
  });

  var rt = 0, lastW = innerWidth, lastH = innerHeight;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      var bigChange = Math.abs(innerWidth - lastW) > 2 || Math.abs(innerHeight - lastH) > 140;
      lastW = innerWidth; lastH = innerHeight;
      Sky.resize(); curSize = null; wordSize(sizesToTry()[0]);
      var s = STEPS[st.i];
      placeCopy();
      if (s.title) { if (bigChange) Title.showFinal(function () { st.titleDone = true; updateNav(); }); return; }
      s.vis(vizRect(), { from: st.i, relayout: true });
    }, 160);
  });

  // ---------- Start once the fonts are in (word widths depend on them) ----------
  var ready = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load('italic 500 15px "EB Garamond"'), document.fonts.load('500 19px "EB Garamond"'), document.fonts.load('500 22px "Caveat"')])
    : Promise.resolve();
  Promise.race([ready, new Promise(function (r) { setTimeout(r, 2500); })]).then(start, start);
  function start() {
    wordSize(sizesToTry()[0]);
    var m = /^#p(\d+)$/.exec(location.hash), first = m ? Math.min(STEPS.length, Math.max(1, +m[1])) - 1 : 0;
    go(first);
  }
})();
