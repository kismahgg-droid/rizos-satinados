import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://eyuknjkunbhbdfcolwuw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5dWtuamt1bmJoYmRmY29sd3V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwODE0ODMsImV4cCI6MjEwMzY1NzQ4M30.mNl3gCOcGE7zu2NG4m5CrheG-Yjbu7tXcoGIsk979S4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) return null;
  return data;
}

export async function signUp(email, password, fullName) {
  return supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
}

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function resetPassword(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: new URL("account.html", window.location.href).toString(),
  });
}

export async function signInWithProvider(provider) {
  return supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: new URL("myaccount.html", window.location.href).toString() },
  });
}

export async function getActiveProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("category")
    .order("name");
  if (error) {
    console.error(error);
    return [];
  }
  return data;
}

export async function getFavorites(userId) {
  const { data } = await supabase.from("favorites").select("product_id").eq("customer_id", userId);
  return data ? data.map((r) => r.product_id) : [];
}

export async function toggleFavorite(userId, productId, isFav) {
  if (isFav) {
    return supabase.from("favorites").delete().eq("customer_id", userId).eq("product_id", productId);
  }
  return supabase.from("favorites").insert({ customer_id: userId, product_id: productId });
}

export async function requestStockAlert(userId, productId) {
  return supabase
    .from("stock_alerts")
    .upsert({ customer_id: userId, product_id: productId }, { onConflict: "customer_id,product_id" });
}

export async function createOrder(userId, item) {
  const { data: order, error } = await supabase
    .from("orders")
    .insert({ customer_id: userId, total: item.unit_price * item.qty })
    .select()
    .single();
  if (error) throw error;
  await supabase.from("order_items").insert({
    order_id: order.id,
    product_id: item.product_id,
    qty: item.qty,
    unit_price: item.unit_price,
  });
  return order;
}

export async function createOrderWithItems(userId, items) {
  const total = items.reduce((sum, it) => sum + it.unit_price * it.qty, 0);
  const { data: order, error } = await supabase
    .from("orders")
    .insert({ customer_id: userId, total })
    .select()
    .single();
  if (error) throw error;
  const rows = items.map((it) => ({
    order_id: order.id,
    product_id: it.product_id,
    qty: it.qty,
    unit_price: it.unit_price,
  }));
  await supabase.from("order_items").insert(rows);
  return order;
}

export async function createPrexOrder({ items, guestName, guestEmail, contactMethod, contactValue, transferCode }) {
  const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  const session = await getSession();
  // Generamos el id del lado del cliente: una invitada sin cuenta puede
  // insertar su pedido, pero no puede releerlo (RLS), así que no podemos
  // depender del id que devolvería la base tras el insert.
  const orderId = crypto.randomUUID();
  const payload = {
    id: orderId,
    payment_method: "prex",
    total,
    guest_name: guestName,
    guest_email: guestEmail,
    contact_method: contactMethod,
    contact_value: contactValue,
    transfer_code: transferCode,
  };
  if (session) payload.customer_id = session.user.id;

  const { error } = await supabase.from("orders").insert(payload);
  if (error) throw error;
  const rows = items.map((it) => ({
    order_id: orderId,
    product_id: it.product_id,
    qty: it.qty,
    unit_price: it.price,
  }));
  const { error: itemsError } = await supabase.from("order_items").insert(rows);
  if (itemsError) throw itemsError;
  return { id: orderId };
}

export async function getMyOrders(userId) {
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*, products(name, image_path))")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function getMyFavoriteProducts(userId) {
  const { data } = await supabase
    .from("favorites")
    .select("products(*)")
    .eq("customer_id", userId);
  return data ? data.map((r) => r.products).filter(Boolean) : [];
}

export async function getMyStockAlerts(userId) {
  const { data } = await supabase
    .from("stock_alerts")
    .select("*, products(name, image_path, stock)")
    .eq("customer_id", userId);
  return data || [];
}

export async function getVisibleTestimonials() {
  const { data } = await supabase
    .from("testimonials")
    .select("*")
    .eq("visible", true)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function adminListProducts() {
  const { data } = await supabase.from("products").select("*").order("category").order("name");
  return data || [];
}

export async function adminUpsertProduct(product) {
  return supabase.from("products").upsert(product).select();
}

// Sube una foto al bucket público "product-images" y devuelve su URL pública
// para usarla como image_path del producto.
export async function uploadProductImage(file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) return { error };
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return { url: data.publicUrl };
}

export async function adminDeleteProduct(id) {
  return supabase.from("products").delete().eq("id", id);
}

export async function adminListOrders() {
  const { data } = await supabase
    .from("orders")
    .select("*, profiles(full_name, phone), order_items(*, products(name))")
    .order("created_at", { ascending: false });
  return data || [];
}

export async function adminUpdateOrderStatus(orderId, status) {
  return supabase.from("orders").update({ status }).eq("id", orderId);
}

export function money(n) {
  const num = Number(n) || 0;
  return "$ " + num.toLocaleString("es-UY");
}

export async function renderAuthHeader() {
  const links = [document.getElementById("authLink"), document.getElementById("authLinkMobile")].filter(Boolean);
  if (!links.length) return;
  const session = await getSession();

  if (!session) {
    links.forEach((link) => {
      link.textContent = "Iniciar sesión";
      link.href = "account.html";
    });
    return;
  }

  links.forEach((link) => {
    link.textContent = "Mi cuenta";
    link.href = "myaccount.html";
  });
}
