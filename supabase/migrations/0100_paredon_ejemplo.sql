-- Activa el botón "💡 Ver ejemplo" en "El paredón estratégico" (S6 id27).
update activities set config = config || jsonb_build_object('example', true) where id = 27;
