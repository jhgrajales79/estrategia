-- "PCI consolidado" (S1) pasa al mismo patrón de matriz Aspiración x Categoría que
-- "Lectura comentada del acumulado anual" (S0), enfocado en Fortaleza/Debilidad.
-- Conserva la calificación de impacto (alto/medio/bajo) por nota y el panel de
-- insumos de la S0 (inputsFrom), ambos ya soportados por NotasMatriz.

update activities
set activity_type = 'notas_matriz'
where id = 8 and title = 'PCI consolidado (lluvia de ideas silenciosa)';
