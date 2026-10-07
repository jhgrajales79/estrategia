-- La Matriz Interna-Externa (id23) no se va a desarrollar: se marca config.hidden = true para
-- que fetchActivities la excluya por completo (facilitador y participantes), a diferencia de
-- is_enabled que solo la bloquearía dejándola visible con candado.
update activities set config = config || jsonb_build_object('hidden', true) where id = 23;
