-- Rediseño de la Matriz PEEA (id22, rueda_evaluacion con config.peeaMode): en vez de un único
-- control compartido por eje (que un grupo de 25 personas se pisaba al editar a la vez), ahora
-- cada persona vota su propio puntaje + sustento por eje, identificado por
-- `${axis}:${participant_id}`. La postura estratégica se calcula con el promedio de los votos de
-- cada eje. config.peeaMode ya estaba en true — no requirió cambio de config, solo de forma de
-- contenido. Se reinició la única submission existente (datos de prueba) al nuevo formato
-- `{ votes: [] }` ya aplicado vía REST.
update submissions
set content = '{"votes": []}'::jsonb
where activity_id = 22 and aspiration_id is null;
