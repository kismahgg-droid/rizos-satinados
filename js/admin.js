import {
  getSession,
  getProfile,
  adminListProducts,
  adminUpsertProduct,
  adminDeleteProduct,
  adminListOrders,
  adminUpdateOrderStatus,
  money,
  renderAuthHeader,
} from "./supabase-client.js";

const STATUSES = ["pendiente", "confirmado", "entregado", "cancelado"];
const STATUS_LABELS = { pendiente: "Pendiente", confirmado: "Confirmado", entregado: "Entregado", cancelado: "Cancelado" };
const STATUS_COLORS = { pendiente: "#E3A008", confirmado: "#2563EB", entregado: "#1A7F4B", cancelado: "#B3261E" };
const PAYMENT_LABELS = { efectivo: "Efectivo", transferencia: "Transferencia", prex: "Prex" };

let allOrders = [];
let currentOrderFilter = "todos";

function productRow(p) {
  return `
    <tr data-id="${p.id}">
      <td>${p.category === "gorrito" ? "Gorrito" : "Scrunchie"} · ${p.name}${p.color ? " (" + p.color + ")" : ""}</td>
      <td><input type="number" class="admin-input price-input" min="0" step="1" value="${p.price}"></td>
      <td><input type="number" class="admin-input stock-input" min="0" step="1" value="${p.stock}"></td>
      <td><input type="checkbox" class="active-input" ${p.active ? "checked" : ""}></td>
      <td>
        <button type="button" class="btn btn-outline btn-small save-btn">Guardar</button>
        <button type="button" class="btn btn-outline btn-small delete-btn">Borrar</button>
      </td>
    </tr>`;
}

