-- "Taller de ajuste de aspiraciones" (S3, id 17): el campo "Enunciado actual" pasa de textarea
-- vacío (el equipo tenía que copiarlo de memoria o de otra pantalla) a un campo derivado de
-- solo lectura que siempre muestra el enunciado vigente de la aspiración de la pestaña activa
-- (tabla `aspirations`) — ver el nuevo tipo `field.type: "aspiration_name"` en
-- TarjetaEstructurada.tsx.
update activities
set config = jsonb_set(
  config,
  '{fields,0}',
  jsonb_build_object('key', 'enunciado_actual', 'type', 'aspiration_name', 'label', 'Enunciado actual')
)
where id = 17
  and activity_type = 'tarjeta_estructurada'
  and title = 'Taller de ajuste de aspiraciones';
