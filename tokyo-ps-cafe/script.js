(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LED_COLORS = ['#b6ff2e', '#b6ff2e', '#b6ff2e', '#b6ff2e', '#ffb428', '#ffb428', '#ffb428', '#ff3c50', '#ff3c50', '#ff2fd0'];

  /* ---- açık / kapalı durumu (İstanbul saatiyle, her gün 12:00–03:00) ---- */
  const istanbul = () => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Istanbul', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date()).map(x => [x.type, x.value]));
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
    return { day, hour: +p.hour % 24, minute: +p.minute };
  };
  const updateStatus = () => {
    const el = $('#status');
    if (!el) return;
    const { day, hour } = istanbul();
    const open = hour >= 12 || hour < 3;
    el.classList.toggle('is-open', open);
    el.classList.toggle('is-closed', !open);
    $('span', el).textContent = open ? "Şu an açık · 03:00'e kadar" : "Şu an kapalı · 12:00'de açılır";
    // gece 00:00–03:00 arası hâlâ bir önceki günün mesaisi sayılır
    const shiftDay = hour < 3 ? (day + 6) % 7 : day;
    $$('#hours tr').forEach(tr => tr.classList.toggle('is-today', +tr.dataset.day === shiftDay));
  };
  try { updateStatus(); setInterval(updateStatus, 60000); } catch (e) { /* Intl yoksa varsayılan metin kalır */ }

  /* ---- vites ışıkları: kaydırma ilerlemesi ---- */
  const shift = $('#shift');
  const N = 24;
  for (let i = 0; i < N; i++) {
    const led = document.createElement('i');
    led.style.setProperty('--c', LED_COLORS[Math.floor(i / N * LED_COLORS.length)]);
    shift.appendChild(led);
  }
  const shiftLeds = $$('i', shift);
  const nav = $('#nav');
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const lit = Math.round((max > 0 ? scrollY / max : 0) * N);
    shiftLeds.forEach((l, i) => l.classList.toggle('on', i < lit));
    nav.classList.toggle('is-stuck', scrollY > 30);
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ---- mobil menü ---- */
  const toggle = $('#menuToggle');
  const setMenu = open => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  $$('#menu a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* ---- kaydırınca belirme + sayaçlar ---- */
  const countUp = el => {
    const target = +el.dataset.count, dec = +(el.dataset.dec || 0);
    const fmt = v => v.toFixed(dec).replace('.', ',');
    if (reduced) { el.textContent = fmt(target); return; }
    const t0 = performance.now(), dur = 1400;
    const step = t => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = fmt(target * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      io.unobserve(en.target);
    }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    $$('.reveal').forEach(el => io.observe(el));
    const cio = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      countUp(en.target); cio.unobserve(en.target);
    }), { threshold: .6 });
    $$('[data-count]').forEach(el => cio.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('in'));
  }

  /* ---- hero: neon yol ---- */
  const road = $('#road');
  if (road && road.getContext) {
    const ctx = road.getContext('2d');
    let w = 0, h = 0, visible = true, steer = 0, steerTarget = 0, raf = 0;
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = road.clientWidth; h = road.clientHeight;
      road.width = w * dpr; road.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = t => {
      ctx.clearRect(0, 0, w, h);
      const hy = h * .3, vx = w / 2 + steer * w * .12, depth = h - hy;
      const proj = z => hy + depth * Math.pow(z, 2.4);            // z: 0 ufuk … 1 yakın
      const edge = (z, side) => vx + side * (w * .03 + w * .62 * Math.pow(z, 2.4)) - steer * w * .12 * Math.pow(z, 2.4);

      // ufuk parıltısı
      const g = ctx.createRadialGradient(vx, hy, 0, vx, hy, w * .5);
      g.addColorStop(0, 'rgba(255,47,208,.5)'); g.addColorStop(1, 'rgba(255,47,208,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      // boyuna çizgiler
      ctx.lineWidth = 1;
      for (let i = -9; i <= 9; i++) {
        const side = i / 3;
        ctx.strokeStyle = `rgba(138,92,255,${Math.abs(i) === 3 ? .0 : .28})`;
        ctx.beginPath();
        for (let z = 0; z <= 1.001; z += .1) {
          const x = vx + (edge(z, 1) - vx + steer * w * .12 * Math.pow(z, 2.4)) * side - steer * w * .12 * Math.pow(z, 2.4);
          z === 0 ? ctx.moveTo(x, proj(z)) : ctx.lineTo(x, proj(z));
        }
        ctx.stroke();
      }
      // enine çizgiler (bize doğru akar)
      const off = (t * .00028) % 1;
      for (let k = 0; k < 16; k++) {
        const z = (k + off * 1) / 16, y = proj(z);
        ctx.strokeStyle = `rgba(255,47,208,${.08 + z * .45})`;
        ctx.lineWidth = 1 + z * 1.5;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      // pist kenarları
      for (const side of [-1, 1]) {
        ctx.strokeStyle = 'rgba(182,255,46,.9)'; ctx.lineWidth = 2.5;
        ctx.shadowColor = '#b6ff2e'; ctx.shadowBlur = 16;
        ctx.beginPath();
        for (let z = 0; z <= 1.001; z += .05) { const x = edge(z, side), y = proj(z); z === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      // orta şerit
      const dOff = (t * .0009) % 1;
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let k = 0; k < 9; k++) {
        const z0 = (k + dOff) / 9, z1 = z0 + .045;
        if (z1 > 1.1) continue;
        const cx = z => vx - steer * w * .12 * Math.pow(z, 2.4), hw = z => 1 + 7 * Math.pow(z, 2.4);
        ctx.beginPath();
        ctx.moveTo(cx(z0) - hw(z0), proj(z0)); ctx.lineTo(cx(z0) + hw(z0), proj(z0));
        ctx.lineTo(cx(z1) + hw(z1), proj(z1)); ctx.lineTo(cx(z1) - hw(z1), proj(z1));
        ctx.fill();
      }
    };
    const loop = t => {
      steer += (steerTarget - steer) * .04;
      draw(t);
      raf = visible ? requestAnimationFrame(loop) : 0;
    };
    resize(); draw(0);
    addEventListener('resize', () => { resize(); if (reduced) draw(0); });
    if (!reduced) {
      new IntersectionObserver(([en]) => {
        visible = en.isIntersecting;
        if (visible && !raf) raf = requestAnimationFrame(loop);
      }).observe(road);
      const shots = $('#shots');
      addEventListener('pointermove', e => {
        if (e.pointerType === 'touch') return;
        const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
        steerTarget = nx * 2;
        if (shots) { shots.style.setProperty('--px', (nx * -22).toFixed(1) + 'px'); shots.style.setProperty('--py', (ny * -16).toFixed(1) + 'px'); }
      }, { passive: true });
    }
  }

  /* ---- kokpit: gaz pedalı ---- */
  const dash = $('#dash');
  if (dash) {
    const leds = $('#leds'), pedal = $('#pedal');
    const gearEl = $('#gear'), speedEl = $('#speed'), rpmEl = $('#rpm'), val = $('#gaugeVal');
    for (let i = 0; i < 10; i++) { const l = document.createElement('i'); l.style.setProperty('--c', LED_COLORS[i]); leds.appendChild(l); }
    const ledEls = $$('i', leds);
    const GEARS = [[0, 62], [48, 108], [92, 152], [136, 202], [186, 254], [238, 312]];
    const ACCEL = [62, 46, 36, 28, 21, 15];
    let v = 0, gear = 0, down = false, last = 0, running = false, shiftPause = 0;
    const render = t => {
      const [lo, hi] = GEARS[gear];
      let rpm = v < 1 && !down ? .1 + Math.sin(t / 90) * .008 : .22 + .78 * Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
      val.style.strokeDasharray = `${(rpm * 100).toFixed(1)} 100`;
      gearEl.textContent = v < 1 && !down ? 'N' : gear + 1;
      speedEl.textContent = Math.round(v);
      rpmEl.textContent = (Math.round(rpm * 9000 / 50) * 50).toLocaleString('tr-TR');
      const lit = Math.round(Math.max(0, (rpm - .45) / .55) * 10);
      ledEls.forEach((l, i) => l.classList.toggle('on', i < lit));
      dash.classList.toggle('is-red', rpm > .9);
      dash.classList.toggle('is-moving', v > 2);
      dash.style.setProperty('--v', Math.min(1, v / 300).toFixed(3));
      dash.querySelector('.dash__lines').style.animationDuration = (1.1 - Math.min(1, v / 312) * .95).toFixed(2) + 's';
    };
    const tick = t => {
      const dt = Math.min(.05, (t - last) / 1000 || 0); last = t;
      if (shiftPause > 0) shiftPause -= dt;
      else if (down) v = Math.min(312, v + ACCEL[gear] * dt);
      if (!down) v = Math.max(0, v - (30 + v * .22) * dt);
      if (down && v >= GEARS[gear][1] && gear < 5) { gear++; shiftPause = .12; }
      while (gear > 0 && v < GEARS[gear][0]) gear--;
      render(t);
      if (down || v > 0) requestAnimationFrame(tick);
      else { running = false; render(t); }
    };
    const press = on => {
      down = on;
      pedal.classList.toggle('is-down', on);
      if (on && !running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
    };
    pedal.addEventListener('pointerdown', e => { e.preventDefault(); pedal.setPointerCapture(e.pointerId); press(true); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => pedal.addEventListener(ev, () => press(false)));
    pedal.addEventListener('contextmenu', e => e.preventDefault());
    pedal.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); press(true); } });
    pedal.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') press(false); });
    pedal.addEventListener('blur', () => press(false));
    render(0);
  }

  /* ---- galeri: büyük görünüm ---- */
  const lb = $('#lightbox');
  if (lb && lb.showModal) {
    $$('.g[data-full]').forEach(b => b.addEventListener('click', () => {
      $('#lbImg').src = b.dataset.full; $('#lbImg').alt = b.dataset.cap; $('#lbCap').textContent = b.dataset.cap;
      lb.showModal();
    }));
    $('#lbClose').addEventListener('click', () => lb.close());
    lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
  }

  /* ---- yorumlar: oklar ---- */
  const track = $('#revTrack');
  if (track) {
    const by = dir => track.scrollBy({ left: dir * (track.firstElementChild.offsetWidth + 20), behavior: reduced ? 'auto' : 'smooth' });
    $('#revPrev').addEventListener('click', () => by(-1));
    $('#revNext').addEventListener('click', () => by(1));
  }

  /* ---- harita: isteyince yükle ---- */
  const mapBtn = $('#mapLoad');
  if (mapBtn) mapBtn.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.title = 'Tokyo SimRace & PlayStation Cafe konumu';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    f.src = 'https://www.google.com/maps?q=Tokyo+SimRace+%26+PlayStation+Cafe+%C3%87ekmek%C3%B6y&ll=41.0188977,29.23154&z=16&output=embed';
    $('#map').insertBefore(f, $('.map__card'));
    $('#map').classList.add('is-live');
    mapBtn.remove();
  });

  $('#year').textContent = new Date().getFullYear();
})();
