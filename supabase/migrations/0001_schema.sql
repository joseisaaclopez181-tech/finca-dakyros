-- ============================================================
-- Finca Dakyros · Supabase — Schema + RLS
-- Ejecuta este archivo en Supabase SQL Editor (o `supabase db push`).
-- Crea tablas, triggers de updated_at y políticas de seguridad (RLS).
-- ============================================================

-- Función auxiliar: actualiza updated_at automáticamente
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Tabla: usuarios administrativos de la app
-- auth_user_id referencia public.users... se vincula a Supabase Auth (auth.uid()).
create table if not exists public.usuarios (
  id            bigint generated always as identity primary key,
  auth_user_id  uuid unique references auth.users(id) on delete cascade,
  usuario       text not null unique,
  nombre        text not null default '',
  rol           text not null default 'admin'
    check (rol in ('admin','vendedor','campo')),
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Helper de rol: ¿el usuario autenticado actual es admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.usuarios
    where auth_user_id = auth.uid() and rol = 'admin' and activo
  );
$$;

-- Helper: ¿el usuario actual está registrado en la app?
create or replace function public.is_app_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.usuarios
    where auth_user_id = auth.uid() and activo
  );
$$;

-- Tabla: categorías
create table if not exists public.categorias (
  id          bigint generated always as identity primary key,
  nombre      text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Tabla: productos
create table if not exists public.productos (
  id          bigint generated always as identity primary key,
  nombre      text not null,
  categoria   text not null default '',
  descripcion text not null default '',
  precio      numeric(10,2) not null default 0,
  emoji       text not null default '📦',
  imagen      text,
  perfil      text,
  ocasion     text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Tabla: pedidos (items es JSONB porque varía por pedido)
create table if not exists public.pedidos (
  id          bigint generated always as identity primary key,
  nombre      text not null default '',
  ciudad      text not null default '',
  direccion   text not null default '',
  telefono    text not null default '',
  nota        text not null default '',
  items       jsonb not null default '[]'::jsonb,
  estado      text not null default 'nuevo'
    check (estado in ('nuevo','confirmado','preparacion','enviado','entregado')),
  origen      text not null default 'whatsapp',
  creado      timestamptz not null default now(),
  update      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Tabla: bitácoras de campo (formato flexible; campos tipo JSONB + columnas clave)
create table if not exists public.bitacoras (
  id             bigint generated always as identity primary key,
  tipo           text not null default '',
  fecha          text not null default '',
  responsable    text not null default '',
  sincronizado   boolean not null default true,
  sincronizado_en timestamptz,
  datos          jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Triggers updated_at
create trigger trg_usuarios_upd    before update on public.usuarios    for each row execute function public.set_updated_at();
create trigger trg_categorias_upd  before update on public.categorias  for each row execute function public.set_updated_at();
create trigger trg_productos_upd   before update on public.productos   for each row execute function public.set_updated_at();
create trigger trg_pedidos_upd     before update on public.pedidos     for each row execute function public.set_updated_at();
create trigger trg_bitacoras_upd   before update on public.bitacoras   for each row execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.usuarios    enable row level security;
alter table public.categorias  enable row level security;
alter table public.productos   enable row level security;
alter table public.pedidos     enable row level security;
alter table public.bitacoras   enable row level security;

-- --- usuarios: solo admin gestiona usuarios; cualquiera autenticado ve su perfil ---
create policy "usuarios: leer admin"        on public.usuarios for select using (public.is_admin());
create policy "usuarios: ver propio"        on public.usuarios for select using (auth_user_id = auth.uid());
create policy "usuarios: insertar admin"    on public.usuarios for insert with check (public.is_admin());
create policy "usuarios: actualizar admin"  on public.usuarios for update using (public.is_admin());
create policy "usuarios: borrar admin"      on public.usuarios for delete using (public.is_admin());

-- --- categorías: lectura para usuarios autenticados; escritura solo admin ---
create policy "categorias: leer"     on public.categorias for select using (public.is_app_user());
create policy "categorias: insertar" on public.categorias for insert with check (public.is_admin());
create policy "categorias: actualizar" on public.categorias for update using (public.is_admin());
create policy "categorias: borrar"   on public.categorias for delete using (public.is_admin());

-- --- productos: lectura pública para la tienda; escritura solo admin ---
create policy "productos: leer publico"    on public.productos for select using (true);
create policy "productos: insertar admin"  on public.productos for insert with check (public.is_admin());
create policy "productos: actualizar admin" on public.productos for update using (public.is_admin());
create policy "productos: borrar admin"    on public.productos for delete using (public.is_admin());

-- --- pedidos: cualquier usuario autenticado registra; admin lee/actualiza ---
create policy "pedidos: insertar"    on public.pedidos for insert with check (public.is_app_user());
create policy "pedidos: leer admin"  on public.pedidos for select using (public.is_admin());
create policy "pedidos: actualizar admin" on public.pedidos for update using (public.is_admin());
create policy "pedidos: borrar admin" on public.pedidos for delete using (public.is_admin());

-- --- bitácoras: usuarios autenticados insertan; admin lee/actualiza ---
create policy "bitacoras: insertar"       on public.bitacoras for insert with check (public.is_app_user());
create policy "bitacoras: leer admin"     on public.bitacoras for select using (public.is_admin() or public.is_app_user());
create policy "bitacoras: actualizar"     on public.bitacoras for update using (public.is_admin());
create policy "bitacoras: borrar admin"   on public.bitacoras for delete using (public.is_admin());
