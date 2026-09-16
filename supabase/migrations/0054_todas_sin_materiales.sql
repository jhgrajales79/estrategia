-- El registro de todas las actividades ya es totalmente digital — se quita la referencia a
-- materiales físicos (post-it, pliegos, tarjetas impresas, etc.) en todas las sesiones.
update activities
set materials = null
where materials is not null;
