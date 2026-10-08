-- Completa las metas vigentes que faltaban en la tabla `goals` (detectadas comparando contra el
-- árbol de resultados real del plan): una por aspiración.
insert into goals (aspiration_id, description, is_new) values
  (1, 'Desarrollamos capacidades socioambientales, alineadas con nuestras líneas de negocio', false),
  (2, 'Transformamos el CEC en un laboratorio habilitador de soluciones circulares', false),
  (3, 'Incrementamos la competitividad organizacional', false);
