-- Pre-diligencia "Validación cruzada de causalidad" (S6 id28) con las relaciones causa-efecto
-- ya trazadas en "El paredón estratégico" (id27) — ver ValidacionCausal.tsx.
update activities set config = config || jsonb_build_object('causalFrom', 27) where id = 28;
