create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('gorrito','scrunchie')),
  name text not null,
  color text,
  price numeric not null default 0,
  stock int not null default 0,
  image_path text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'pendiente' check (status in ('pendiente','confirmado','entregado','cancelado')),
  payment_method text check (payment_method in ('efectivo','transferencia','prex')),
  total numeric not null default 0,
  created_at timestamptz not null default now(),
  -- Datos de compradoras invitadas (sin cuenta) y de pagos por Prex.
  guest_name text,
  guest_email text,
  contact_method text check (contact_method in ('telefono','instagram')),
  contact_value text,
  transfer_code text
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty int not null default 1,
  unit_price numeric not null default 0
);

create table public.favorites (
  customer_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, product_id)
);

create table public.stock_alerts (
  customer_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  notified boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (customer_id, product_id)
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  quote text not null,
  visible boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.favorites enable row level security;
alter table public.stock_alerts enable row level security;
alter table public.testimonials enable row level security;

create function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "profiles: self read" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles: self update" on public.profiles
  for update using (id = auth.uid());

create policy "products: public read active" on public.products
  for select using (active = true or public.is_admin());
create policy "products: admin write" on public.products
  for insert with check (public.is_admin());
create policy "products: admin update" on public.products
  for update using (public.is_admin());
create policy "products: admin delete" on public.products
  for delete using (public.is_admin());

create policy "orders: self or admin read" on public.orders
  for select using (customer_id = auth.uid() or public.is_admin());
create policy "orders: self insert" on public.orders
  for insert with check (customer_id = auth.uid());
create policy "orders: guest insert" on public.orders
  for insert with check (customer_id is null);
create policy "orders: admin update" on public.orders
  for update using (public.is_admin());

create policy "order_items: self or admin read" on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = auth.uid() or public.is_admin()))
  );
create policy "order_items: self insert" on public.order_items
  for insert with check (
    exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
  );

-- La política de invitada no puede hacer un EXISTS directo contra "orders":
-- esa subconsulta queda sujeta a la misma RLS de "orders", y una invitada
-- no tiene permiso de SELECT sobre su propio pedido (customer_id is null).
-- Por eso se verifica a través de una función security definer, que sí
-- puede leer la tabla sin pasar por RLS.
create function public.order_is_guest(check_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders where id = check_order_id and customer_id is null
  );
$$;

create policy "order_items: guest insert" on public.order_items
  for insert with check (public.order_is_guest(order_id));

create policy "favorites: self all" on public.favorites
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

create policy "stock_alerts: self read/insert" on public.stock_alerts
  for select using (customer_id = auth.uid() or public.is_admin());
create policy "stock_alerts: self insert" on public.stock_alerts
  for insert with check (customer_id = auth.uid());
create policy "stock_alerts: admin update" on public.stock_alerts
  for update using (public.is_admin());

create policy "testimonials: public read visible" on public.testimonials
  for select using (visible = true or public.is_admin());
create policy "testimonials: admin write" on public.testimonials
  for insert with check (public.is_admin());
create policy "testimonials: admin update" on public.testimonials
  for update using (public.is_admin());

-- Bucket público para las fotos de productos que se suben desde el panel
-- de administración (en vez de subir archivos a /img por git).
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product-images: public read" on storage.objects
  for select using (bucket_id = 'product-images');
create policy "product-images: admin insert" on storage.objects
  for insert with check (bucket_id = 'product-images' and public.is_admin());
create policy "product-images: admin update" on storage.objects
  for update using (bucket_id = 'product-images' and public.is_admin());
create policy "product-images: admin delete" on storage.objects
  for delete using (bucket_id = 'product-images' and public.is_admin());

insert into public.products (category, name, color, image_path) values
  ('gorrito', 'Champagne', 'champagne', 'img/gorro-champagne.jpg'),
  ('gorrito', 'Rosa', 'rosa', 'img/gorro-rosa-modelo.jpg'),
  ('gorrito', 'Verde esmeralda', 'verde', 'img/gorro-verde-modelo.jpg'),
  ('gorrito', 'Lila', 'lila', 'img/gorro-lila-modelo.jpg'),
  ('gorrito', 'Magenta', 'magenta', 'img/gorro-magenta-modelo.jpg'),
  ('gorrito', 'Púrpura', 'purpura', 'img/gorro-purpura.jpg'),
  ('gorrito', 'Café', 'cafe', 'img/gorro-cafe.jpg'),
  ('gorrito', 'Vino', 'vino', 'img/gorro-vino.jpg'),
  ('gorrito', 'Dorado reversible', 'dorado', 'img/gorro-dorado-reversible.jpg'),
  ('scrunchie', 'Individual', 'púrpura', 'img/scrunchie-purpura.jpg'),
  ('scrunchie', 'Set degradé', null, 'img/scrunchies-degrade-morado.jpg'),
  ('scrunchie', 'Colores surtidos', null, 'img/scrunchies-colores.jpg'),
  ('scrunchie', 'Scrunchie Box · 5 unidades', null, 'img/scrunchie-box.jpg');
