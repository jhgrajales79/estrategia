-- Reescribe la descripción de "Priorización QSPM" (S4, id24) para explicar qué es la matriz, no solo
-- cómo se califica.
update activities
set description = 'La Priorización QSPM (Matriz Cuantitativa de Planeación Estratégica) compara de forma objetiva estrategias alternativas para decidir cuáles conviene ejecutar primero, midiendo qué tan atractiva es cada una frente a los factores clave internos (EFI) y externos (EFE). Se preseleccionan 6-9 estrategias (2-3 por aspiración) de la DOFA cruzada; se califica el atractivo de cada estrategia frente a cada factor (1 a 4) y se calcula el puntaje total ponderado. El ranking final asegura al menos 1 estrategia priorizada por aspiración.'
where id = 24;
