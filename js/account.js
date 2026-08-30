import { signIn, signUp, signInWithProvider, getSession, renderAuthHeader } from "./supabase-client.js";

document.addEventListener("DOMContentLoaded", async () => {
  renderAuthHeader();

  const session = await getSession();
  if (session) {
    window.location.href = "myaccount.html";
    return;
  }

  document.querySelectorAll(".btn-social").forEach((btn) => {
    btn.addEventListener("click", () => signInWithProvider(btn.dataset.provider));
  });

  const tabs = document.querySelectorAll(".auth-tab");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      const isLogin = tab.dataset.tab === "login";
      loginForm.hidden = !isLogin;
      registerForm.hidden = isLogin;
    });
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("loginError");
    errorEl.hidden = true;
    const fd = new FormData(loginForm);
    const { error } = await signIn(fd.get("email"), fd.get("password"));
    if (error) {
      errorEl.textContent = "Email o contraseña incorrectos.";
      errorEl.hidden = false;
      return;
    }
    window.location.href = "myaccount.html";
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("registerError");
    const successEl = document.getElementById("registerSuccess");
    errorEl.hidden = true;
    successEl.hidden = true;
    const fd = new FormData(registerForm);
    const { data, error } = await signUp(fd.get("email"), fd.get("password"), fd.get("full_name"));
    if (error) {
      errorEl.textContent = error.message.includes("already registered")
        ? "Ese email ya tiene una cuenta. Iniciá sesión."
        : "No se pudo crear la cuenta. Probá de nuevo.";
      errorEl.hidden = false;
      return;
    }
    if (data.session) {
      window.location.href = "myaccount.html";
      return;
    }
    successEl.textContent = "Cuenta creada. Revisá tu email para confirmarla y después iniciá sesión.";
    successEl.hidden = false;
    registerForm.reset();
  });
});
