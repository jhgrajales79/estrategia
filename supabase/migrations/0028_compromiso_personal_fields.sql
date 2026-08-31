-- Backfill aspiration_id/role en compromisos existentes (creados antes de que el
-- componente capturara esos campos automáticamente) y se retira el compromiso de
-- prueba de QA, que no es un participante real del taller.
update submissions
set content = jsonb_set(
  content,
  '{commitments}',
  (
    select coalesce(jsonb_agg(
      c || jsonb_build_object(
        'aspiration_id', coalesce(c->'aspiration_id', 'null'::jsonb),
        'role', coalesce(c->'role', '"participante"'::jsonb)
      )
    ), '[]'::jsonb)
    from jsonb_array_elements(content->'commitments') c
    where c->>'author' <> 'QA UUID Test'
  )
)
where activity_id = 6 and content ? 'commitments';
