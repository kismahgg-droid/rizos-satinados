import {
  getSession,
  getProfile,
  getMyOrders,
  getMyFavoriteProducts,
  getMyStockAlerts,
  signOut,
  money,
  renderAuthHeader,
} from "./supabase-client.js";

const STATUS_LABELS = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function renderOrders(orders) {
  const el = document.getElementById("ordersList");
  if (!orders.length) return;
  el.innerHTML = orders
    .map((o) => {
      const items = (o.order_items || [])
        .map((it) => `${it.qty} × ${it.products?.name || "Producto"}`)
        .join(", ");
      return `
        <div class="order-row">
          <div class="order-row-main">
            <span class="order-status status-${o.status}">${STATUS_LABELS[o.status] || o.status}</span>
            <span class="order-date">${formatDate(o.created_at)}</span>
          </div>
          <p class="order-items">${items}</p>
          <p class="order-total">${money(o.total)}</p>
        </div>`;
    })
    .join("");
}

function renderFavorites(products) {
  const el = document.getElementById("favoritesList");
  if (!products.length) return;
  el.innerHTML = products
    .map(
      (p) => `
      <div class="mini-card">
        <img src="${p.image_path}" alt="${p.name}" loading="lazy">
        <span>${p.name}</span>
        <a class="btn btn-outline btn-small" href="index.html#product-${p.id}">Ver producto</a>
      </div>`
    )
    .join("");
}

function renderAlerts(alerts) {
  const el = document.getElementById("alertsList");
  const pending = alerts.filter((a) => !a.notified);
  if (!pending.length) return;
  el.innerHTML = pending
    .map(
      (a) => `
      <div class="mini-card">
        <img src="${a.products?.image_path}" alt="${a.products?.name || "Producto"}" loading="lazy">
        <span>${a.products?.name || "Producto"}</span>
        <p class="mini-card-note">Te avisamos cuando haya stock.</p>
        <a class="btn btn-outline btn-small" href="index.html#product-${a.product_id}">Ver producto</a>
      </div>`
    )
    .join("");
}

const PAYMENT_LABELS = { efectivo: "Efectivo", transferencia: "Transferencia", prex: "Prex" };

function renderPayments(orders) {
  const el = document.getElementById("paymentsList");
  if (!orders.length) return;
  el.innerHTML = orders
    .map(
      (o) => `
      <div class="order-row">
        <div class="order-row-main">
          <span class="order-status status-${o.status}">${STATUS_LABELS[o.status] || o.status}</span>
          <span class="order-date">${formatDate(o.created_at)}</span>
        </div>
        <p class="order-items">${o.payment_method ? PAYMENT_LABELS[o.payment_method] || o.payment_method : "Medio de pago a coordinar"}</p>
        <p class="order-total">${money(o.total)}</p>
      </div>`
    )
    .join("");
}

function wireTabs() {
  const nav = document.getElementById("accountNav");
  if (!nav) return;
  nav.querySelectorAll(".account-nav-item[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      nav.querySelectorAll(".account-nav-item[data-tab]").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      document.querySelectorAll(".account-panel").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.panel === btn.dataset.tab);
      });
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  renderAuthHeader();
  wireTabs();

  const session = await getSession();
  if (!session) {
    window.location.href = "account.html";
    return;
  }

  const profile = await getProfile(session.user.id);
  document.getElementById("greeting").textContent = profile?.full_name
    ? `Hola, ${profile.full_name.split(" ")[0]}`
    : "Hola";

  if (profile?.role === "admin") {
    document.getElementById("adminNavLink").hidden = false;
  }

  const [orders, favorites, alerts] = await Promise.all([
    getMyOrders(session.user.id),
    getMyFavoriteProducts(session.user.id),
    getMyStockAlerts(session.user.id),
  ]);
  renderOrders(orders);
  renderFavorites(favorites);
  renderPayments(orders);
  renderAlerts(alerts);

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    if (!confirm("¿Seguro que querés cerrar sesión?")) return;
    await signOut();
    window.location.href = "index.html";
  });
});
