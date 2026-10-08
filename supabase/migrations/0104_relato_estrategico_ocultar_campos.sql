-- Oculta "Responsable de digitalizar" y "Enlace o archivo del mapa digital" en
-- "Relato estratégico y digitalización" (S5 id29); solo queda el campo "relato".
update activities
set config = config || jsonb_build_object(
  'fields', '[{"key": "relato", "type": "textarea", "label": "Relato estratégico (de abajo hacia arriba)"}]'::jsonb
)
where id = 29;
