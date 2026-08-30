document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const navToggle = document.getElementById("navToggle");
  const mainNav = document.getElementById("main-nav");
  if (navToggle && mainNav) {
    navToggle.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("open");
      navToggle.classList.toggle("open", isOpen);
      navToggle.setAttribute("aria-expanded", String(isOpen));
      navToggle.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
    });

    mainNav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        mainNav.classList.remove("open");
        navToggle.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Fundido suave al navegar entre páginas del sitio (en vez de un salto seco).
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll('a[href$=".html"], a[href*=".html#"]').forEach((link) => {
    if (link.target === "_blank" || link.hasAttribute("download")) return;
    link.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (link.pathname === window.location.pathname) {
        // Ancla dentro de la misma página (ej. "Beneficios"): dejar el scroll suave nativo.
        if (link.hash) return;
        // Mismo link sin ancla estando ya en esa página: no hacer nada.
        e.preventDefault();
        return;
      }
      if (prefersReducedMotion) return;
      e.preventDefault();
      document.body.classList.add("page-leaving");
      setTimeout(() => {
        window.location.href = link.href;
      }, 180);
    });
  });

  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in-view"));
  }
});
