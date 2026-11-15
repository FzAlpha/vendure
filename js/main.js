/* =========================================================
   VERDURE — interactions
   Lenis smooth scroll + GSAP (ScrollTrigger, SplitText)
   ========================================================= */
(() => {
  const html = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  // If the CDN failed, fall back to a fully static, readable page.
  if (!window.gsap || !window.ScrollTrigger) {
    html.classList.remove('js');
    return;
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(SplitText);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------------------------------------------------------
     Smooth scroll (Lenis)
     --------------------------------------------------------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  /* Pointer-hover sync: hover UI asks "what is under the pointer right now?" on every
     mousemove and every scroll frame, so nothing stays stuck when the page moves under a
     still mouse (e.g. after clicking a footer link). */
  const pointerSubs = [];
  let px = -1, py = -1, pointerFrame = 0;
  const runPointerSync = () => {
    pointerFrame = 0;
    const el = px < 0 ? null : document.elementFromPoint(px, py);
    pointerSubs.forEach((fn) => fn(el));
  };
  const queuePointerSync = () => { if (!pointerFrame) pointerFrame = requestAnimationFrame(runPointerSync); };
  const onPointerSync = (fn) => pointerSubs.push(fn);
  if (finePointer) {
    addEventListener('mousemove', (e) => { px = e.clientX; py = e.clientY; queuePointerSync(); }, { passive: true });
    addEventListener('scroll', queuePointerSync, { passive: true });
    lenis && lenis.on('scroll', queuePointerSync);
    document.documentElement.addEventListener('mouseleave', () => { px = py = -1; queuePointerSync(); });
    addEventListener('blur', () => { px = py = -1; queuePointerSync(); });
  }

  const scrollToTarget = (target, duration = 1.6) => {
    if (lenis) lenis.scrollTo(target, { duration });
    else if (target === 0) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  };

  /* ---------------------------------------------------------
     Nav, menu, anchors
     --------------------------------------------------------- */
  const nav = $('.nav');
  const menu = $('.menu');
  const burger = $('.nav__burger');
  let menuOpen = false;

  const menuTl = gsap.timeline({ paused: true })
    .set(menu, { visibility: 'visible' })
    .fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.inOut' })
    .fromTo('.menu__list a', { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: 'expo.out', stagger: 0.05 }, '-=0.4')
    .fromTo('.menu__figure', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: 'expo.out' }, '<');

  function openMenu() {
    menuOpen = true;
    nav.classList.add('menu-open');
    nav.classList.remove('is-hidden');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    menu.setAttribute('aria-hidden', 'false');
    lenis && lenis.stop();
    menuTl.timeScale(1).play();
  }
  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    nav.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    menu.setAttribute('aria-hidden', 'true');
    lenis && lenis.start();
    menuTl.timeScale(1.6).reverse();
  }
  burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
  addEventListener('keydown', (e) => e.key === 'Escape' && closeMenu());

  $$('[data-scroll-to]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || !id.startsWith('#')) return;
      const target = id === '#top' ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      closeMenu();
      scrollToTarget(target);
    });
  });
  $('.totop').addEventListener('click', () => scrollToTarget(0, 2));

  /* ---------------------------------------------------------
     Newsletter (front-end only)
     --------------------------------------------------------- */
  const form = $('.news');
  const msg = $('.news__msg');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    if (!input.value || !input.checkValidity()) {
      msg.textContent = 'Please enter a valid email address.';
      return;
    }
    msg.textContent = 'Thank you — the first letter arrives next month.';
    input.value = '';
  });

  /* ---------------------------------------------------------
     Cursor
     --------------------------------------------------------- */
  if (finePointer) {
    const cursor = $('.cursor');
    const label = $('.cursor__label');
    const cx = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
    const cy = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });
    addEventListener('mousemove', (e) => { cx(e.clientX); cy(e.clientY); });
    // Hover state is derived from what is actually under the pointer, on every move AND every
    // scroll frame — mouseenter/leave don't fire while smooth-scroll moves the page under a still mouse.
    onPointerSync((el) => {
      const target = el && el.closest('[data-cursor]');
      if (target) label.textContent = target.dataset.cursor;
      cursor.classList.toggle('is-active', !!target);
    });
  }

  /* ---------------------------------------------------------
     Videos: lazy-load the film, pause anything off-screen
     --------------------------------------------------------- */
  const heroVideo = $('.hero__video');
  const filmVideo = $('.film__video');

  const safePlay = (v) => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };

  ScrollTrigger.create({
    trigger: '.hero',
    start: 'top bottom',
    end: 'bottom top',
    onEnterBack: () => safePlay(heroVideo),
    onLeave: () => heroVideo.pause(),
  });

  /* ---------------------------------------------------------
     Preloader → intro
     --------------------------------------------------------- */
  const loader = $('.loader');
  const plant = $('.loader__plant');
  const leaves = $$('.loader__leaf');
  const loaderChars = $$('.loader__word .ch');
  const curve = $('.loader__curve path');
  const FLAT = 'M0 0 L100 0 L100 0 Q50 0 0 0 Z';
  const BULGE = 'M0 0 L100 0 L100 0 Q50 100 0 0 Z';

  // The plant grows with real loading progress. Each part carries its own start time
  // (data-at) on this timeline: roots and soil first, the stem draws upward, every leaf
  // unfurls from its node the moment the stem reaches it, veins etch in, and the flower
  // at the crown opens last.
  const grow = gsap.timeline({ paused: true });
  const at = (el) => +el.dataset.at || 0;
  $$('.loader__ground, .loader__root, .loader__stem, .loader__tendril', loader).forEach((el) =>
    grow.to(el, { strokeDashoffset: 0, duration: +el.dataset.dur || 0.3, ease: el.classList.contains('loader__stem') ? 'none' : 'power1.out' }, at(el)));
  grow.to($$('.loader__soil', loader), { opacity: 1, duration: 0.2, stagger: 0.015 }, 0.05);
  leaves.forEach((leaf) => {
    const o = leaf.dataset.origin, side = +leaf.dataset.side || 1, t = at(leaf);
    grow.fromTo(leaf,
      { opacity: 0, scale: 0, rotation: -34 * side, svgOrigin: o },
      { opacity: 1, scale: 1, rotation: 0, svgOrigin: o, duration: 0.22, ease: 'back.out(1.6)' }, t);
    const vein = leaf.querySelector('.loader__vein');
    if (vein) grow.to(vein, { strokeDashoffset: 0, duration: 0.2, ease: 'power1.out' }, t + 0.1);
  });
  const flower = $('.loader__flower', loader);
  if (flower) {
    const t = at(flower), o = flower.dataset.origin;
    grow.fromTo(flower, { opacity: 0, scale: 0, svgOrigin: o }, { opacity: 1, scale: 1, svgOrigin: o, duration: 0.12, ease: 'power2.out' }, t);
    $$('.loader__petal', flower).forEach((p) => {
      grow.fromTo(p, { rotation: 0, scaleY: 0.7, svgOrigin: p.dataset.origin },
        { rotation: +p.dataset.rot, scaleY: 1, svgOrigin: p.dataset.origin, duration: 0.2, ease: 'back.out(1.4)' }, t + 0.08);
      const v = p.querySelector('.loader__vein');
      if (v) grow.to(v, { strokeDashoffset: 0, duration: 0.1 }, t + 0.16);
    });
    grow.fromTo($$('.loader__stamen', flower), { opacity: 0, scale: 0.3, svgOrigin: o },
      { opacity: 1, scale: 1, svgOrigin: o, duration: 0.1, stagger: 0.015 }, t + 0.16);
  }

  // Ambient life while waiting: wordmark rises, plant sways, light breathes, spores drift.
  const spores = $$('.loader__spore', loader);
  const ambient = [];
  if (!reduce) {
    gsap.fromTo(loaderChars, { y: 0, yPercent: 115 }, { y: 0, yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.06, delay: 0.25 });
    gsap.fromTo(plant, { rotation: -1.4, svgOrigin: '100 262' }, { rotation: 1.4, svgOrigin: '100 262', duration: 2.8, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    gsap.fromTo('.loader__glow', { scale: 0.92, opacity: 0.75 }, { scale: 1.06, opacity: 1, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    spores.forEach((s, i) => {
      const drift = gsap.timeline({ repeat: -1, delay: 0.6 + i * 0.35 });
      ambient.push(drift);
      drift
        .fromTo(s, { opacity: 0, x: 0, y: 0 }, { opacity: 0.8, duration: 0.9, ease: 'sine.out' })
        .to(s, { x: gsap.utils.random(-14, 14), y: gsap.utils.random(-34, -22), duration: 3.2, ease: 'sine.inOut' }, 0)
        .to(s, { opacity: 0, duration: 1, ease: 'sine.in' }, 2.2);
    });
  }

  const videoReady = new Promise((res) => {
    if (heroVideo.readyState >= 3) return res();
    heroVideo.addEventListener('canplay', res, { once: true });
    heroVideo.addEventListener('error', res, { once: true });
    setTimeout(res, 3500);
  });
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  const minTime = new Promise((r) => setTimeout(r, reduce ? 0 : 2200));

  const counter = { v: 0 };
  const renderCount = () => grow.progress(counter.v / 100);
  const countTween = gsap.to(counter, { v: 88, duration: 2.4, ease: 'power2.out', onUpdate: renderCount });

  let scenesBuilt = false;
  let introStarted = false;
  const ensureScenes = () => { if (!scenesBuilt) { scenesBuilt = true; buildScrollScenes(); } };

  Promise.all([fontsReady, videoReady, minTime]).then(() => {
    if (introStarted) return;
    countTween.kill();
    ensureScenes();
    gsap.to(counter, { v: 100, duration: reduce ? 0 : 0.5, ease: 'power2.inOut', onUpdate: renderCount, onComplete: intro });
  });

  // Safety net: never trap the visitor behind the loader (slow fonts, stalled video).
  setTimeout(() => {
    if (introStarted) return;
    countTween.kill();
    ensureScenes();
    counter.v = 100; renderCount();
    intro();
  }, 7000);
  setTimeout(() => {
    if (document.body.contains(loader)) { loader.remove(); lenis && lenis.start(); }
  }, 12000);

  let heroChars = [];

  function intro() {
    if (introStarted) return;
    introStarted = true;
    if (reduce) {
      loader.remove();
      return;
    }
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.killTweensOf([plant, '.loader__glow']);
        ambient.forEach((a) => a.kill());
        loader.remove();
        lenis && lenis.start();
      },
    });
    const lift = () => -(innerHeight + loader.querySelector('.loader__curve').getBoundingClientRect().height + 2);
    tl.to(loaderChars, { yPercent: -115, duration: 0.7, ease: 'power3.in', stagger: 0.035, overwrite: 'auto' }, 0.15)
      .to('.loader__sprout', { y: -40, scale: 1.04, opacity: 0, duration: 0.8, ease: 'power3.in' }, 0.1)
      .to(loader, { y: lift, duration: 1.3, ease: 'power3.inOut' }, 0.7)
      .to(curve, { attr: { d: BULGE }, duration: 0.65, ease: 'power2.in' }, 0.7)
      .to(curve, { attr: { d: FLAT }, duration: 0.65, ease: 'power2.out' }, 1.35)
      .from('.hero__video', { scale: 1.35, duration: 2.2, ease: 'expo.out' }, 1.15)
      .from(heroChars, { yPercent: 105, duration: 1.5, ease: 'expo.out', stagger: 0.055 }, '<0.1')
      .from('.hero__lede', { y: 24, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.06 }, '<0.35')
      .from(nav, { y: -24, opacity: 0, duration: 1, ease: 'expo.out', clearProps: 'transform,opacity' }, '<');
  }

  /* ---------------------------------------------------------
     Scroll scenes
     --------------------------------------------------------- */
  function buildScrollScenes() {
    const hasSplit = !!window.SplitText;

    // Hero masthead split into characters (used by the intro)
    if (hasSplit) {
      heroChars = SplitText.create('.hero__word', { type: 'chars', charsClass: 'char' }).chars;
    }

    // Marquee — fill the track, loop forever, speed up with scroll velocity
    const track = $('.marquee__track');
    const group = $('.marquee__group');
    while (track.scrollWidth < innerWidth * 2 + group.offsetWidth) {
      const clone = group.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    }
    if (!reduce) {
      const marquee = gsap.to(track, { x: () => -group.offsetWidth, duration: 26, ease: 'none', repeat: -1 });
      let boost = 0;
      if (lenis) lenis.on('scroll', (e) => { boost = Math.min(Math.abs(e.velocity) * 0.35, 7); });
      gsap.ticker.add(() => { boost *= 0.93; marquee.timeScale(1 + boost); });
    }

    // Film video lazy-load + play only when visible
    ScrollTrigger.create({
      trigger: '.film',
      start: 'top 180%',
      end: 'bottom -80%',
      onEnter: () => {
        if (!filmVideo.src) { filmVideo.src = filmVideo.dataset.src; filmVideo.load(); }
        safePlay(filmVideo);
      },
      onEnterBack: () => safePlay(filmVideo),
      onLeave: () => filmVideo.pause(),
      onLeaveBack: () => filmVideo.pause(),
    });

    if (reduce) {
      filmVideo.src = filmVideo.dataset.src;
      return;
    }

    /* ---- Hero parallax ---- */
    const heroST = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('.hero__media', { yPercent: 22, ease: 'none', scrollTrigger: heroST });
    gsap.to('.hero__title', { yPercent: -28, ease: 'none', scrollTrigger: { ...heroST } });
    gsap.to('.hero__bottom', { opacity: 0, ease: 'none', scrollTrigger: { ...heroST, end: '50% top' } });

    /* ---- Headings: masked line reveal ---- */
    if (hasSplit) {
      $$('[data-split]').forEach((el) => {
        SplitText.create(el, {
          type: 'lines',
          mask: 'lines',
          autoSplit: true,
          onSplit(self) {
            return gsap.from(self.lines, {
              yPercent: 110,
              duration: 1.3,
              ease: 'expo.out',
              stagger: 0.09,
              scrollTrigger: { trigger: el, start: 'top 88%', once: true },
            });
          },
        });
      });

      // Statement / big quote: words light up as you read
      $$('[data-words]').forEach((el) => {
        const split = SplitText.create(el, { type: 'words', wordsClass: 'w' });
        gsap.fromTo(split.words, { opacity: 0.12 }, {
          opacity: 1,
          ease: 'none',
          stagger: 0.1,
          scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 52%', scrub: true },
        });
      });
    }

    /* ---- Paragraph fades ---- */
    $$('[data-fade]').forEach((el) => {
      gsap.from(el, {
        y: 40, opacity: 0, duration: 1.2, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    });

    /* ---- Image clip reveals ---- */
    $$('[data-clip]').forEach((fig) => {
      const media = fig.querySelector('.media');
      gsap.fromTo(media, { clipPath: 'inset(100% 0% 0% 0%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'expo.inOut',
        scrollTrigger: { trigger: fig, start: 'top 86%', once: true },
      });
    });

    /* ---- Image parallax ---- */
    $$('[data-parallax]').forEach((m) => {
      const img = m.querySelector('img');
      gsap.fromTo(img, { yPercent: -7 }, {
        yPercent: 7, ease: 'none',
        scrollTrigger: { trigger: m, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    /* ---- Cover image widens to full bleed ---- */
    gsap.fromTo('.cover__image .media', { clipPath: 'inset(0% 10% 0% 10%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
      scrollTrigger: { trigger: '.cover__image', start: 'top 92%', end: 'top 12%', scrub: true },
    });

    const mm = gsap.matchMedia();

    /* ---- In This Issue: horizontal scroll (desktop) ---- */
    const issueTrack = $('.issue__track');
    const issueBar = $('.issue__progress span');
    mm.add('(min-width: 900px)', () => {
      const dist = () => issueTrack.scrollWidth - innerWidth;
      const tween = gsap.to(issueTrack, {
        x: () => -dist(),
        ease: 'none',
        scrollTrigger: {
          trigger: '.issue',
          start: 'top top',
          end: () => '+=' + dist(),
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate: (s) => gsap.set(issueBar, { scaleX: s.progress }),
        },
      });
      $$('.card__media img', issueTrack).forEach((img) => {
        gsap.fromTo(img, { xPercent: -6 }, {
          xPercent: 6, ease: 'none',
          scrollTrigger: { trigger: img.closest('.card'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
        });
      });
    });
    mm.add('(max-width: 899px)', () => {
      const onScroll = () => {
        const max = issueTrack.scrollWidth - issueTrack.clientWidth;
        gsap.set(issueBar, { scaleX: max > 0 ? issueTrack.scrollLeft / max : 0 });
      };
      issueTrack.addEventListener('scroll', onScroll, { passive: true });
      return () => issueTrack.removeEventListener('scroll', onScroll);
    });

    /* ---- Photo essay: frame opens to full bleed ---- */
    gsap.fromTo('.feature__media', { clipPath: 'inset(12% 9% 12% 9%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
      scrollTrigger: { trigger: '.feature', start: 'top 90%', end: 'top top', scrub: true },
    });
    gsap.fromTo('.feature__media img', { scale: 1.3 }, {
      scale: 1, ease: 'none',
      scrollTrigger: { trigger: '.feature', start: 'top bottom', end: 'bottom top', scrub: true },
    });

    /* ---- Film: pinned, frame expands to fill the screen ---- */
    mm.add({ desk: '(min-width: 900px)', mob: '(max-width: 899px)' }, (ctx) => {
      const { desk } = ctx.conditions;
      const tl = gsap.timeline({
        scrollTrigger: { trigger: '.film', start: 'top top', end: '+=160%', pin: true, scrub: 1 },
      });
      tl.fromTo('.film__frame',
        { clipPath: desk ? 'inset(18% 28% 18% 28% round 14px)' : 'inset(26% 8% 26% 8% round 12px)' },
        { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'power2.inOut', duration: 1 }, 0)
        .fromTo('.film__video', { scale: 1.25 }, { scale: 1, ease: 'power2.inOut', duration: 1 }, 0)
        .fromTo('.film__word--l', { xPercent: desk ? 18 : 0, x: 0 }, { xPercent: 0, ease: 'power2.inOut', duration: 1 }, 0)
        .fromTo('.film__word--r', { xPercent: desk ? -18 : 0 }, { xPercent: 0, ease: 'power2.inOut', duration: 1 }, 0);
    });

    /* ---- The Table: floating preview follows the cursor ---- */
    if (finePointer) {
      const prev = $('.table__preview');
      const pimg = prev.querySelector('img');
      const rows = $$('.row');
      rows.forEach((r) => { const i = new Image(); i.src = r.dataset.img; }); // warm the cache
      const px = gsap.quickTo(prev, 'x', { duration: 0.7, ease: 'power3' });
      const py = gsap.quickTo(prev, 'y', { duration: 0.7, ease: 'power3' });
      const pr = gsap.quickTo(prev, 'rotation', { duration: 0.9, ease: 'power3' });
      let lastX = 0;
      addEventListener('mousemove', (e) => {
        px(e.clientX - prev.offsetWidth / 2);
        py(e.clientY - prev.offsetHeight / 2);
        pr(gsap.utils.clamp(-12, 12, (e.clientX - lastX) * 0.6));
        lastX = e.clientX;
      });
      let shown = false;
      const show = (on) => {
        if (on === shown) return;
        shown = on;
        gsap.to(prev, on
          ? { opacity: 1, scale: 1, duration: 0.5, ease: 'expo.out', overwrite: 'auto' }
          : { opacity: 0, scale: 0.85, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
      };
      onPointerSync((el) => {
        const row = el && el.closest('.row');
        if (row && pimg.getAttribute('src') !== row.dataset.img) pimg.src = row.dataset.img;
        show(!!row);
      });
    }

    /* ---- Print edition: magazine turns as you scroll ---- */
    gsap.fromTo('.mag',
      { rotateY: -22, rotateX: 8, rotateZ: -4, y: 80 },
      { rotateY: 12, rotateX: -2, rotateZ: 2, y: -40, ease: 'none',
        scrollTrigger: { trigger: '.print', start: 'top bottom', end: 'bottom top', scrub: true } });

    /* ---- Footer wordmark ---- */
    if (hasSplit) {
      const mark = SplitText.create('.footer__mark span', { type: 'chars', charsClass: 'char' });
      gsap.from(mark.chars, {
        yPercent: 100, duration: 1.4, ease: 'expo.out', stagger: 0.06,
        scrollTrigger: { trigger: '.footer__mark', start: 'top 96%', once: true },
      });
    }

    /* ---- Reading progress ---- */
    gsap.to('.progress span', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

    /* ---- Nav: hide on scroll down, light over dark sections ---- */
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        const hide = self.direction === 1 && self.scroll() > innerHeight * 0.6 && !menuOpen;
        nav.classList.toggle('is-hidden', hide);
      },
    });
    const navProbe = () => {
      const y = 36;
      const light = $$('[data-theme="dark"]').some((s) => {
        const r = s.getBoundingClientRect();
        return r.top <= y && r.bottom >= y;
      });
      nav.classList.toggle('is-light', light);
    };
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: navProbe, onRefresh: navProbe });
    navProbe();

    // Re-measure once every image has arrived (pins depend on layout)
    addEventListener('load', () => ScrollTrigger.refresh());
  }
})();
