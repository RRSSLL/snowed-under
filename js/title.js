// The title page: snow's words pile up, the title card rises out of the drift carrying them,
// and a snowman shoves them off the end. Adapted from the opening prototype.
window.Title = (function () {
  // The 29 standard synonyms of "snow" (no slang, no counts shown on the title card).
  var WORDS = ['bamboozle', 'beguile', 'bluff', 'cajole', 'deceive', 'delude', 'diddle', 'dupe', 'gammon', 'gull', 'hoax', 'hornswaggle', 'humbug', 'pigeon', 'put something over', 'string along', 'take in', 'trick', 'snowfall', 'snowstorm', 'snow blanket', 'mantle of snow', 'shower', 'rain', 'pour', 'avalanche', 'noise', 'picture noise', 'static'];
  var INKS = ['#63291B', '#3A5F59', '#88432C', '#6E4A38'];
  var STEP = 1000 / 120;          // fixed physics step (ms)
  var SPAWN_GAP = 60;             // ms between words starting to fall
  var SETTLE = 1500;              // ms after the last word before the title rises
  var RISE = 2000;                // ms for the title to rise out of the drift
  var PAUSE = 450;                // ms the snowman waits before he starts pushing
  // Snowman drawing geometry (viewBox units): ground at y=200; his back at x=34; the thesaurus
  // spine runs from x=112 to x=170 and from y=4 to y=200.
  var VB_W = 176, VB_H = 204, GROUND = 200, BACK = 34, BOOK_R = 170, BOOK_H = 196;
  // His solid shape hugs his outline: up his back, over his hat, then across the top of the book.
  var HULL = [[34, 200], [34, 160], [66, 84], [112, 2], [170, 14], [170, 200]];

  var stage = document.getElementById('title');
  var cardEl = document.getElementById('tcard');
  var plowEl = document.getElementById('plow');
  var promptEl = stage.querySelector('.tprompt');
  var reduce = false;   // Ryan's call: everyone gets the full animations, even with Reduce Motion on.
  var S = null, rafId = 0, onDone = null, fastForward = false;

  // Six-armed snowflake ornament for the title card.
  (function () {
    var d = '';
    for (var i = 0; i < 6; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 3, c = Math.cos(a), s = Math.sin(a);
      d += 'M15 15L' + (15 + 13 * c).toFixed(2) + ' ' + (15 + 13 * s).toFixed(2);
      var bx = 15 + 8 * c, by = 15 + 8 * s;
      for (var k = -1; k <= 1; k += 2) {
        var b = a + k * 0.75;
        d += 'M' + bx.toFixed(2) + ' ' + by.toFixed(2) + 'L' + (bx + 4.5 * Math.cos(b)).toFixed(2) + ' ' + (by + 4.5 * Math.sin(b)).toFixed(2);
      }
    }
    document.getElementById('flake').setAttribute('d', d);
  })();

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  // Starts gently, then holds a steady pace.
  function rampIn(p) { var a = 0.18; return (p < a ? p * p / (2 * a) : p - a / 2) / (1 - a / 2); }
  function place(el, x, y, w, h, angle) {
    el.style.transform = 'translate(' + (x - w / 2).toFixed(1) + 'px,' + (y - h / 2).toFixed(1) + 'px) rotate(' + angle.toFixed(4) + 'rad)';
  }

  // Without the physics library, just show the title card.
  function staticFallback() {
    var W = innerWidth, H = innerHeight;
    cardEl.style.visibility = 'visible';
    place(cardEl, W / 2, H * 0.5, cardEl.offsetWidth, cardEl.offsetHeight, 0);
    promptEl.classList.add('show');
    if (onDone) onDone();
  }

  function setup() {
    if (typeof Matter === 'undefined') { staticFallback(); return; }
    var Engine = Matter.Engine, Bodies = Matter.Bodies, Composite = Matter.Composite;
    cancelAnimationFrame(rafId);
    Array.prototype.forEach.call(stage.querySelectorAll('.word'), function (e) { e.remove(); });
    promptEl.classList.remove('show');
    plowEl.classList.remove('walking');

    var W = innerWidth, H = innerHeight;
    var engine = Engine.create();
    engine.gravity.scale = 0.0011;
    engine.positionIterations = 10;
    engine.velocityIterations = 8;
    var T = 400;
    var floor = Bodies.rectangle(W / 2, H + T / 2, W + 2 * T, T, { isStatic: true, friction: 0.5, frictionStatic: 0.8 });
    var walls = [
      Bodies.rectangle(-T / 2, (H - 4000) / 2, T, H + 4000, { isStatic: true, friction: 0.1 }),
      Bodies.rectangle(W + T / 2, (H - 4000) / 2, T, H + 4000, { isStatic: true, friction: 0.1 })
    ];
    Composite.add(engine.world, [floor].concat(walls));

    // Measure every word at 100px, then scale so the words cover a set share of the screen.
    var items = shuffle(WORDS.slice()).map(function (w, i) {
      var el = document.createElement('span');
      el.className = 'word';
      el.textContent = w;
      el.setAttribute('aria-hidden', 'true');
      el.style.color = INKS[i % INKS.length];
      el.style.fontSize = '100px';
      stage.appendChild(el);
      return { el: el, w100: el.offsetWidth, k: rand(0.78, 1.22), ph: rand(0, 6.28) };
    });
    var fill = W < 700 ? 0.15 : 0.16;
    var area = items.reduce(function (s, it) { return s + (it.w100 * it.k) * (110 * it.k); }, 0);
    var m = clamp(Math.sqrt(fill * W * H / area), 0.17, 0.44);
    items.forEach(function (it, i) {
      var f = 100 * it.k * m;
      var maxW = W - 24;
      if (it.w100 * f / 100 + f * 0.2 > maxW) f = maxW / (it.w100 / 100 + 0.2);
      it.bw = it.w100 * f / 100 + f * 0.2;
      it.bh = f * 1.1;
      it.at = 200 + i * SPAWN_GAP;
      var st = it.el.style;
      st.fontSize = f.toFixed(1) + 'px';
      st.width = it.bw.toFixed(1) + 'px';
      st.height = it.bh.toFixed(1) + 'px';
      st.lineHeight = it.bh.toFixed(1) + 'px';
    });

    // The title card is a solid, hand-driven body, parked far below until it is time to rise.
    var cw = cardEl.offsetWidth, ch = cardEl.offsetHeight, yPark = H + 3000;
    var cardBody = Bodies.rectangle(W / 2, yPark, cw, ch, { isStatic: true, friction: 0.3, frictionStatic: 0.5 });
    Composite.add(engine.world, cardBody);
    cardEl.style.visibility = 'visible';
    plowEl.style.visibility = 'hidden';

    var lastAt = items[items.length - 1].at;
    S = { engine: engine, W: W, H: H, items: items, floor: floor, walls: walls, floorGone: false,
      spawned: 0, t: 0, acc: 0, last: null, lastAt: lastAt,
      card: { body: cardBody, cw: cw, ch: ch, y0: yPark, yC: yPark, yF: yPark, y: yPark },
      plow: null, phase: 'fall', riseAt: lastAt + SETTLE, tPhase: 0, pushDur: 0, pushX0: 0, doneAt: 0 };
    render();

    if (reduce || fastForward) {
      // Run the whole sequence instantly and show the final page.
      while (S.phase !== 'done') step();
      render();
      promptEl.classList.add('show');
      if (onDone) onDone();
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  function spawn(it) {
    var lo = it.bw / 2 + 6, hi = S.W - it.bw / 2 - 6;
    var x = lo < hi ? rand(lo, hi) : S.W / 2;
    it.body = Matter.Bodies.rectangle(x, -it.bh - rand(10, 160), it.bw, it.bh, {
      angle: rand(-0.5, 0.5), chamfer: { radius: Math.min(8, it.bh * 0.25) },
      friction: 0.4, frictionStatic: 0.9, frictionAir: 0.022, restitution: 0.04, density: 0.0016
    });
    Matter.Body.setAngularVelocity(it.body, rand(-0.03, 0.03));
    Matter.Composite.add(S.engine.world, it.body);
    it.el.style.visibility = 'visible';
  }

  function removeWord(it, fade) {
    Matter.Composite.remove(S.engine.world, it.body);
    it.body = null;
    if (fade) it.el.classList.add('gone'); else it.el.style.visibility = 'hidden';
  }

  // Move the card and the snowman standing on it (velocity is kept so they push and carry words).
  function moveCard(y) {
    var c = S.card, p = S.plow;
    c.y = y;
    if (p) p.y = y - c.ch / 2 - GROUND * p.s;
    hold();
  }
  function hold() {
    var c = S.card, p = S.plow;
    Matter.Body.setPosition(c.body, { x: S.W / 2, y: c.y }, true);
    if (p) Matter.Body.setPosition(p.body, { x: p.x + p.centre.x, y: p.y + p.centre.y }, true);
  }

  // Just before the title rises: size the snowman and his thesaurus to the drift, stand them on
  // the left end of the card, and work out how high to carry the pile so it all stays in view.
  function startRise() {
    var W = S.W, H = S.H, c = S.card, top = H;
    S.items.forEach(function (it) { if (it.body && it.body.bounds.max.y > 0) top = Math.min(top, it.body.bounds.min.y); });
    var driftH = H - top;
    var bookH = clamp(driftH * 1.05 + 12, 110, H * 0.3), s = bookH / BOOK_H;
    plowEl.style.width = (VB_W * s).toFixed(1) + 'px';
    plowEl.style.height = (VB_H * s).toFixed(1) + 'px';
    plowEl.style.visibility = 'visible';
    var verts = HULL.map(function (v) { return { x: v[0] * s, y: v[1] * s }; });
    var centre = Matter.Vertices.centre(verts);
    var body = Matter.Bodies.fromVertices(0, H + 5000, [verts], { isStatic: true, friction: 0.25, frictionStatic: 0.4 });
    Matter.Composite.add(S.engine.world, body);
    S.plow = { body: body, s: s, centre: centre, y: 0,
      x: W / 2 - c.cw / 2 - BACK * s + 4, x1: W / 2 + c.cw / 2 - BOOK_R * s - 2 };
    // Start deep enough that the snowman's shape is below the drift too.
    c.y0 = H + bookH * 1.02 + 30 + c.ch / 2;
    c.yF = Math.max(c.ch / 2 + bookH + 46, H * 0.5);
    // Rise straight to the final spot, so the card doesn't move again after the push. On short
    // screens the top of the pile can sit above the screen; the snowman pushes it off all the same.
    c.yC = c.yF;
    c.y = c.y0;
    S.plow.y = c.y0 - c.ch / 2 - GROUND * s;
    Matter.Body.setPosition(c.body, { x: W / 2, y: c.y }, false);
    Matter.Body.setPosition(body, { x: S.plow.x + centre.x, y: S.plow.y + centre.y }, false);
  }

  // Any word riding on top of the book gets tipped forward into the pile.
  function tipOffBook() {
    var p = S.plow, bookTop = p.y + 14 * p.s, left = p.x + 100 * p.s, right = p.x + (BOOK_R + 6) * p.s;
    S.items.forEach(function (it) {
      var b = it.body;
      if (!b || b.speed > 2) return;
      if (b.bounds.max.y < bookTop + 4 && b.position.x > left && b.position.x < right) {
        Matter.Body.setVelocity(b, { x: rand(3, 5), y: -rand(1, 2) });
        Matter.Body.setAngularVelocity(b, rand(0.02, 0.05));
      }
    });
  }

  function step() {
    var Body = Matter.Body, t = S.t, c = S.card, p = S.plow;
    while (S.spawned < S.items.length && S.items[S.spawned].at <= t) spawn(S.items[S.spawned++]);

    // A gentle side-to-side drift while the words are still high up and falling.
    S.items.forEach(function (it) {
      var b = it.body;
      if (!b) return;
      if (b.position.y > S.H + 400) { removeWord(it, false); return; }
      if (b.position.y < S.H * 0.45 && b.velocity.y > 0.5) {
        Body.applyForce(b, b.position, { x: Math.sin(t * 0.0015 + it.ph) * 0.00006 * b.mass, y: 0 });
      }
    });

    if (S.phase === 'fall') {
      if (t >= S.riseAt) { startRise(); S.phase = 'rise'; S.tPhase = t; p = S.plow; }
    } else if (S.phase === 'rise') {
      var r = Math.min(1, (t - S.tPhase) / RISE);
      moveCard(c.y0 + (c.yC - c.y0) * easeInOut(r));
      // Once the card is lifting the drift, the ground drops away: anything it isn't carrying falls out of view.
      if (!S.floorGone && c.y - c.ch / 2 < S.H - 2) {
        S.floorGone = true;
        [S.floor].concat(S.walls).forEach(function (b) { Matter.Composite.remove(S.engine.world, b); });
      }
      if (r >= 1) { S.phase = 'pause'; S.tPhase = t; }
    } else if (S.phase === 'pause') {
      hold();
      if (t - S.tPhase >= PAUSE) {
        S.phase = 'push'; S.tPhase = t; S.pushX0 = p.x; S.nextTip = t;
        S.pushDur = clamp((p.x1 - p.x) / 190 * 1000, 1500, 2600);
        plowEl.classList.add('walking');
      }
    } else if (S.phase === 'push') {
      var q = Math.min(1, (t - S.tPhase) / S.pushDur);
      p.x = S.pushX0 + (p.x1 - S.pushX0) * rampIn(q);
      hold();
      if (t >= S.nextTip) { tipOffBook(); S.nextTip = t + 300; }
      if (q >= 1) { S.phase = 'shed'; S.tPhase = t; plowEl.classList.remove('walking'); }
    } else if (S.phase === 'shed') {
      hold();
      if (t - S.tPhase >= 800) {
        // Safety net: fade out any word still in view, or above the screen where it could fall back in.
        S.items.forEach(function (it) {
          var bb = it.body && it.body.bounds;
          if (bb && bb.max.x > 0 && bb.min.x < S.W && bb.min.y < S.H) removeWord(it, true);
        });
        if (Math.abs(c.yF - c.y) < 1) { S.phase = 'done'; S.doneAt = t; }
        else { S.phase = 'settle'; S.tPhase = t; S.settleFrom = c.y; }
      }
    } else if (S.phase === 'settle') {
      var u = Math.min(1, (t - S.tPhase) / 700);
      moveCard(S.settleFrom + (c.yF - S.settleFrom) * easeInOut(u));
      if (u >= 1) { S.phase = 'done'; S.doneAt = t; }
    } else {
      hold();
    }

    Matter.Engine.update(S.engine, STEP);
    S.t += STEP;
  }

  function render() {
    S.items.forEach(function (it) {
      if (it.body) place(it.el, it.body.position.x, it.body.position.y, it.bw, it.bh, it.body.angle);
    });
    var c = S.card, p = S.plow;
    place(cardEl, S.W / 2, c.y, c.cw, c.ch, 0);
    if (p) plowEl.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px)';
  }

  function loop(now) {
    if (S.last === null) S.last = now;
    S.acc += Math.min(64, now - S.last);
    S.last = now;
    var n = 0;
    while (S.acc >= STEP && n < 6) { step(); S.acc -= STEP; n++; }
    render();
    if (S.phase === 'done' && !promptEl.classList.contains('show')) { promptEl.classList.add('show'); if (onDone) onDone(); }
    if (!(S.phase === 'done' && S.t > S.doneAt + 1500)) rafId = requestAnimationFrame(loop);
  }

  function whenFontsReady(fn) {
    var ready = document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load('italic 500 100px "EB Garamond"'), document.fonts.load('500 100px "EB Garamond"')])
      : Promise.resolve();
    Promise.race([ready, new Promise(function (r) { setTimeout(r, 2500); })]).then(fn, fn);
  }

  // Play the sequence from the start; `done` is called once the title has settled.
  function start(done) {
    onDone = done; fastForward = false;
    stage.hidden = false; stage.classList.remove('out');
    whenFontsReady(setup);
  }
  // Show the finished title page straight away.
  function showFinal(done) {
    onDone = done; fastForward = true;
    stage.hidden = false; stage.classList.remove('out');
    whenFontsReady(setup);
  }
  function busy() { return !!S && S.phase !== 'done' && !stage.hidden; }
  function finish() { if (busy()) { cancelAnimationFrame(rafId); fastForward = true; setup(); } }
  function hide() {
    cancelAnimationFrame(rafId);
    stage.classList.add('out');
    setTimeout(function () { if (stage.classList.contains('out')) stage.hidden = true; }, 520);
  }
  function isShown() { return !stage.hidden && !stage.classList.contains('out'); }
  return { start: start, showFinal: showFinal, busy: busy, finish: finish, hide: hide, isShown: isShown };
})();
