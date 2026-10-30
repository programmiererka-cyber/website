/* =========================================================
   ADRJINOS DEVELOPER PORTAL — Interactions
   ========================================================= */
(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const visible = () => document.visibilityState === "visible";

  /* ---------------- Mobile Navigation ---------------- */
  const toggle = document.getElementById("menuToggle");
  const mobileNav = document.getElementById("mobileNav");

  if (toggle && mobileNav) {
    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
      mobileNav.classList.toggle("open", open);
    };

    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setOpen(false));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setOpen(false);
    });
  }

  /* ---------------- Copy to Clipboard ---------------- */
  const toast = document.getElementById("toast");
  let toastTimer;

  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2000);
  };

  const legacyCopy = (value) => {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "-1000px";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (error) {
      ok = false;
    }
    document.body.removeChild(field);
    return ok;
  };

  const copyText = async (value) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        showToast("Kopiert — " + value.replace(/^https?:\/\//, ""));
        return;
      }
    } catch (error) {
      /* fall through to legacy copy */
    }
    if (legacyCopy(value)) {
      showToast("Kopiert — " + value.replace(/^https?:\/\//, ""));
    } else {
      showToast("Kopieren nicht möglich");
    }
  };

  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", () => copyText(button.dataset.copy));
  });

  /* ---------------- Scroll Progress ---------------- */
  const progressBar = document.getElementById("scrollProgress");
  let progressQueued = false;

  const updateProgress = () => {
    progressQueued = false;
    if (!progressBar) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    progressBar.style.transform = "scaleX(" + ratio.toFixed(4) + ")";
  };

  const queueProgress = () => {
    if (progressQueued) return;
    progressQueued = true;
    requestAnimationFrame(updateProgress);
  };

  window.addEventListener("scroll", queueProgress, { passive: true });
  window.addEventListener("resize", queueProgress);
  updateProgress();

  /* ---------------- Reveal + Counters ---------------- */
  const counters = Array.from(document.querySelectorAll("[data-count]"));
  const progressPanel = document.querySelector(".progress-panel");

  const fmt = (value) => value.toLocaleString("de-DE");

  const runCounter = (el) => {
    if (el.dataset.done === "1") return;
    el.dataset.done = "1";
    const target = Number(el.dataset.count) || 0;
    const suffix = el.dataset.suffix || "";

    if (!visible() || reduceMotion) {
      el.textContent = fmt(target) + suffix;
      return;
    }

    const duration = 1500;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.round(target * eased)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const revealItems = document.querySelectorAll(".reveal");
  const revealAll = () => {
    revealItems.forEach((item) => item.classList.add("visible"));
    if (progressPanel) progressPanel.classList.add("visible", "animate");
    counters.forEach(runCounter);
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("visible");
          if (entry.target === progressPanel) entry.target.classList.add("animate");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -40px 0px" }
    );

    revealItems.forEach((item) => observer.observe(item));
    if (progressPanel) observer.observe(progressPanel);

    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          runCounter(entry.target);
          counterObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.4 }
    );
    counters.forEach((el) => counterObserver.observe(el));

    /* Failsafe: Tabs ohne Render-Frames lösen den Observer nie aus —
       dann darf kein Inhalt unsichtbar bleiben. */
    setTimeout(() => {
      if (!visible()) revealAll();
    }, 1200);
  } else {
    revealAll();
  }

  /* ---------------- Active Section Navigation ---------------- */
  const navLinks = Array.from(document.querySelectorAll("[data-nav]"));
  const sections = navLinks
    .map((link) => document.getElementById(link.dataset.nav))
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          navLinks.forEach((link) => {
            link.classList.toggle("is-active", link.dataset.nav === entry.target.id);
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach((section) => navObserver.observe(section));
  }

  /* ---------------- Cursor Glow ---------------- */
  const glow = document.getElementById("cursorGlow");

  if (glow && finePointer && !reduceMotion) {
    let glowX = 0;
    let glowY = 0;
    let glowQueued = false;

    const paintGlow = () => {
      glowQueued = false;
      glow.style.transform = "translate3d(" + glowX + "px," + glowY + "px,0)";
    };

    window.addEventListener(
      "pointermove",
      (event) => {
        glowX = event.clientX;
        glowY = event.clientY;
        if (!glow.classList.contains("active")) glow.classList.add("active");
        if (!glowQueued) {
          glowQueued = true;
          requestAnimationFrame(paintGlow);
        }
      },
      { passive: true }
    );

    document.addEventListener("mouseleave", () => glow.classList.remove("active"));
  }

  /* ---------------- Tilt + Spotlight Cards ---------------- */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll(".tilt").forEach((card) => {
      let frame = 0;

      card.addEventListener("pointermove", (event) => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          const rect = card.getBoundingClientRect();
          const px = (event.clientX - rect.left) / rect.width;
          const py = (event.clientY - rect.top) / rect.height;

          card.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
          card.style.setProperty("--my", (py * 100).toFixed(1) + "%");

          const strength = rect.width > 420 ? 3.6 : 6;
          const rotateY = (px - 0.5) * strength * 2;
          const rotateX = (0.5 - py) * strength * 2;
          card.style.transform =
            "perspective(900px) rotateX(" + rotateX.toFixed(2) + "deg) rotateY(" + rotateY.toFixed(2) + "deg) translateY(-3px)";
        });
      });

      card.addEventListener("pointerleave", () => {
        card.style.transform = "";
      });
    });
  }

  /* ---------------- Live Values ---------------- */
  const latencyEl = document.getElementById("latency");
  const orbLatencyEl = document.getElementById("orbLatency");
  const requestsEl = document.querySelector('.status-value [data-count="1284397"]');
  const checkEl = document.getElementById("lastCheck");
  const updatedEl = document.getElementById("updatedAt");
  const yearEl = document.getElementById("year");

  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  if (latencyEl || orbLatencyEl) {
    setInterval(() => {
      const value = 118 + Math.floor(Math.random() * 34);
      if (latencyEl) latencyEl.textContent = String(value);
      if (orbLatencyEl) orbLatencyEl.textContent = String(value);
    }, 4200);
  }

  if (requestsEl) {
    setInterval(() => {
      if (requestsEl.dataset.done !== "1") return;
      const raw = Number(requestsEl.dataset.count) || 0;
      const next = raw + 40 + Math.floor(Math.random() * 320);
      requestsEl.dataset.count = String(next);
      requestsEl.textContent = fmt(next);
    }, 3200);
  }

  if (checkEl) {
    let seconds = 12;
    setInterval(() => {
      seconds = seconds >= 58 ? 0 : seconds + 15;
      checkEl.textContent = seconds < 5 ? "gerade jetzt" : "vor " + seconds + " s";
    }, 15000);
  }

  if (updatedEl) {
    setInterval(() => {
      const stamp = new Date().toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      });
      updatedEl.textContent = stamp + " Uhr";
    }, 30000);
  }
})();
