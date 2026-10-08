-- Agrega "Implementar el modelo RAEE" como meta nueva de la Aspiración 2 (confirmada por el
-- usuario; venía como candidata de la Subasta sin aspiración asignada). Con esta, las 8
-- candidatas originales de la Subasta ya quedaron todas clasificadas en goals.
insert into goals (aspiration_id, description, is_new) values
  (2, 'Implementar el modelo RAEE', true);