function orderCard(o) {
  const items = (o.order_items || []).map((it) => `${it.qty} × ${it.products?.name || "Producto"}`).join(", ");
  const options = STATUSES.map(
    (s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${STATUS_LABELS[s]}</option>`
  ).join("");
  const clientName = o.profiles?.full_name || o.guest_name || "—";
  const contactBits = [];
  if (o.profiles?.phone) contactBits.push(o.profiles.phone);
  if (o.guest_email) contactBits.push(o.guest_email);
  if (o.contact_value) {
    contactBits.push(`${o.contact_method === "instagram" ? "IG" : "Tel"}: ${o.contact_value}`);
  }
  const payment = o.payment_method ? PAYMENT_LABELS[o.payment_method] || o.payment_method : "—";
  const date = new Date(o.created_at).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `
    <div class="order-card" data-id="${o.id}">
      <div class="order-card-top">
        <div class="order-card-top-left">
          <select class="order-status-select status-${o.status}">${options}</select>
          <span class="order-card-date">${date}</span>
        </div>
        <span class="order-card-total">${money(o.total)}</span>
      </div>
      <p class="order-card-client"><strong>${clientName}</strong>${!o.profiles ? '<span class="order-guest-tag">Invitada</span>' : ""}</p>
      <p class="order-card-contact">${contactBits.join(" · ") || "Sin datos de contacto"}</p>
      <p class="order-card-items">${items}</p>
      <div class="order-card-foot">
        <span class="order-card-payment"><strong>${payment}</strong>${o.transfer_code ? " · Código: " + o.transfer_code : ""}</span>
      </div>
    </div>`;
}

function renderProductsTable(products) {
  const tbody = document.getElementById("productsTableBody");
  tbody.innerHTML = products.map(productRow).join("");

  tbody.querySelectorAll("tr").forEach((row) => {
    const id = row.dataset.id;
    // Guardamos el producto original completo: el upsert manda TODOS sus
    // campos (no solo precio/stock/activo) para evitar cualquier duda con
    // columnas obligatorias en la base de datos.
    const original = products.find((p) => p.id === id);
    const saveBtn = row.querySelector(".save-btn");
    saveBtn.addEventListener("click", async () => {
      const price = Number(row.querySelector(".price-input").value) || 0;
      const stock = Number(row.querySelector(".stock-input").value) || 0;
      const active = row.querySelector(".active-input").checked;
      saveBtn.disabled = true;
      saveBtn.textContent = "Guardando…";
      const { error } = await adminUpsertProduct({
        id,
        category: original?.category,
        name: original?.name,
        color: original?.color ?? null,
        price,
        stock,
        image_path: original?.image_path,
        description: original?.description ?? null,
        active,
      });
      saveBtn.disabled = false;
      if (error) {
        console.error("Error al guardar producto:", error);
        saveBtn.textContent = "Error ⚠";
        alert(`No se pudo guardar el producto.\n\n${error.message || error}`);
        setTimeout(() => (saveBtn.textContent = "Guardar"), 2500);
        return;
      }
      saveBtn.textContent = "Guardado ✓";
      setTimeout(() => (saveBtn.textContent = "Guardar"), 1500);
      await refreshAll();
    });
    row.querySelector(".delete-btn").addEventListener("click", async () => {
      if (!confirm("¿Borrar este producto?")) return;
      const { error } = await adminDeleteProduct(id);
      if (error) {
        console.error("Error al borrar producto:", error);
        alert(`No se pudo borrar el producto.\n\n${error.message || error}`);
        return;
      }
      await refreshAll();
    });
  });
}

function orderCountByStatus(orders, status) {
  return status === "todos" ? orders.length : orders.filter((o) => o.status === status).length;
}

function renderOrdersToolbar() {
  const el = document.getElementById("ordersFilter");
  if (!el) return;
  const filters = ["todos", ...STATUSES];
  el.innerHTML = filters
    .map((f) => {
      const label = f === "todos" ? "Todos" : STATUS_LABELS[f];
      const count = orderCountByStatus(allOrders, f);
      return `<button type="button" class="orders-filter-btn ${f === currentOrderFilter ? "is-active" : ""}" data-filter="${f}">${label} <span class="count">${count}</span></button>`;
    })
    .join("");
  el.querySelectorAll(".orders-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentOrderFilter = btn.dataset.filter;
      renderOrdersToolbar();
      renderOrdersList();
    });
  });
}

function renderOrdersList() {
  const el = document.getElementById("ordersList");
  if (!el) return;
  const filtered =
    currentOrderFilter === "todos" ? allOrders : allOrders.filter((o) => o.status === currentOrderFilter);

  if (!filtered.length) {
    el.innerHTML = '<p class="account-empty">No hay pedidos en esta categoría.</p>';
    return;
  }

  el.innerHTML = filtered.map(orderCard).join("");

  el.querySelectorAll(".order-card").forEach((card) => {
    const id = card.dataset.id;
    const select = card.querySelector(".order-status-select");
    select.dataset.previousValue = select.value;
    select.addEventListener("change", async () => {
      const previousValue = select.dataset.previousValue;
      select.disabled = true;
      const { error } = await adminUpdateOrderStatus(id, select.value);
      select.disabled = false;
      if (error) {
        console.error("Error al actualizar el estado del pedido:", error);
        alert(`No se pudo actualizar el estado del pedido.\n\n${error.message || error}`);
        select.value = previousValue;
        return;
      }
      await refreshAll();
    });
  });
}

function renderOrders(orders) {
  allOrders = orders;
  renderOrdersToolbar();
  renderOrdersList();
}

// --- Estadísticas ---

function statCard(label, value) {
  return `<div class="stat-card"><p class="stat-label">${label}</p><p class="stat-value">${value}</p></div>`;
}

function renderStats(products, orders) {
  const grid = document.getElementById("statsGrid");
  if (!grid) return;
  const activeOrders = orders.filter((o) => o.status !== "cancelado");
  const totalVentas = activeOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const pendientes = orders.filter((o) => o.status === "pendiente").length;
  const sinStock = products.filter((p) => Number(p.stock) <= 0).length;
  const activos = products.filter((p) => p.active).length;

  grid.innerHTML = [
    statCard("Ventas totales", money(totalVentas)),
    statCard("Pedidos totales", orders.length),
    statCard("Pedidos pendientes", pendientes),
    statCard("Productos activos", activos),
    statCard("Productos sin stock", sinStock),
  ].join("");
}

function renderBarList(elId, rows) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!rows.length || rows.every((r) => r.value === 0)) {
    el.innerHTML = '<p class="chart-empty">Todavía no hay datos suficientes.</p>';
    return;
  }
  const max = Math.max(...rows.map((r) => r.value), 1);
  el.innerHTML = rows
    .map((r) => {
      const widthPct = r.value > 0 ? Math.max((r.value / max) * 100, 4) : 0;
      return `
        <div class="bar-row">
          <span class="bar-row-label">${r.label}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${widthPct}%; background:${r.color || "var(--plum)"}"></span></span>
          <span class="bar-row-value">${r.display}</span>
        </div>`;
    })
    .join("");
}

function salesByDay(orders) {
  const days = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, label: d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit" }), value: 0 });
  }
  const byKey = Object.fromEntries(days.map((d) => [d.key, d]));
  orders.forEach((o) => {
    if (o.status === "cancelado") return;
    const key = new Date(o.created_at).toISOString().slice(0, 10);
    if (byKey[key]) byKey[key].value += Number(o.total || 0);
  });
  return days.map((d) => ({ label: d.label, value: d.value, display: money(d.value) }));
}

function topProductsData(orders) {
  const counts = new Map();
  orders.forEach((o) => {
    if (o.status === "cancelado") return;
    (o.order_items || []).forEach((it) => {
      const name = it.products?.name || "Producto";
      counts.set(name, (counts.get(name) || 0) + Number(it.qty || 0));
    });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value, display: String(value) }));
}

function statusDistribution(orders) {
  return STATUSES.map((s) => {
    const value = orders.filter((o) => o.status === s).length;
    return { label: STATUS_LABELS[s], value, display: String(value), color: STATUS_COLORS[s] };
  });
}

function renderCharts(orders) {
  renderBarList("salesChart", salesByDay(orders));
  renderBarList("topProductsChart", topProductsData(orders));
  renderBarList("statusChart", statusDistribution(orders));
}

function wireTabs() {
  const nav = document.getElementById("adminNav");
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

async function refreshAll() {
  const [products, orders] = await Promise.all([adminListProducts(), adminListOrders()]);
  renderProductsTable(products);
  renderOrders(orders);
  renderStats(products, orders);
  renderCharts(orders);
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
  if (profile?.role !== "admin") {
    document.getElementById("adminGate").hidden = false;
    return;
  }
  document.getElementById("adminContent").hidden = false;

  await refreshAll();

  document.getElementById("newProductForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const { error } = await adminUpsertProduct({
      category: fd.get("category"),
      name: fd.get("name"),
      color: fd.get("color") || null,
      price: Number(fd.get("price")) || 0,
      stock: Number(fd.get("stock")) || 0,
      image_path: fd.get("image_path"),
      active: true,
    });
    if (error) {
      console.error("Error al agregar producto:", error);
      alert(`No se pudo agregar el producto.\n\n${error.message || error}`);
      return;
    }
    e.target.reset();
    await refreshAll();
  });
});
