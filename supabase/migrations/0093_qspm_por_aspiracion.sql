-- Rediseño de la Priorización QSPM (id24, matriz_ponderada modo "qspm"): pasa de una sola tabla
-- compartida con factores/estrategias escritos a mano, a una dividida por aspiración donde los
-- factores EFI/EFE y los cruces del DOFA cruzado (config.inputsFrom = [9, 14, 21]) ya existentes
-- se activan con check y generan estrategias con un clic. Se agrega config.ratingLabels (escala
-- de atractivo 1-4 del método QSPM) y perAspiration: true. La única submission existente (vacía,
-- sin datos reales, aspiration_id null) se eliminó porque el nuevo contenido vive por aspiración.
delete from submissions where activity_id = 24 and aspiration_id is null;
