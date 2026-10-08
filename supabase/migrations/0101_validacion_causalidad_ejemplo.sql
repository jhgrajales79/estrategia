-- Activa el botón "💡 Ver ejemplo" en "Validación cruzada de causalidad" (S6 id28).
update activities set config = config || jsonb_build_object('example', true) where id = 28;
