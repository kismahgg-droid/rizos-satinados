const WHATSAPP_NUMBER = "59892796323";
const INSTAGRAM_DM_URL = "https://ig.me/m/rizos.satinados";

document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  document.querySelectorAll(".js-whatsapp").forEach((link) => {
    const msg = link.dataset.msg || "¡Hola! Quiero hacer una consulta ✨";
    link.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener");
  });

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

  const contactMenu = document.getElementById("contactMenu");
  const contactBackdrop = document.getElementById("contactBackdrop");
  const contactMenuClose = document.getElementById("contactMenuClose");
  if (contactMenu && contactBackdrop) {
    const waItem = document.getElementById("contactMenuWhatsapp");
    const igItem = document.getElementById("contactMenuInstagram");
    let activeTrigger = null;

    const closeMenu = () => {
      contactMenu.classList.remove("open");
      contactBackdrop.classList.remove("open");
      document.body.style.overflow = "";
      if (activeTrigger) {
        activeTrigger.setAttribute("aria-expanded", "false");
        activeTrigger = null;
      }
    };

    const openMenu = (trigger) => {
      const msg = trigger.dataset.msg || "Hola, quiero hacer una consulta sobre sus productos.";
      if (waItem) waItem.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
      if (igItem) igItem.href = INSTAGRAM_DM_URL;

      activeTrigger = trigger;
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-expanded", "true");
      contactMenu.classList.add("open");
      contactBackdrop.classList.add("open");
      document.body.style.overflow = "hidden";
    };

    // Delegación de eventos: así también funciona con las tarjetas de producto
    // que se agregan dinámicamente después de esta carga inicial.
    document.addEventListener("click", (e) => {
      const trigger = e.target.closest(".js-contact");
      if (!trigger) return;
      e.preventDefault();
      openMenu(trigger);
    });

    [waItem, igItem].forEach((item) => {
      if (item) item.addEventListener("click", closeMenu);
    });
    if (contactMenuClose) contactMenuClose.addEventListener("click", closeMenu);
    contactBackdrop.addEventListener("click", closeMenu);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
  }

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
