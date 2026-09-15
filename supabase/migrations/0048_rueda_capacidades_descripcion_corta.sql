-- Texto más corto y directo para "Rueda de capacidades por aspiración" (S1): se quita la
-- mención a las "3 mesas" y a la plenaria (organización logística, no instrucción de la
-- actividad en sí) y se deja el gesto concreto: describir, calificar, y por qué importa.
update activities
set description = 'Describe las capacidades habilitantes de su aspiración, califica su desempeño de 1 a 5. "Las más débiles explican las brechas del acumulado anual."'
where activity_type = 'rueda_evaluacion'
  and title = 'Rueda de capacidades por aspiración';
