(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------- Open / closed badge (Paris time, 11h – minuit every day) ---------- */
  var OPEN_HOUR = 11, CLOSE_HOUR = 24;
  var status = document.querySelector('[data-status]');
  function updateStatus() {
    if (!status) return;
    var parts = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
    }).formatToParts(new Date());
    var h = +parts.find(function (p) { return p.type === 'hour'; }).value;
    var m = +parts.find(function (p) { return p.type === 'minute'; }).value;
    var now = h + m / 60;
    var open = now >= OPEN_HOUR && now < CLOSE_HOUR;
    var text;
    if (open) text = CLOSE_HOUR - now <= 1 ? 'Ouvert · ferme bientôt' : 'Ouvert maintenant';
    else text = 'Fermé · ouvre à ' + OPEN_HOUR + 'h';
    status.querySelector('[data-status-text]').textContent = text;
    status.classList.toggle('is-open', open);
    status.hidden = false;
  }
  updateStatus();
  setInterval(updateStatus, 60000);

  /* ---------- Hero dish slideshow ---------- */
  var slidesEl = document.querySelector('[data-slides]');
  if (slidesEl) {
    var slides = slidesEl.querySelectorAll('.slide');
    var dots = document.querySelectorAll('.slide-dots button');
    var nameEl = document.querySelector('[data-slide-name]');
    var priceEl = document.querySelector('[data-slide-price]');
    var caption = document.querySelector('.slide-caption');
    var current = 0, timer = null, DURATION = 5500;

    function show(i) {
      slides[current].classList.remove('is-active');
      dots[current].classList.remove('is-active');
      current = (i + slides.length) % slides.length;
      slides[current].classList.add('is-active');
      // restart the progress bar animation on the active dot
      var bar = dots[current].querySelector('i');
      bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
      dots[current].classList.add('is-active');
      caption.classList.remove('is-in'); void caption.offsetWidth;
      nameEl.textContent = slides[current].dataset.name;
      priceEl.textContent = slides[current].dataset.price;
      caption.classList.add('is-in');
    }
    function play() {
      if (reduceMotion) return;
      clearInterval(timer);
      timer = setInterval(function () { show(current + 1); }, DURATION);
    }
    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { show(i); play(); });
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) clearInterval(timer); else play();
    });
    if (reduceMotion) document.documentElement.classList.add('no-autoplay');
    play();
  }

  /* ---------- Count-up on the review number ---------- */
  var counter = document.querySelector('[data-count]');
  if (counter && !reduceMotion) {
    var target = +counter.dataset.count, start = null;
    counter.textContent = '0';
    setTimeout(function () {
      requestAnimationFrame(function step(t) {
        if (!start) start = t;
        var p = Math.min((t - start) / 1400, 1);
        counter.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
      });
    }, 800);
  }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- Menu: highlight the category being read ---------- */
  var chipBar = document.querySelector('.chips');
  if (chipBar && 'IntersectionObserver' in window) {
    var chips = {};
    chipBar.querySelectorAll('a').forEach(function (a) { chips[a.getAttribute('href').slice(1)] = a; });
    var active = null;
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var chip = chips[e.target.id];
        if (!chip || chip === active) return;
        if (active) active.classList.remove('is-active');
        active = chip;
        chip.classList.add('is-active');
        // keep the active chip visible in the horizontal bar (mobile)
        var left = chip.offsetLeft - chipBar.clientWidth / 2 + chip.clientWidth / 2;
        chipBar.scrollTo({ left: left, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    }, { rootMargin: '-140px 0px -60% 0px' });
    Object.keys(chips).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) spy.observe(el);
    });
  }

  /* ---------- Grill: plate on fire (canvas particles) ---------- */
  var fireCanvas = document.querySelector('[data-fire]');
  if (fireCanvas && fireCanvas.getContext) {
    if (reduceMotion) initFire(fireCanvas, true); // frozen flames, no movement
    else initFire(fireCanvas, false);
  }

  function initFire(canvas, still) {
    var section = canvas.parentElement;
    var stage = section.querySelector('[data-fire-stage]');
    var ctx = canvas.getContext('2d');
    var dpr = 0.5; // flames are soft: render at half resolution, the browser upscales it (4x fewer pixels)
    var W = 0, H = 0, cx = 0, cy = 0, R = 0, scale = 1;
    var parts = [], MAX = 1100, time = 0;
    var wind = 0, windTarget = 0, boost = 0, running = false, raf = 0;
    var serve = section.querySelector('[data-serve]');
    var media = stage.closest('.hero__media--fire');
    var lit = !serve;

    // Pre-rendered glow sprites, from hot core to cooling smoke-red
    function sprite(r, g, b) {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',1)');
      gr.addColorStop(0.35, 'rgba(' + r + ',' + g + ',' + b + ',.55)');
      gr.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
      return c;
    }
    var SPR = [sprite(255, 246, 210), sprite(255, 196, 80), sprite(255, 120, 30), sprite(214, 52, 18), sprite(120, 22, 10)];

    function measure() {
      var sr = section.getBoundingClientRect(), pr = stage.getBoundingClientRect();
      W = canvas.width = Math.round(sr.width * dpr);
      H = canvas.height = Math.round(sr.height * dpr);
      cx = (pr.left - sr.left + pr.width / 2) * dpr;
      cy = (pr.top - sr.top + pr.height / 2) * dpr;
      R = (pr.width / 2) * dpr;
      scale = R / (220 * dpr);
    }

    function spawnFlame(power) {
      if (parts.length >= MAX) return;
      // flames rise from the top half and the sides of the plate
      var a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
      var sx = Math.cos(a), sy = Math.sin(a);
      parts.push({
        e: false,
        x: cx + sx * R * 0.9, y: cy + sy * R * 0.9,
        vx: sx * 0.55 * power,
        vy: -(0.8 + Math.random() * 1.2) * power,
        s: (34 + Math.random() * 46) * scale * dpr * (0.85 + power * 0.2),
        ph: Math.random() * 6.28,
        l: 0, m: 42 + Math.random() * 40
      });
    }
    function spawnEmber(power) {
      if (parts.length >= MAX) return;
      var a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
      parts.push({
        e: true,
        x: cx + Math.cos(a) * R * (0.7 + Math.random() * 0.4), y: cy + Math.sin(a) * R * (0.7 + Math.random() * 0.4),
        vx: (Math.random() - 0.5) * 1.2 * power, vy: -(0.7 + Math.random() * 1.6) * power,
        s: (1.6 + Math.random() * 2.6) * dpr, w: Math.random() * 6.28,
        l: 0, m: 110 + Math.random() * 150
      });
    }

    function frame() {
      raf = 0;
      if (!running) return;
      time++;
      wind += (windTarget - wind) * 0.04;
      boost *= 0.95;
      var intensity = 1 + boost;

      if (lit) {
        var n = Math.round((13 + Math.random() * 5) * intensity * Math.max(scale, 0.6));
        for (var i = 0; i < n; i++) spawnFlame(1 + boost * 0.35);
        if (Math.random() < 0.45 * intensity) spawnEmber(1 + boost * 0.2);
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      for (var j = parts.length - 1; j >= 0; j--) {
        var p = parts[j];
        p.l++;
        var t = p.l / p.m;
        if (t >= 1 || p.y < -40) { parts[j] = parts[parts.length - 1]; parts.pop(); continue; }
        if (p.e) {
          p.w += 0.08;
          p.vx += Math.sin(p.w) * 0.03 + wind * 0.02;
          p.x += p.vx * dpr; p.y += p.vy * dpr;
          ctx.globalAlpha = (1 - t) * (0.6 + Math.sin(p.l * 0.3) * 0.4);
          var es = p.s * 3;
          ctx.drawImage(SPR[t < 0.5 ? 0 : 1], p.x - es / 2, p.y - es / 2, es, es);
        } else {
          // shared sway field makes neighbouring particles move together into tongues
          p.vx += Math.sin(p.y / dpr * 0.018 + time * 0.07 + p.ph * 0.3) * 0.09 + (Math.random() - 0.5) * 0.12 + wind * 0.07;
          p.vx *= 0.97;
          p.vy -= 0.03;
          p.x += p.vx * dpr; p.y += p.vy * dpr;
          p.s *= 0.976;
          var stageIdx = t < 0.1 ? 0 : t < 0.28 ? 1 : t < 0.55 ? 2 : t < 0.8 ? 3 : 4;
          ctx.globalAlpha = (t < 0.12 ? t / 0.12 : 1 - t) * 0.5;
          ctx.drawImage(SPR[stageIdx], p.x - p.s / 2, p.y - p.s * 0.85, p.s, p.s * 1.7);
        }
      }
      ctx.globalAlpha = 1;
      if (!still) raf = requestAnimationFrame(frame);
    }
    function start() { if (!running) { running = true; if (!raf) raf = requestAnimationFrame(frame); } }
    function stop() { running = false; }

    if (still) {
      var renderStill = function () {
        measure();
        parts = []; lit = true; running = true; boost = 0;
        for (var f = 0; f < 90; f++) frame();
        running = false;
      };
      renderStill();
      if ('ResizeObserver' in window) new ResizeObserver(renderStill).observe(section);
      else window.addEventListener('resize', renderStill);
      return;
    }

    // The mouse/finger "blows" on the fire: flames lean away from the pointer
    section.addEventListener('pointermove', function (e) {
      var r = section.getBoundingClientRect();
      var px = (e.clientX - r.left) * dpr;
      windTarget = Math.max(-1, Math.min(1, (cx - px) / (W * 0.35)));
    });
    section.addEventListener('pointerleave', function () { windTarget = 0; });
    // Touch / click the plate: flare-up
    stage.addEventListener('pointerdown', function () {
      boost = Math.min(boost + 2.2, 3.5);
      for (var k = 0; k < 40; k++) spawnEmber(2.2);
    });

    function ignite() {
      if (lit) return;
      measure();
      lit = true;
      boost = 3.5; // whoosh
      for (var k = 0; k < 70; k++) spawnEmber(2.6);
      if (media) media.classList.add('is-lit');
    }
    if (serve) {
      serve.addEventListener('animationend', ignite);
      setTimeout(ignite, 2400); // safety net
    }

    measure();
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(section);
    else window.addEventListener('resize', measure);
    // the reveal transition moves the stage; re-measure once it settles
    setTimeout(measure, 1200);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries[0].isIntersecting ? start() : stop();
      }, { rootMargin: '100px' }).observe(section);
    } else start();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else if (section.getBoundingClientRect().top < innerHeight) start();
    });
  }

  /* ---------- Top bar shadow once scrolled ---------- */
  var topbar = document.querySelector('.topbar');
  function onScroll() { topbar.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
