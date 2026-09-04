-- ============================================================
-- Finca Dakyros · Supabase — Seed (categorías + productos)
-- Ejecuta DESPUÉS de 0001_schema.sql.
-- ============================================================

insert into public.categorias (nombre)
select c.nombre
from (values
  ('Chocolate'),
  ('Cacao'),
  ('Café')
) as c(nombre)
where not exists (select 1 from public.categorias where nombre = c.nombre);

insert into public.productos (nombre, categoria, descripcion, precio, emoji, perfil, ocasion, activo)
select p.nombre, p.categoria, p.descripcion, p.precio, p.emoji, p.perfil, p.ocasion, true
from (values
  ('Barra Oscura 70% Cacao',  'Chocolate', 'Chocolate puro y profundo, 70% cacao de nuestra finca.', 110.00, '🍫', 'intenso',   'capricho'),
  ('Chocolate 50% con Leche', 'Chocolate', 'Cremoso y dulce, ideal para compartir.',                      95.00,  '🍫', 'cremoso',   'regalo'),
  ('Cacao en Polvo',          'Cacao',     'Cacao molido de la finca para tus recetas.',                   90.00,  '🟤', 'aromatico', 'capricho'),
  ('Café de la Finca',        'Café',      'Café artesanal de altura, tostado en San Pedro Sula.',        120.00, '☕', 'intenso',   'diario'),
  ('Cacao en Barra 100%',     'Cacao',     'Cacao puro sin azúcar para el paladar exigente.',             130.00, '🟫', 'intenso',   'capricho'),
  ('Café con Leche Molido',   'Café',      'Mezcla suave con leche para tu desayuno.',                    105.00, '☕', 'cremoso',   'diario')
) as p(nombre, categoria, descripcion, precio, emoji, perfil, ocasion)
where not exists (select 1 from public.productos where nombre = p.nombre);
