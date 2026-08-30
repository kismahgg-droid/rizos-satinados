import {
  supabase,
  getSession,
  getActiveProducts,
  getFavorites,
  toggleFavorite,
  requestStockAlert,
  getVisibleTestimonials,
  money,
  renderAuthHeader,
} from "./supabase-client.js";
import { addToCart } from "./cart.js";

const CATEGORY_LABELS = { gorrito: "Gorro de satén", scrunchie: "Scrunchie de satén" };

function productAlt(product) {
  const base = CATEGORY_LABELS[product.category] || product.name;
  return product.color ? `${base} color ${product.color}` : `${base} ${product.name}`;
}

function cardHTML(product, isFavorite) {
  const stock = Number(product.stock) || 0;
  const outOfStock = stock <= 0;
  const priceLine =
    Number(product.price) > 0
      ? `<p class="price">${money(product.price)}</p>`
      : `<p class="price price-tbd">Consultar precio</p>`;

  const stockLine = outOfStock
    ? `<p class="stock-line stock-out">Sin stock</p>`
    : `<p class="stock-line stock-in">${stock} disponible${stock === 1 ? "" : "s"}</p>`;

  const favButtonHTML = `
    <button type="button" class="fav-btn ${isFavorite ? "is-fav" : ""}" data-product-id="${product.id}" aria-label="Marcar como favorito">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="${isFavorite ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-10-9.3C.5 7.8 2.3 4.5 5.7 4c2-.3 3.9.6 5 2.2C11.8 4.6 13.7 3.7 15.7 4c3.4.5 5.2 3.8 3.7 7.2-2.5 4.7-10 9.3-10 9.3Z"/></svg>
    </button>`;

  const secondaryActionHTML = outOfStock
    ? `<button type="button" class="alert-btn" data-product-id="${product.id}">Avisarme cuando haya stock</button>`
    : `<button type="button" class="cart-add-btn" data-product-id="${product.id}" aria-label="Agregar al carrito">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.5 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 8H6"/></svg>
        <span>Agregar</span>
      </button>`;

  return `
    <figure class="product-card ${outOfStock ? "out-of-stock" : ""} reveal in-view" id="product-${product.id}" data-product-id="${product.id}">
      <div class="product-img">
        ${outOfStock ? '<span class="out-badge">Sin stock</span>' : ""}
        <img src="${product.image_path}" alt="${productAlt(product)}" loading="lazy">
      </div>
      <figcaption>
        <h3>${product.name}</h3>
        ${priceLine}
        ${stockLine}
        <div class="card-actions-row">
          ${favButtonHTML}
          ${secondaryActionHTML}
        </div>
      </figcaption>
    </figure>`;
}

async function renderProducts() {
  const gorritosGrid = document.getElementById("gorritosGrid");
  const scrunchiesGrid = document.getElementById("scrunchiesGrid");
  if (!gorritosGrid && !scrunchiesGrid) return;

  const [session, products] = await Promise.all([getSession(), getActiveProducts()]);
  const favIds = session ? await getFavorites(session.user.id) : [];

  const gorritos = products.filter((p) => p.category === "gorrito");
  const scrunchies = products.filter((p) => p.category === "scrunchie");

  if (gorritosGrid) gorritosGrid.innerHTML = gorritos.map((p) => cardHTML(p, favIds.includes(p.id))).join("");
  if (scrunchiesGrid) scrunchiesGrid.innerHTML = scrunchies.map((p) => cardHTML(p, favIds.includes(p.id))).join("");

  wireFavButtons(session);
  wireAlertButtons(session);
  wireCartButtons(products);
  scrollToHashProduct();
}

// Si llegamos desde "Mi cuenta" (favoritos/avisos) con un link tipo
// index.html#product-<id>, el navegador intenta saltar al ancla antes de
// que las tarjetas terminen de renderizarse (llegan async de Supabase).
// Por eso lo hacemos a mano acá, una vez que ya están en el DOM.
function scrollToHashProduct() {
  const hash = window.location.hash;
  if (!hash.startsWith("#product-")) return;
  const el = document.querySelector(hash);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("highlight");
  setTimeout(() => el.classList.remove("highlight"), 2200);
}

function wireFavButtons(session) {
  document.querySelectorAll(".fav-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!session) {
        window.location.href = "account.html";
        return;
      }
      const productId = btn.dataset.productId;
      const isFav = btn.classList.contains("is-fav");
      btn.classList.toggle("is-fav");
      btn.querySelector("svg").setAttribute("fill", isFav ? "none" : "currentColor");
      await toggleFavorite(session.user.id, productId, isFav);
    });
  });
}

function wireAlertButtons(session) {
  document.querySelectorAll(".alert-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!session) {
        window.location.href = "account.html";
        return;
      }
      await requestStockAlert(session.user.id, btn.dataset.productId);
      btn.textContent = "Te vamos a avisar ✓";
      btn.disabled = true;
    });
  });
}

function wireCartButtons(products) {
  document.querySelectorAll(".cart-add-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const product = products.find((p) => p.id === btn.dataset.productId);
      if (!product) return;
      addToCart(product);
      btn.classList.add("just-added");
      setTimeout(() => btn.classList.remove("just-added"), 700);
    });
  });
}

async function renderTestimonials() {
  const section = document.getElementById("testimonialsSection");
  const track = document.getElementById("testimonialsTrack");
  if (!section || !track) return;
  const testimonials = await getVisibleTestimonials();
  if (!testimonials.length) return;
  track.innerHTML = testimonials
    .map(
      (t) => `
      <blockquote class="testimonial-card">
        <p>&ldquo;${t.quote}&rdquo;</p>
        <cite>— ${t.author_name}</cite>
      </blockquote>`
    )
    .join("");
  section.hidden = false;
}

document.addEventListener("DOMContentLoaded", () => {
  renderAuthHeader();
  renderProducts();
  renderTestimonials();

  supabase.auth.onAuthStateChange(() => {
    renderAuthHeader();
    renderProducts();
  });
});
