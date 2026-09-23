-- El "Mundo café del entorno Socya" (S2) pide en su descripción que cada hallazgo señale a qué
-- aspiración impacta, pero el config no tenía `selectableAspiration`, así que cada nota heredaba
-- la aspiración asignada al participante en vez de la que su hallazgo puntual afecta. Se activa
-- para que el formulario pida elegir la aspiración por nota.
update activities
set config = config || jsonb_build_object('selectableAspiration', true)
where id = 11
  and activity_type = 'notas'
  and title = 'Mundo café del entorno Socya';
