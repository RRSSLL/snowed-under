// The canvas behind everything: falling flakes, the sky full of synonyms, and dot grids.
window.Sky = (function () {
  var cv = document.getElementById('sky');
  var ctx = cv.getContext('2d');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var INK = ['#63291B', '#436C66', '#88432C', '#8B9576', '#B89F78', '#BDB3A6'];
  var MAX = 20000;
  var x = new Float32Array(MAX), y = new Float32Array(MAX), sx = new Float32Array(MAX), sy = new Float32Array(MAX);
  var tx = new Float32Array(MAX), ty = new Float32Array(MAX), vy = new Float32Array(MAX), ph = new Float32Array(MAX);
  var delay = new Float32Array(MAX), col = new Uint8Array(MAX), live = new Uint8Array(MAX);
  var n = 0, mode = 'off', t0 = 0, raf = 0, W = 0, H = 0, dpr = 1, size = 2, alpha = 1, running = false;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function kick() { if (!running) { running = true; raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  // Gentle snowfall: a few hundred flakes drifting down and wrapping around.
  function flurry(count) {
    n = count; size = W < 760 ? 3 : 3.4; alpha = 0.5;
    for (var i = 0; i < n; i++) {
      x[i] = rand(0, W); y[i] = rand(-H, H); vy[i] = rand(0.018, 0.05); ph[i] = rand(0, 6.28);
      col[i] = Math.random() < 0.6 ? 0 : (Math.random() < 0.5 ? 1 : 3); live[i] = 1;
    }
  }

  // The sky fills: every synonym of the top 25 words drops in and hangs in the air.
  // `avoid` is a rectangle (the text) that the dots keep clear of.
  function fill(count, avoid) {
    n = Math.min(MAX, count); size = W < 760 ? 1.7 : 2; alpha = 0.62;
    for (var i = 0; i < n; i++) {
      var px, py, k = 0;
      do { px = rand(0, W); py = rand(0, H); k++; }
      while (avoid && k < 6 && px > avoid.x - 10 && px < avoid.x + avoid.w + 10 && py > avoid.y - 10 && py < avoid.y + avoid.h + 10);
      tx[i] = px; ty[i] = py; sx[i] = px + rand(-20, 20); sy[i] = -rand(4, 260);
      delay[i] = rand(0, 1900) * Math.pow(Math.random(), 0.6); ph[i] = rand(0, 6.28);
      var r = Math.random(); col[i] = r < 0.5 ? 0 : r < 0.72 ? 1 : r < 0.88 ? 2 : 3; live[i] = 1;
      x[i] = sx[i]; y[i] = sy[i];
    }
  }

  // Everything currently in the sky falls out of view.
  function drop() {
    for (var i = 0; i < n; i++) { vy[i] = rand(0, 0.15); delay[i] = rand(0, 350); }
  }

  // Dots fly into a grid. groups: array of counts; colors cycle through the palette unless
  // `colors` gives a palette index per group.
  function grid(rect, groups, pitch, dot, colors) {
    var total = groups.reduce(function (s, g) { return s + g; }, 0);
    var cols = Math.max(1, Math.floor(rect.w / pitch));
    var prevN = (mode === 'off' || mode === 'drop') ? 0 : n;
    n = total; size = dot; alpha = 1;
    var i = 0;
    groups.forEach(function (g, gi) {
      for (var k = 0; k < g; k++, i++) {
        tx[i] = rect.x + (i % cols) * pitch; ty[i] = rect.y + Math.floor(i / cols) * pitch;
        if (i >= prevN) { x[i] = tx[i] + rand(-30, 30); y[i] = -rand(10, 300); }
        sx[i] = x[i]; sy[i] = y[i]; col[i] = colors ? colors[gi] : [1, 3, 4, 0][gi % 4]; live[i] = 1;
        delay[i] = (i / total) * 500 + rand(0, 120);
      }
    });
    return Math.ceil(total / cols) * pitch;
  }

  function set(m, opts) {
    opts = opts || {};
    if (m === mode && m !== 'grid' && m !== 'fill') return;
    var prev = mode;
    mode = m; t0 = performance.now();
    if (m === 'off') { n = 0; stop(); ctx.clearRect(0, 0, W, H); return; }
    if (m === 'flurry') flurry(opts.count || 140);
    if (m === 'fill') fill(opts.count, opts.avoid);
    if (m === 'drop') { if (prev === 'off') { mode = 'off'; return; } drop(); }
    if (m === 'grid') opts.height = grid(opts.rect, opts.groups, opts.pitch, opts.dot, opts.colors);
    if (reduce) { settle(); draw(performance.now()); return; }
    kick();
  }

  // Jump straight to the resting state (reduced motion).
  function settle() {
    for (var i = 0; i < n; i++) {
      if (mode === 'fill' || mode === 'grid') { x[i] = tx[i]; y[i] = ty[i]; }
      if (mode === 'drop') live[i] = 0;
    }
  }

  function update(now) {
    var t = now - t0, dt = 16, any = false;
    for (var i = 0; i < n; i++) {
      if (!live[i]) continue;
      if (mode === 'flurry') {
        y[i] += vy[i] * dt; x[i] += Math.sin(now * 0.0007 + ph[i]) * 0.25;
        if (y[i] > H + 6) { y[i] = -6; x[i] = rand(0, W); }
        any = true;
      } else if (mode === 'fill') {
        var p = Math.min(1, Math.max(0, (t - delay[i]) / 1300));
        var e = easeOut(p);
        x[i] = sx[i] + (tx[i] - sx[i]) * e + Math.sin(now * 0.0006 + ph[i]) * 1.2 * e;
        y[i] = sy[i] + (ty[i] - sy[i]) * e + Math.cos(now * 0.0005 + ph[i]) * 0.8 * e;
        any = true;
      } else if (mode === 'drop') {
        if (t < delay[i]) { any = true; continue; }
        vy[i] += 0.022; y[i] += vy[i] * dt;
        if (y[i] > H + 10) live[i] = 0; else any = true;
      } else if (mode === 'grid') {
        var q = Math.min(1, Math.max(0, (t - delay[i]) / 900));
        var f = easeOut(q);
        x[i] = sx[i] + (tx[i] - sx[i]) * f; y[i] = sy[i] + (ty[i] - sy[i]) * f;
        if (q < 1) any = true;
      }
    }
    return any;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = alpha;
    var s = size, h = s / 2;
    for (var c = 0; c < INK.length; c++) {
      ctx.fillStyle = INK[c];
      for (var i = 0; i < n; i++) {
        if (live[i] && col[i] === c) ctx.fillRect(x[i] - h, y[i] - h, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    var more = update(now);
    draw(now);
    // The full sky shimmers for a few seconds, then holds still to save battery.
    if (more || mode === 'flurry' || (mode === 'fill' && now - t0 < 7000)) raf = requestAnimationFrame(frame);
    else running = false;
  }

  resize();
  return { set: set, resize: function () { resize(); if (mode !== 'off') { if (reduce) draw(); else kick(); } }, mode: function () { return mode; } };
})();
