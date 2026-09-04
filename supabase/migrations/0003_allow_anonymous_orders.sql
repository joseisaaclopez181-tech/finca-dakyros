-- ============================================================
-- Finca Dakyros · Supabase — Permitir pedidos anónimos de la tienda
-- Ejecuta DESPUÉS de 0001_schema.sql.
-- La tienda permite pedidos sin login; los clientes no autenticados
-- insertan pedidos con la anon key. Solo los admins leen/actualizan.
-- ============================================================

-- Ajustar la política de inserción de pedidos para permitir anónimos
drop policy if exists "pedidos: insertar" on public.pedidos;

create policy "pedidos: insertar publico"
  on public.pedidos
  for insert
  with check (true);
