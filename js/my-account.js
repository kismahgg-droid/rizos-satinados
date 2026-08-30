import {
  getSession,
  getProfile,
  getMyOrders,
  getMyFavoriteProducts,
  getMyStockAlerts,
  signOut,
  updateProfile,
  updateEmail,
  updatePassword,
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

function showFeedback(errorEl, successEl, message, isError) {
  errorEl.hidden = !isError;
  successEl.hidden = isError;
  (isError ? errorEl : successEl).textContent = message;
}

function wireAccountForms(session, profile) {
  const profileForm = document.getElementById("profileForm");
  if (profileForm) {
    profileForm.full_name.value = profile?.full_name || "";
    profileForm.phone.value = profile?.phone || "";
    const errorEl = document.getElementById("profileError");
    const successEl = document.getElementById("profileSuccess");
    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      successEl.hidden = true;
      const { error } = await updateProfile(session.user.id, {
        fullName: profileForm.full_name.value.trim(),
        phone: profileForm.phone.value.trim(),
      });
      if (error) {
        console.error("Error al guardar los datos:", error);
        showFeedback(errorEl, successEl, "No se pudieron guardar los datos. Probá de nuevo.", true);
        return;
      }
      showFeedback(errorEl, successEl, "Datos guardados ✓", false);
    });
  }

  const emailForm = document.getElementById("emailForm");
  if (emailForm) {
    emailForm.email.value = session.user.email || "";
    const errorEl = document.getElementById("emailError");
    const successEl = document.getElementById("emailSuccess");
    emailForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      successEl.hidden = true;
      const { error } = await updateEmail(emailForm.email.value.trim());
      if (error) {
        console.error("Error al cambiar el email:", error);
        showFeedback(errorEl, successEl, error.message || "No se pudo cambiar el email. Probá de nuevo.", true);
        return;
      }
      showFeedback(errorEl, successEl, "Te enviamos un correo a tu email nuevo para confirmar el cambio.", false);
    });
  }

  const passwordForm = document.getElementById("passwordForm");
  if (passwordForm) {
    const errorEl = document.getElementById("passwordError");
    const successEl = document.getElementById("passwordSuccess");
    passwordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      successEl.hidden = true;
      if (passwordForm.password.value !== passwordForm.password_confirm.value) {
        showFeedback(errorEl, successEl, "Las contraseñas no coinciden.", true);
        return;
      }
      const { error } = await updatePassword(passwordForm.password.value);
      if (error) {
        console.error("Error al cambiar la contraseña:", error);
        showFeedback(errorEl, successEl, error.message || "No se pudo cambiar la contraseña. Probá de nuevo.", true);
        return;
      }
      passwordForm.reset();
      showFeedback(errorEl, successEl, "Contraseña actualizada ✓", false);
    });
  }
}

// Reemplazo del confirm() nativo del navegador por un modal propio.
// Devuelve una promesa que resuelve true/false según lo que elija la clienta.
function showConfirm({ title = "¿Estás segura?", message = "", confirmText = "Confirmar", danger = false } = {}) {
  const modal = document.getElementById("confirmModal");
  const backdrop = document.getElementById("confirmBackdrop");
  if (!modal || !backdrop) return Promise.resolve(window.confirm(message || title));

  return new Promise((resolve) => {
    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmMessage").textContent = message;
    const okBtn = document.getElementById("confirmOkBtn");
    const cancelBtn = document.getElementById("confirmCancelBtn");
    okBtn.textContent = confirmText;
    okBtn.classList.toggle("btn-danger", danger);

    const close = (result) => {
      modal.classList.remove("open");
      backdrop.classList.remove("open");
      document.body.style.overflow = "";
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      backdrop.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onKeydown);
      resolve(result);
    };
    const onOk = () => close(true);
    const onCancel = () => close(false);
    const onKeydown = (e) => {
      if (e.key === "Escape") close(false);
    };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    backdrop.addEventListener("click", onCancel);
    document.addEventListener("keydown", onKeydown);

    modal.classList.add("open");
    backdrop.classList.add("open");
    document.body.style.overflow = "hidden";
  });
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

  wireAccountForms(session, profile);

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
    const ok = await showConfirm({
      title: "¿Cerrar sesión?",
      message: "Vas a tener que volver a iniciar sesión para ver tu cuenta.",
      confirmText: "Cerrar sesión",
      danger: true,
    });
    if (!ok) return;
    await signOut();
    window.location.href = "index.html";
  });
});
