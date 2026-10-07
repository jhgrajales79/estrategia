-- Habilita el botón "Ver tablero" en las 3 actividades de contenido real que no lo tenían:
-- "El paredón estratégico" (id27 → /paredon), "Feria de indicadores" (id32 → /indicadores) y
-- "De objetivo a proyecto estratégico" (id31 → /proyectos).
update activities set config = config || jsonb_build_object('boardRoute', 'paredon') where id = 27;
update activities set config = config || jsonb_build_object('boardRoute', 'indicadores') where id = 32;
update activities set config = config || jsonb_build_object('boardRoute', 'proyectos') where id = 31;
