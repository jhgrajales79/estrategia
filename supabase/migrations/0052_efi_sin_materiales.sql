-- La Matriz EFI ya es totalmente digital — se quita la referencia al formato en hoja de
-- cálculo, que ya no aplica.
update activities
set materials = null
where activity_type = 'matriz_ponderada'
  and title = 'Matriz EFI';
