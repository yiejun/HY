/* Newton Smart Gardening — scroll-linked motion
 *
 * Every element with [data-scroll] gets a CSS variable --p (0 → 1) that follows
 * the scroll position. CSS turns that number into movement, so the animation
 * plays forward when you scroll down and rewinds when you scroll up.
 *
 * Modes (data-scroll="…"):
 *   view    0 when the element's top touches the bottom of the screen,
 *           1 when its bottom leaves the top of the screen
 *   enter   0 when the top reaches data-start (fraction of screen height, default 1),
 *           1 when it reaches data-end (default 0.35)
 *   through 0 when the top crosses the middle of the screen, 1 when the bottom does
 *   focus   1 while the element is centred on screen, falling to 0 half a screen away
 *   pin     progress through a tall section whose child is position: sticky
 *   exit    0 while the top is below the screen top, 1 once the whole element has scrolled past
 *
 * Optional: data-range="a,b" remaps p into --pe with an ease-in-out curve.
 */
(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) root.classList.add("rm");
  root.classList.add("js");

  const nav = document.querySelector(".site-nav");
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------- word-by-word text reveal ---------- */
  document.querySelectorAll("[data-words]").forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute("aria-label", el.textContent.trim());
    el.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true" style="--i:${i}">${w}</span>`).join(" ");
    el.style.setProperty("--n", words.length);
  });

  /* ---------- counters ---------- */
  const counters = [...document.querySelectorAll("[data-count]")].map((el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = (el.dataset.count.split(".")[1] || "").length;
    return { el, target, decimals, prefix: el.dataset.prefix || "", suffix: el.dataset.suffix || "", last: null };
  });

  /* ---------- horizontal pinned tracks ---------- */
  const hscrolls = [...document.querySelectorAll("[data-hscroll]")];
  function sizeHScroll() {
    hscrolls.forEach((sec) => {
      const track = sec.querySelector(".h-track");
      if (!track) return;
      if (reduce || window.innerWidth < 760) {
        sec.style.height = "";
        sec.style.removeProperty("--dist");
        return;
      }
      const dist = Math.max(0, track.scrollWidth - track.clientWidth);
      sec.style.setProperty("--dist", dist);
      sec.style.height = `${window.innerHeight + dist}px`;
    });
  }

  /* ---------- hero arch: start just below the headline ---------- */
  const hero = document.querySelector(".hero");
  function sizeHero() {
    if (!hero) return;
    const text = hero.querySelector(".hero-text");
    const vh = window.innerHeight;
    const bottom = text.offsetTop + text.offsetHeight + 36;
    hero.style.setProperty("--t0", `${clamp(bottom, vh * 0.42, vh * 0.74)}px`);
  }

  /* ---------- the engine ---------- */
  const items = [...document.querySelectorAll("[data-scroll]")].map((el) => ({
    el,
    mode: el.dataset.scroll,
    start: parseFloat(el.dataset.start ?? 1),
    end: parseFloat(el.dataset.end ?? 0.35),
    range: el.dataset.range ? el.dataset.range.split(",").map(Number) : null,
    last: -1,
  }));

  const pageBar = document.querySelector(".progress");
  const techScroller = document.querySelector(".tech-scroller");
  const techItems = techScroller ? [...techScroller.querySelectorAll(".tech-item")] : [];
  let activeTech = -1;

  function progress(item, vh) {
    const r = item.el.getBoundingClientRect();
    switch (item.mode) {
      case "view":
        return clamp((vh - r.top) / (vh + r.height));
      case "enter":
        return clamp((vh * item.start - r.top) / (vh * (item.start - item.end)));
      case "through":
        return clamp((vh / 2 - r.top) / r.height);
      case "focus": {
        const c = r.top + r.height / 2;
        return clamp(1 - Math.abs(c - vh / 2) / (vh * 0.55));
      }
      case "pin":
        return clamp(-r.top / Math.max(1, r.height - vh));
      case "stack": {
        const next = item.el.nextElementSibling;
        if (!next) return 0;
        const d = next.getBoundingClientRect().top - r.top;
        return clamp(1 - d / (vh * 0.85));
      }
      case "exit":
        return clamp(-r.top / Math.max(1, r.height));
      default:
        return 0;
    }
  }

  function update() {
    const vh = window.innerHeight;

    for (const item of items) {
      const p = progress(item, vh);
      if (Math.abs(p - item.last) < 0.0005) continue;
      item.last = p;
      item.el.style.setProperty("--p", p.toFixed(4));
      if (item.range) {
        const [a, b] = item.range;
        item.el.style.setProperty("--pe", ease(clamp((p - a) / (b - a))).toFixed(4));
      }
    }

    for (const c of counters) {
      const host = c.el.closest("[data-scroll]");
      const p = host ? parseFloat(host.style.getPropertyValue("--p") || 0) : 1;
      const v = (c.target * ease(clamp(p * 1.15))).toFixed(c.decimals);
      if (v !== c.last) {
        c.last = v;
        c.el.textContent = c.prefix + v + c.suffix;
      }
    }

    if (pageBar) {
      const max = document.documentElement.scrollHeight - vh;
      pageBar.style.transform = `scaleX(${max > 0 ? clamp(window.scrollY / max) : 0})`;
    }

    if (techItems.length) {
      let best = 0;
      let bestD = Infinity;
      techItems.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - vh / 2);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best !== activeTech) {
        activeTech = best;
        techScroller.style.setProperty("--active", best);
        techScroller.querySelectorAll(".dial-icon").forEach((ic, i) => ic.classList.toggle("is-on", i === best));
        const label = techScroller.querySelector(".dial-name");
        if (label) label.textContent = techItems[best].querySelector("h2").textContent;
      }
    }

    nav && nav.classList.toggle("is-scrolled", window.scrollY > 10);
  }

  /* ---------- smooth scrolling (Lenis) ---------- */
  let lenis = null;
  if (!reduce && window.Lenis && window.matchMedia("(pointer: fine)").matches) {
    lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true });
    const raf = (t) => {
      lenis.raf(t);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
    lenis.on("scroll", update);
  }

  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (lenis || ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    },
    { passive: true }
  );

  function relayout() {
    sizeHScroll();
    sizeHero();
    items.forEach((i) => (i.last = -1));
    update();
  }
  window.addEventListener("resize", relayout);
  window.addEventListener("load", relayout);
  relayout();

  /* ---------- mobile menu ---------- */
  const toggle = document.querySelector(".nav-toggle");
  if (toggle && nav) {
    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      document.body.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      if (lenis) open ? lenis.stop() : lenis.start();
    };
    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
    document.addEventListener("keydown", (e) => e.key === "Escape" && setOpen(false));
  }

  /* ---------- gallery lightbox ---------- */
  const dialog = document.querySelector(".lightbox");
  if (dialog) {
    const img = dialog.querySelector("img");
    const cap = dialog.querySelector("p");
    document.querySelectorAll("[data-lightbox]").forEach((btn) => {
      btn.addEventListener("click", () => {
        img.src = btn.dataset.lightbox;
        img.alt = btn.dataset.caption;
        cap.textContent = btn.dataset.caption;
        dialog.showModal();
        if (lenis) lenis.stop();
      });
    });
    dialog.addEventListener("close", () => lenis && lenis.start());
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog || e.target.closest(".lightbox-close")) dialog.close();
    });
  }
})();
