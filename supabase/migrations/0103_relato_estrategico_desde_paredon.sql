-- Activa el borrador automático + "pulir con IA" en "Relato estratégico y digitalización"
-- (S5 id29), a partir de las cadenas causa-efecto de "El paredón estratégico" (id27) y los
-- ajustes acordados en "Validación cruzada de causalidad" (id28) — ver TarjetaEstructurada.tsx.
update activities set config = config || jsonb_build_object('relatoFrom', 27, 'validacionFrom', 28) where id = 29;
