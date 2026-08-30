import { createPrexOrder, money } from "./supabase-client.js";

const CART_KEY = "rs_cart";
const INSTAGRAM_DM_URL = "https://ig.me/m/rizos.satinados";

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
}

export function addToCart(product) {
  const cart = getCart();
  const existing = cart.find((it) => it.product_id === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      product_id: product.id,
      name: product.name,
      color: product.color,
      image_path: product.image_path,
      price: Number(product.price) || 0,
      qty: 1,
    });
  }
  saveCart(cart);
  openDrawer();
}

function removeFromCart(productId) {
  saveCart(getCart().filter((it) => it.product_id !== productId));
}

function setQty(productId, qty) {
  const cart = getCart();
  const item = cart.find((it) => it.product_id === productId);
  if (!item) return;
  item.qty = Math.max(1, qty);
  saveCart(cart);
}

function cartTotal(cart) {
  return cart.reduce((sum, it) => sum + it.price * it.qty, 0);
}

function cartCount(cart) {
  return cart.reduce((sum, it) => sum + it.qty, 0);
}

function openDrawer() {
  document.getElementById("cartDrawer")?.classList.add("open");
  document.getElementById("cartBackdrop")?.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeDrawer() {
  document.getElementById("cartDrawer")?.classList.remove("open");
  document.getElementById("cartBackdrop")?.classList.remove("open");
  document.body.style.overflow = "";
}

function renderCart() {
  const cart = getCart();
  document.querySelectorAll(".cart-count").forEach((el) => {
    el.textContent = cartCount(cart);
    el.hidden = cart.length === 0;
  });

  const itemsEl = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");
  const prexBtn = document.getElementById("cartPrexBtn");
  if (!itemsEl) return;

  if (!cart.length) {
    itemsEl.innerHTML = '<p class="account-empty">Todavía no agregaste productos.</p>';
    if (totalEl) totalEl.textContent = money(0);
    if (prexBtn) prexBtn.hidden = true;
    return;
  }

  if (prexBtn) prexBtn.hidden = false;
  itemsEl.innerHTML = cart
    .map(
      (it) => `
      <div class="cart-item" data-id="${it.product_id}">
        <img src="${it.image_path}" alt="${it.name}">
        <div class="cart-item-info">
          <p class="cart-item-name">${it.name}${it.color ? " · " + it.color : ""}</p>
          <p class="cart-item-price">${money(it.price)}</p>
          <div class="cart-item-qty">
            <button type="button" class="qty-btn qty-minus" aria-label="Restar">−</button>
            <span>${it.qty}</span>
            <button type="button" class="qty-btn qty-plus" aria-label="Sumar">+</button>
          </div>
        </div>
        <button type="button" class="cart-remove" aria-label="Quitar">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>`
    )
    .join("");

  itemsEl.querySelectorAll(".cart-item").forEach((row) => {
    const id = row.dataset.id;
    row.querySelector(".qty-plus").addEventListener("click", () => {
      const item = cart.find((it) => it.product_id === id);
      setQty(id, item.qty + 1);
    });
    row.querySelector(".qty-minus").addEventListener("click", () => {
      const item = cart.find((it) => it.product_id === id);
      if (item.qty <= 1) removeFromCart(id);
      else setQty(id, item.qty - 1);
    });
    row.querySelector(".cart-remove").addEventListener("click", () => removeFromCart(id));
  });

  if (totalEl) totalEl.textContent = money(cartTotal(cart));
}

// Abre el DM de Instagram en una pestaña nueva.
function goToInstagram() {
  window.open(INSTAGRAM_DM_URL, "_blank", "noopener");
}

// Panel de éxito post-pago: se muestra tras confirmar el pago; desde acá
// la clienta toca "Coordinar entrega" para ir a Instagram.
function openSuccess() {
  const modal = document.getElementById("successModal");
  const backdrop = document.getElementById("successBackdrop");
  if (!modal || !backdrop) return;
  modal.classList.add("open");
  backdrop.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeSuccess() {
  document.getElementById("successModal")?.classList.remove("open");
  document.getElementById("successBackdrop")?.classList.remove("open");
  document.body.style.overflow = "";
}

document.addEventListener("DOMContentLoaded", () => {
  renderCart();

  document.getElementById("cartToggle")?.addEventListener("click", openDrawer);
  document.getElementById("cartClose")?.addEventListener("click", closeDrawer);
  document.getElementById("cartBackdrop")?.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  const successModal = document.getElementById("successModal");
  const successBackdrop = document.getElementById("successBackdrop");
  if (successModal && successBackdrop) {
    document.getElementById("successClose")?.addEventListener("click", closeSuccess);
    successBackdrop.addEventListener("click", closeSuccess);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSuccess();
    });
    document.getElementById("coordinarEntregaBtn")?.addEventListener("click", goToInstagram);
  }

  // Modal de pago con Prex
  const prexModal = document.getElementById("prexModal");
  const prexBackdrop = document.getElementById("prexBackdrop");
  const prexForm = document.getElementById("prexForm");
  if (prexModal && prexBackdrop && prexForm) {
    const openPrex = () => {
      const cart = getCart();
      if (!cart.length) return;
      document.getElementById("prexTotal").textContent = money(cartTotal(cart));
      prexModal.classList.add("open");
      prexBackdrop.classList.add("open");
      document.body.style.overflow = "hidden";
    };
    const closePrex = () => {
      prexModal.classList.remove("open");
      prexBackdrop.classList.remove("open");
      document.body.style.overflow = "";
    };

    document.getElementById("cartPrexBtn")?.addEventListener("click", openPrex);
    document.getElementById("prexClose")?.addEventListener("click", closePrex);
    prexBackdrop.addEventListener("click", closePrex);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePrex();
    });

    prexForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const cart = getCart();
      if (!cart.length) return;
      const errorEl = document.getElementById("prexError");
      errorEl.hidden = true;
      const fd = new FormData(prexForm);
      const transferCode = fd.get("transfer_code");
      try {
        await createPrexOrder({
          items: cart,
          guestName: fd.get("guest_name"),
          guestEmail: fd.get("guest_email"),
          contactMethod: "instagram",
          contactValue: fd.get("contact_value"),
          transferCode,
        });
      } catch (err) {
        console.error(err);
        errorEl.textContent = "No se pudo registrar el pago. Probá de nuevo.";
        errorEl.hidden = false;
        return;
      }
      saveCart([]);
      closePrex();
      closeDrawer();
      // Solo vamos a Instagram cuando la clienta toca "Coordinar entrega"
      // en este panel, no automáticamente al confirmar el pago.
      openSuccess();
    });
  }
});
