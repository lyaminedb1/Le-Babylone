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

  /* ---------- Top bar shadow once scrolled ---------- */
  var topbar = document.querySelector('.topbar');
  function onScroll() { topbar.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
