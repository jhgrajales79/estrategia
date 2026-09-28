-- El "Taller de ajuste de aspiraciones" (S3, id 17) ya mostraba la Matriz EFE de S2 (id 14)
-- como insumo. Ahora que existe un track paralelo de coordinadores (S2C), su propia Matriz EFE
-- (id 50) debe verse también, por separado — pero como ambas se llaman igual ("Matriz EFE"), se
-- confundirían en el panel de insumos. Se renombra la de S2C para distinguirlas de un vistazo.
update activities
set title = 'Matriz EFE Coordinadores'
where id = 50
  and activity_type = 'matriz_ponderada'
  and title = 'Matriz EFE';

update activities
set config = config || jsonb_build_object('inputsFrom', jsonb_build_array(9, 14, 50))
where id = 17
  and activity_type = 'tarjeta_estructurada'
  and title = 'Taller de ajuste de aspiraciones';
