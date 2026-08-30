-- Crazy 8 pasa a permitir las 8 ideas por persona directamente en la app (antes solo
-- se transcribía la mejor idea ya elegida en papel). Las ideas existentes sin "slot"
-- (creadas antes de este cambio) se reasignan al primer casillero para no perderlas.

update submissions s
set content = jsonb_set(
  s.content,
  '{candidates}',
  (
    select coalesce(jsonb_agg(
      case when c ? 'slot' then c else c || jsonb_build_object('slot', 1) end
    ), '[]'::jsonb)
    from jsonb_array_elements(s.content->'candidates') c
  )
)
where activity_id = (select id from activities where title = 'Crazy 8 Socya: ocho ideas en ocho minutos')
  and s.content ? 'candidates';
