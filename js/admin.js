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
const PAYMENT_LABELS = { efectivo: "Efectivo", transferencia: "Transferencia", prex: "Prex" };

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

function orderRow(o) {
  const items = (o.order_items || []).map((it) => `${it.qty} × ${it.products?.name || "Producto"}`).join(", ");
  const options = STATUSES.map(
    (s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`
  ).join("");
  const clientName = o.profiles?.full_name || o.guest_name || "—";
  const contactBits = [];
  if (o.profiles?.phone) contactBits.push(o.profiles.phone);
  if (o.guest_email) contactBits.push(o.guest_email);
  if (o.contact_value) {
    contactBits.push(`${o.contact_method === "instagram" ? "IG" : "Tel"}: ${o.contact_value}`);
  }
  const payment = o.payment_method ? PAYMENT_LABELS[o.payment_method] || o.payment_method : "—";
  return `
    <tr data-id="${o.id}">
      <td>${new Date(o.created_at).toLocaleDateString("es-UY")}</td>
      <td>${clientName}${!o.profiles ? " (invitada)" : ""}</td>
      <td>${contactBits.join(" · ") || "—"}</td>
      <td>${items}</td>
      <td>${money(o.total)}</td>
      <td>${payment}</td>
      <td>${o.transfer_code || "—"}</td>
      <td><select class="admin-input status-select">${options}</select></td>
    </tr>`;
}

async function loadProducts() {
  const products = await adminListProducts();
  const tbody = document.getElementById("productsTableBody");
  tbody.innerHTML = products.map(productRow).join("");

  tbody.querySelectorAll("tr").forEach((row) => {
    const id = row.dataset.id;
    row.querySelector(".save-btn").addEventListener("click", async () => {
      const price = Number(row.querySelector(".price-input").value) || 0;
      const stock = Number(row.querySelector(".stock-input").value) || 0;
      const active = row.querySelector(".active-input").checked;
      await adminUpsertProduct({ id, price, stock, active });
      row.querySelector(".save-btn").textContent = "Guardado ✓";
      setTimeout(() => (row.querySelector(".save-btn").textContent = "Guardar"), 1500);
    });
    row.querySelector(".delete-btn").addEventListener("click", async () => {
      if (!confirm("¿Borrar este producto?")) return;
      await adminDeleteProduct(id);
      row.remove();
    });
  });
}

async function loadOrders() {
  const orders = await adminListOrders();
  const tbody = document.getElementById("ordersTableBody");
  tbody.innerHTML = orders.map(orderRow).join("");

  tbody.querySelectorAll("tr").forEach((row) => {
    const id = row.dataset.id;
    row.querySelector(".status-select").addEventListener("change", async (e) => {
      await adminUpdateOrderStatus(id, e.target.value);
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  renderAuthHeader();

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

  await Promise.all([loadProducts(), loadOrders()]);

  document.getElementById("newProductForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await adminUpsertProduct({
      category: fd.get("category"),
      name: fd.get("name"),
      color: fd.get("color") || null,
      price: Number(fd.get("price")) || 0,
      stock: Number(fd.get("stock")) || 0,
      image_path: fd.get("image_path"),
      active: true,
    });
    e.target.reset();
    await loadProducts();
  });
});
