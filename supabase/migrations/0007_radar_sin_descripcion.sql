-- "Radar de contexto": se retira el texto descriptivo del bloque de actividad.
update activities
set description = null
where title = 'Radar de contexto';
