import { getSession, createOrderWithItems, money } from "./supabase-client.js";

const CART_KEY = "rs_cart";

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

function checkoutMessage(cart) {
  const lines = cart.map((it) => `- ${it.qty} × ${it.name}${it.color ? " (" + it.color + ")" : ""}`);
  return `Hola, quiero hacer este pedido:\n${lines.join("\n")}\nTotal aproximado: ${money(cartTotal(cart))}`;
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
  const checkoutBtn = document.getElementById("cartCheckoutBtn");
  if (!itemsEl) return;

  if (!cart.length) {
    itemsEl.innerHTML = '<p class="account-empty">Todavía no agregaste productos.</p>';
    if (totalEl) totalEl.textContent = money(0);
    if (checkoutBtn) checkoutBtn.hidden = true;
    return;
  }

  if (checkoutBtn) checkoutBtn.hidden = false;
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
  if (checkoutBtn) checkoutBtn.dataset.msg = checkoutMessage(cart);
}

document.addEventListener("DOMContentLoaded", () => {
  renderCart();

  document.getElementById("cartToggle")?.addEventListener("click", openDrawer);
  document.getElementById("cartClose")?.addEventListener("click", closeDrawer);
  document.getElementById("cartBackdrop")?.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  document.getElementById("cartCheckoutBtn")?.addEventListener("click", async () => {
    const cart = getCart();
    if (!cart.length) return;
    const session = await getSession();
    if (session) {
      try {
        await createOrderWithItems(
          session.user.id,
          cart.map((it) => ({ product_id: it.product_id, qty: it.qty, unit_price: it.price }))
        );
      } catch (err) {
        console.error("No se pudo registrar el pedido", err);
      }
    }
    saveCart([]);
    closeDrawer();
  });
});
