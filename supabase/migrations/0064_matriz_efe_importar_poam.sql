-- Generaliza el mecanismo de importación de MatrizPonderada.tsx (antes hardcodeado a
-- fortaleza/debilidad para PCI→EFI) para que acepte cualquier par de categorías vía
-- `config.importCategories: { positive, negative }` y un `config.importLabel` para el texto
-- del botón — ver el componente para el detalle. La Matriz EFI (id 9) sigue funcionando igual
-- que antes (el código usa fortaleza/debilidad como valor por defecto si no se especifica).
--
-- Activa esa importación en la Matriz EFE (S2, id 14) apuntando al POAM (id 13):
-- oportunidad/amenaza en vez de fortaleza/debilidad. También se activa `perAspiration: true`
-- (Matriz EFE no lo tenía, a diferencia de Matriz EFI que sí) — es necesario para que el botón
-- de importar aparezca (importa a la pestaña de aspiración activa), y además hace que EFE siga
-- la misma lógica de "una matriz por aspiración" que ya usa EFI. Se verificó que la submission
-- existente de EFE no tenía datos reales (una sola fila vacía), así que no hay nada que migrar.
update activities
set config = config || jsonb_build_object(
  'perAspiration', true,
  'importFactorsFrom', 13,
  'importCategories', jsonb_build_object('positive', 'oportunidad', 'negative', 'amenaza'),
  'importLabel', 'POAM'
)
where id = 14
  and activity_type = 'matriz_ponderada'
  and title = 'Matriz EFE';
