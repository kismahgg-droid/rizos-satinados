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
      <div class="order-row">
        <p class="order-items">${a.products?.name || "Producto"}</p>
        <p class="account-empty">Te avisamos apenas vuelva el stock.</p>
      </div>`
    )
    .join("");
}

document.addEventListener("DOMContentLoaded", async () => {
  renderAuthHeader();

  const session = await getSession();
  if (!session) {
    window.location.href = "cuenta.html";
    return;
  }

  const profile = await getProfile(session.user.id);
  document.getElementById("greeting").textContent = profile?.full_name
    ? `Hola, ${profile.full_name.split(" ")[0]}`
    : "Hola";

  const [orders, favorites, alerts] = await Promise.all([
    getMyOrders(session.user.id),
    getMyFavoriteProducts(session.user.id),
    getMyStockAlerts(session.user.id),
  ]);
  renderOrders(orders);
  renderFavorites(favorites);
  renderAlerts(alerts);

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut();
    window.location.href = "index.html";
  });
});
