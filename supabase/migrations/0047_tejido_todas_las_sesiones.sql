-- El mural del tejido de conexiones (foto/video) solo existía en S0. Se agrega como primera
-- actividad de cada sesión S1-S7 para poder montar fotos por sesión, corriendo el resto de
-- actividades de cada sesión una posición hacia abajo (igual patrón que S0).
--
-- Nota: esta migración documenta el cambio aplicado en producción mediante
-- scripts/add-tejido-a-sesiones.mjs (con la anon key, igual que las demás migraciones de datos
-- de este archivo histórico). Es idempotente: si una sesión ya tiene tejido_conexiones, se omite.

do $$
declare
  s record;
  next_order int;
begin
  for s in select id, code from sessions where code <> 'S0' loop
    if exists (select 1 from activities where session_id = s.id and activity_type = 'tejido_conexiones') then
      continue;
    end if;

    update activities set order_index = order_index + 1 where session_id = s.id;

    insert into activities (session_id, title, time_minutes, description, materials, activity_type, config, order_index, is_enabled)
    values (s.id, 'El tejido de conexiones', 15, null, null, 'tejido_conexiones', '{}'::jsonb, 0, false);
  end loop;
end $$;
