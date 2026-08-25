-- Datos semilla: contenido real de la Ruta de Planeación Estratégica Socya

insert into aspirations (number, name, color, hex) values
  (1, 'Cuidamos a nuestra Gente Socya desde el ser y el hacer, creciendo en comunidad', 'naranja', '#e2711d'),
  (2, 'Diseñamos soluciones que impulsan el desarrollo sostenible en los territorios', 'azul', '#2f6fb0'),
  (3, 'Aseguramos la autosostenibilidad de la Fundación', 'verde', '#4c8c3f')
on conflict (number) do nothing;

insert into tracking_board (aspiration_id, planeacion_pct, ejecucion_pct, note)
select id, 0, 0, 'Pendiente de cargar el acumulado anual vigente' from aspirations
on conflict (aspiration_id) do nothing;

insert into goals (aspiration_id, description, is_new) values
  ((select id from aspirations where number=1), 'Fortalecer la cultura Socya alineando los pilares organizacionales', false),
  ((select id from aspirations where number=2), 'Implementar 3 negocios propios', false),
  ((select id from aspirations where number=3), 'Aumentar 30% los ingresos internacionales respecto a 2025', false),
  ((select id from aspirations where number=3), 'Desarrollar Socya Invest como estrategia de inversión de impacto', false);

-- =========================================================
-- Sesiones
-- =========================================================
insert into sessions (code, name, week_label, duration_label, methodology, objective, aspiration_link, order_index) values
('S0', 'Alistamiento y apropiación del propósito', 'Semana 1 (antes de la S1)', '2 horas 40 minutos', 'Transversal — encuadre del proceso',
 'Alinear al equipo directivo y a los representantes de área alrededor del propósito "Tejemos conexiones para incidir en el cuidado del ser humano y la naturaleza" y de la ruta de trabajo de 12 semanas.',
 'Transversal: el propósito es el hilo conductor de las tres aspiraciones y de todas las sesiones.', 0),
('S1', 'Diagnóstico interno por aspiración', 'Semana 1', '4 horas', 'Serna Gómez (Perfil de Capacidad Interna – PCI) + Fred David (Matriz EFI)',
 'Identificar fortalezas y debilidades internas leídas desde las tres aspiraciones, y explicar las brechas actuales entre planeación y ejecución.',
 'Asp. 1: capacidades de cultura, talento y bienestar. Asp. 2: capacidad técnica, portafolio de soluciones y presencia territorial. Asp. 3: gestión financiera, negocios propios e inversión de impacto.', 1),
('S2', 'Diagnóstico externo y territorios', 'Semana 3', '4 horas', 'Serna Gómez (POAM) + Fred David (Matriz EFE)',
 'Comprender el entorno que habilita o amenaza las tres aspiraciones, con énfasis en los territorios, la cooperación internacional y el ecosistema de inversión de impacto.',
 'Asp. 2: dinámicas territoriales y sociales. Asp. 3: fuentes de ingresos internacionales, donantes, cooperantes e inversión de impacto. Asp. 1: tendencias de talento y bienestar en el sector social.', 2),
('S3', 'Direccionamiento: propósito, aspiraciones y metas', 'Semana 5', '4 horas', 'Serna Gómez (Direccionamiento estratégico)',
 'Ratificar el propósito, ajustar la redacción y el alcance de las tres aspiraciones a la luz del diagnóstico, definir al menos una nueva meta por aspiración y convertir todo en objetivos corporativos SMART con horizonte 2027.',
 'Directo y total: esta sesión trabaja sobre el enunciado mismo de las tres aspiraciones y sus metas asociadas.', 3),
('S4', 'Formulación de estrategias por aspiración', 'Semana 7', '5 horas', 'Fred David (DOFA cruzado, PEEA, Matriz IE y QSPM)',
 'Generar y priorizar las estrategias que permitirán cerrar las brechas de ejecución y alcanzar los objetivos SMART de cada aspiración, incluidas las nuevas metas definidas en la S3.',
 'Se construye un DOFA cruzado por cada aspiración y el ranking final QSPM asegura al menos una estrategia priorizada para cada una.', 4),
('S5', 'Mapa estratégico (Balanced Scorecard adaptado)', 'Semana 9', '5 horas', 'Kaplan & Norton (Cuadro de Mando Integral adaptado a fundación)',
 'Traducir el propósito, las aspiraciones y las estrategias priorizadas en un mapa estratégico con relaciones causa-efecto entre cuatro perspectivas adaptadas.',
 'Las perspectivas se alinean con las aspiraciones: base = Gente y cultura Socya (Asp. 1); procesos internos (transversal); Territorios y comunidades (Asp. 2); cúspide = Autosostenibilidad y uso de recursos (Asp. 3), todo bajo el propósito.', 5),
('S6', 'Plan de acción, indicadores y tablero de seguimiento', 'Semana 11', '4 horas', 'Serna Gómez (proyectos estratégicos, planes de acción e índices de gestión)',
 'Convertir los objetivos del mapa en proyectos con responsables, indicadores, metas y presupuesto, y diseñar el tablero de seguimiento del acumulado anual (planeación vs. ejecución).',
 'Los proyectos se organizan por aspiración: programa de cultura y pilares (Asp. 1); 3 negocios propios y soluciones territoriales (Asp. 2); plan de ingresos internacionales +30% y Socya Invest (Asp. 3).', 6),
('S7', 'Validación y socialización', 'Semana 12', '3 horas', 'Transversal — cierre y apropiación institucional',
 'Validar el plan estratégico con la comunidad Socya y activar el compromiso colectivo con su implementación.',
 'Cierra el ciclo devolviendo a toda la organización el plan que hará realidad las tres aspiraciones bajo el propósito común.', 7)
on conflict (code) do nothing;

-- =========================================================
-- Actividades por sesión
-- =========================================================

-- S0
insert into activities (session_id, title, time_minutes, description, materials, activity_type, config, order_index) values
((select id from sessions where code='S0'), 'El tejido de conexiones', 25,
 'En círculo, un ovillo de lana pasa de persona a persona; quien lo recibe dice cómo su rol "teje conexiones" con el ser humano o la naturaleza, y lanza el ovillo a otra persona sosteniendo su punta. Al final, el grupo observa la red física formada: es la metáfora del propósito y quedará fotografiada como imagen de apertura del proceso.',
 'Ovillo de lana verde, cámara.', 'notas', '{"categories":[{"key":"conexion","label":"Cómo mi rol teje conexiones"}]}', 0),
((select id from sessions where code='S0'), 'Radar exprés del contexto', 20,
 'El facilitador dibuja un radar de tres anillos (ya nos afecta / nos afectará este año / en el horizonte) y lanza tres rondas relámpago de 5 minutos: país y nuevo gobierno; financiamiento y cooperación internacional; tecnología y tendencias del sector social. En cada ronda, cada participante escribe una señal de cambio del entorno y la ubica en el anillo según la cercanía de su impacto. Cierre: el grupo destaca las 3 señales más repetidas o de mayor impacto.',
 'Radar de tres anillos en pliego, post-it, marcadores, temporizador.', 'notas',
 '{"categories":[{"key":"ya_afecta","label":"Ya nos afecta"},{"key":"afectara_ano","label":"Nos afectará este año"},{"key":"horizonte","label":"En el horizonte"}]}', 1),
((select id from sessions where code='S0'), 'Lectura comentada del acumulado anual', 35,
 'El facilitador presenta el estado del acumulado anual de las tres aspiraciones (planeación vs. ejecución). En parejas, los participantes responden: ¿qué explica la brecha entre planeación y ejecución en cada aspiración? Se recogen hipótesis que servirán de insumo para el diagnóstico (S1 y S2).',
 'Impresión o proyección del tablero de aspiraciones, tarjetas.', 'notas',
 '{"categories":[{"key":"hipotesis","label":"Hipótesis sobre la brecha planeación-ejecución"}]}', 2),
((select id from sessions where code='S0'), 'Crazy 8 Socya: ocho ideas en ocho minutos', 20,
 'Cada participante dobla una hoja en 8 recuadros y, en 8 minutos cronometrados, esboza 8 ideas rápidas sobre cómo Socya podría aprovechar el contexto actual para avanzar sus aspiraciones. Galería exprés: el grupo vota con 3 adhesivos por persona las ideas más transformadoras y viables. Las 3 más votadas viajan como hipótesis de estrategia a la S4.',
 'Hojas, marcadores, adhesivos de votación, temporizador.', 'votacion_fichas',
 '{"pointsPerPerson":3,"allowSubmitCandidates":true,"candidateLabel":"Idea Crazy 8"}', 3),
((select id from sessions where code='S0'), 'Conformación del Comité de Planeación y reglas de juego', 40,
 'Definir roles: patrocinador (dirección ejecutiva), facilitador, relator y un líder por aspiración (Gente y cultura; Territorios y soluciones; Autosostenibilidad). Acordar reglas: asistencia, decisiones por consenso, manejo de disensos y compromisos de información entre sesiones.',
 null, 'tarjeta_estructurada',
 '{"fields":[{"key":"rol","label":"Rol","type":"text"},{"key":"nombre","label":"Nombre asignado","type":"text"},{"key":"reglas","label":"Reglas acordadas","type":"textarea"}],"repeatable":true,"repeatLabel":"Rol del comité"}', 4),
((select id from sessions where code='S0'), 'Cierre y compromisos de información', 20,
 'Cada líder de aspiración se compromete a traer a la S1 los datos base de su frente: indicadores de cultura y talento (Asp. 1), avance de negocios propios y proyectos territoriales (Asp. 2), estados financieros, ingresos internacionales y avance de Socya Invest (Asp. 3).',
 null, 'tarjeta_estructurada',
 '{"fields":[{"key":"aspiracion","label":"Aspiración","type":"text"},{"key":"dato_comprometido","label":"Dato / insumo que trae a la S1","type":"textarea"},{"key":"responsable","label":"Responsable","type":"text"}],"repeatable":true,"repeatLabel":"Compromiso"}', 5);

-- S1
insert into activities (session_id, title, time_minutes, description, materials, activity_type, config, order_index) values
((select id from sessions where code='S1'), 'Rueda de capacidades por aspiración', 60,
 'Se conforman 3 mesas, una por aspiración. Cada mesa dibuja una rueda con las capacidades habilitantes de su aspiración y califica de 1 a 5 el desempeño actual de cada capacidad, sustentado con los datos traídos por el líder de aspiración. Plenaria: se comparan las tres ruedas y se identifican las capacidades más débiles que explican las brechas del acumulado anual.',
 'Plantillas de rueda (3), marcadores, datos base por aspiración.', 'rueda_evaluacion',
 '{"scaleMax":5,"dynamicItems":true,"perAspiration":true}', 0),
((select id from sessions where code='S1'), 'PCI consolidado (lluvia de ideas silenciosa)', 70,
 'Cada persona escribe fortalezas y debilidades específicas, marcando a qué aspiración pertenece cada una. Se agrupan por afinidad dentro de cada aspiración y se califica el impacto (alto/medio/bajo) en la matriz PCI.',
 'Post-it de 3 colores, matriz PCI en pliego.', 'notas',
 '{"categories":[{"key":"fortaleza","label":"Fortaleza"},{"key":"debilidad","label":"Debilidad"}],"impactLevels":true}', 1),
((select id from sessions where code='S1'), 'Matriz EFI', 60,
 'Seleccionar 12-15 factores internos clave (cuidando que las tres aspiraciones estén representadas), asignar pesos (suman 1.0) y calificaciones (1 a 4). Calcular el puntaje ponderado total e interpretarlo.',
 'Formato EFI en hoja de cálculo.', 'matriz_ponderada',
 '{"mode":"simple","scaleMax":4,"interpretHint":"Total > 2.5 = posición interna relativamente fuerte"}', 2),
((select id from sessions where code='S1'), 'Cierre: priorización por votación ponderada', 30,
 'Cada participante distribuye 3 puntos entre las debilidades más urgentes de resolver para cerrar las brechas de ejecución.',
 null, 'votacion_fichas',
 '{"pointsPerPerson":3,"allowSubmitCandidates":true,"candidateLabel":"Debilidad a priorizar"}', 3);

-- S2
insert into activities (session_id, title, time_minutes, description, materials, activity_type, config, order_index) values
((select id from sessions where code='S2'), 'Mundo café del entorno Socya', 90,
 'Cinco mesas temáticas rotan cada 15 minutos aportando oportunidades y amenazas por mesa; un anfitrión fijo consolida. Plenaria: cada anfitrión presenta los 3 hallazgos clave de su mesa, señalando a qué aspiración impactan.',
 'Pliegos por mesa, marcadores, temporizador.', 'notas',
 '{"categories":[{"key":"politico","label":"Político-normativa"},{"key":"financiamiento","label":"Financiamiento y cooperación internacional"},{"key":"social","label":"Social-territorial"},{"key":"ambiental","label":"Ambiental-tecnológica"},{"key":"sector","label":"Sector, competencia y aliados"}]}', 0),
((select id from sessions where code='S2'), 'Mapa de aliados y grupos de interés', 50,
 'Listar stakeholders (comunidades, equipo Socya, junta, donantes, cooperantes, inversionistas de impacto, empresas aliadas, entidades públicas). Ubicarlos en una matriz interés vs. influencia; marcar con estrella los aliados críticos para la meta de +30% de ingresos internacionales y para Socya Invest.',
 'Matriz 2x2 en pliego, tarjetas, adhesivos de estrella.', 'matriz_cuadrantes',
 '{"quadrants":[{"key":"alto_alto","label":"Alto interés / Alta influencia"},{"key":"alto_bajo","label":"Alto interés / Baja influencia"},{"key":"bajo_alto","label":"Bajo interés / Alta influencia"},{"key":"bajo_bajo","label":"Bajo interés / Baja influencia"}],"allowStar":true,"starLabel":"Aliado crítico"}', 1),
((select id from sessions where code='S2'), 'POAM', 30,
 'Consolidar oportunidades y amenazas calificando su impacto (alto/medio/bajo) y asociándolas a cada aspiración.',
 'Formato POAM.', 'notas',
 '{"categories":[{"key":"oportunidad","label":"Oportunidad"},{"key":"amenaza","label":"Amenaza"}],"impactLevels":true}', 2),
((select id from sessions where code='S2'), 'Matriz EFE', 30,
 'Seleccionar 12-15 factores externos, asignar pesos y calificaciones (1 a 4) y calcular el puntaje EFE total.',
 'Formato EFE en hoja de cálculo.', 'matriz_ponderada',
 '{"mode":"simple","scaleMax":4,"interpretHint":"Total > 2.5 = buena respuesta a oportunidades y amenazas"}', 3),
((select id from sessions where code='S2'), 'Cierre: síntesis del entorno', 20,
 'Lectura en voz alta de las 3 oportunidades y 3 amenazas de mayor impacto por aspiración, para validación grupal.',
 null, 'notas',
 '{"categories":[{"key":"oportunidad_top","label":"Top oportunidad"},{"key":"amenaza_top","label":"Top amenaza"}]}', 4);

-- S3
insert into activities (session_id, title, time_minutes, description, materials, activity_type, config, order_index) values
((select id from sessions where code='S3'), 'Socya en 2029 (visualización guiada)', 40,
 'Visualización guiada: los participantes imaginan la Fundación en 3 años habiendo cumplido las tres aspiraciones. Cada persona escribe una "noticia de prensa" breve fechada en 2029 sobre ese futuro.',
 'Hojas, lapiceros, ambiente tranquilo.', 'notas',
 '{"categories":[{"key":"noticia_2029","label":"Noticia de prensa 2029"}]}', 0),
((select id from sessions where code='S3'), 'Taller de ajuste de aspiraciones', 60,
 'Tres subgrupos, uno por aspiración, revisan la redacción actual frente al diagnóstico (S1 y S2) y proponen la aspiración ratificada o ajustada. Plenaria de convergencia: se ratifican los enunciados finales por consenso.',
 null, 'tarjeta_estructurada',
 '{"fields":[{"key":"enunciado_actual","label":"Enunciado actual","type":"textarea"},{"key":"sigue_correcta","label":"¿Sigue siendo la correcta? ¿Qué le falta o le sobra?","type":"textarea"},{"key":"enunciado_ratificado","label":"Enunciado ratificado o ajustado","type":"textarea"}],"perAspiration":true}', 1),
((select id from sessions where code='S3'), 'Subasta de nuevas metas (una nueva meta por aspiración)', 50,
 'Cada subgrupo formula 2-3 candidatas a NUEVA meta para su aspiración, nacidas de las oportunidades del diagnóstico. "Subasta" en plenaria: cada candidata se presenta y el grupo invierte fichas de valor (3 por persona). La meta más votada de cada aspiración se adopta como NUEVA meta oficial, con doliente y fecha objetivo.',
 'Tarjetas de meta candidata, fichas o adhesivos de votación.', 'votacion_fichas',
 '{"pointsPerPerson":3,"allowSubmitCandidates":true,"candidateLabel":"Meta candidata","requireOwnerAndDate":true,"perAspiration":true}', 2),
((select id from sessions where code='S3'), 'De aspiración a objetivos SMART', 50,
 'Cada subgrupo redacta 2 objetivos corporativos SMART por aspiración (específicos, medibles, alcanzables, relevantes y con plazo 2027), incluyendo obligatoriamente la NUEVA meta adoptada, usando como línea base los porcentajes del acumulado anual. Verificación cruzada: otro subgrupo valida que cada objetivo sea medible y tenga responsable natural.',
 'Plantilla SMART impresa.', 'tarjeta_estructurada',
 '{"fields":[{"key":"objetivo","label":"Objetivo SMART","type":"textarea"},{"key":"linea_base","label":"Línea base (acumulado anual)","type":"text"},{"key":"responsable","label":"Responsable natural","type":"text"},{"key":"plazo","label":"Plazo","type":"text"}],"repeatable":true,"repeatLabel":"Objetivo SMART","perAspiration":true}', 3),
((select id from sessions where code='S3'), 'Cierre: pilares y valores en acción', 40,
 'Revisar los pilares organizacionales y redactar para cada uno una frase de comportamiento observable ("esto se ve cuando...").',
 null, 'tarjeta_estructurada',
 '{"fields":[{"key":"pilar","label":"Pilar organizacional","type":"text"},{"key":"comportamiento","label":"\"Esto se ve cuando...\"","type":"textarea"}],"repeatable":true,"repeatLabel":"Pilar"}', 4);

-- S4
insert into activities (session_id, title, time_minutes, description, materials, activity_type, config, order_index) values
((select id from sessions where code='S4'), 'Tres DOFA cruzados (uno por aspiración)', 100,
 'Tres estaciones, una por aspiración, cada una con su matriz DOFA de 4 cuadrantes (FO, DO, FA, DA) alimentada con los factores de EFI y EFE de esa aspiración. Los subgrupos rotan generando estrategias por cruce de factores.',
 '3 matrices DOFA en pliego, post-it por color de aspiración.', 'matriz_cuadrantes',
 '{"quadrants":[{"key":"FO","label":"FO — Fortalezas + Oportunidades"},{"key":"DO","label":"DO — Debilidades + Oportunidades"},{"key":"FA","label":"FA — Fortalezas + Amenazas"},{"key":"DA","label":"DA — Debilidades + Amenazas"}],"perAspiration":true}', 0),
((select id from sessions where code='S4'), 'Matriz PEEA adaptada', 45,
 'Calificar las dimensiones adaptadas al contexto de fundación: sostenibilidad financiera, ventaja de reputación e impacto, estabilidad del entorno social-normativo y dinámica del sector. Graficar el vector para identificar la postura general (agresiva, conservadora, defensiva o competitiva).',
 'Plano PEEA impreso.', 'rueda_evaluacion',
 '{"scaleMax":6,"peeaMode":true,"items":[{"key":"financiera","label":"Sostenibilidad financiera","axis":"FF"},{"key":"reputacion","label":"Ventaja de reputación e impacto","axis":"VC"},{"key":"estabilidad","label":"Estabilidad del entorno social-normativo","axis":"EE"},{"key":"sector","label":"Dinámica del sector","axis":"FI"}]}', 1),
((select id from sessions where code='S4'), 'Matriz Interna-Externa (IE)', 25,
 'Ubicar a la Fundación con los puntajes EFI (S1) y EFE (S2) e interpretar la región (crecer y construir / mantener y sostener / cosechar).',
 null, 'matriz_cuadrantes',
 '{"quadrants":[{"key":"crecer","label":"Crecer y construir"},{"key":"mantener","label":"Mantener y sostener"},{"key":"cosechar","label":"Cosechar o desinvertir"}],"perAspiration":true}', 2),
((select id from sessions where code='S4'), 'Priorización QSPM', 80,
 'Preseleccionar 6-9 estrategias (2-3 por aspiración) de los DOFA. Calificar el atractivo de cada estrategia frente a los factores clave EFI/EFE (1 a 4) y calcular el puntaje total ponderado. Construir el ranking final asegurando al menos 1 estrategia priorizada por aspiración.',
 'Formato QSPM en hoja de cálculo.', 'matriz_ponderada',
 '{"mode":"qspm","scaleMax":4,"strategiesEditable":true}', 3),
((select id from sessions where code='S4'), 'Cierre: consenso de estrategias corporativas', 20,
 'El comité ratifica por consenso las 3 a 5 estrategias corporativas que pasarán al mapa estratégico (S5).',
 null, 'tarjeta_estructurada',
 '{"fields":[{"key":"estrategia","label":"Estrategia corporativa priorizada","type":"textarea"},{"key":"aspiracion","label":"Aspiración principal","type":"text"}],"repeatable":true,"repeatLabel":"Estrategia"}', 4);

-- S5
insert into activities (session_id, title, time_minutes, description, materials, activity_type, config, order_index) values
((select id from sessions where code='S5'), 'Adaptación de perspectivas al modelo Socya', 30,
 'El facilitador presenta la arquitectura del mapa: el propósito corona el mapa; la perspectiva financiera clásica se convierte en "Autosostenibilidad y uso de recursos" (Asp. 3); la de clientes en "Territorios y comunidades" (Asp. 2); y la de aprendizaje en "Gente y cultura Socya" (Asp. 1).',
 null, 'tarjeta_estructurada', '{"fields":[{"key":"nota","label":"Notas de la adaptación","type":"textarea"}]}', 0),
((select id from sessions where code='S5'), 'El paredón estratégico', 120,
 'En subgrupos, redactar en tarjetas los objetivos estratégicos que llevan las estrategias priorizadas (S4) a cada perspectiva. Trazar las relaciones causa-efecto de abajo hacia arriba (Gente → Procesos → Territorios → Autosostenibilidad).',
 'Mural amplio, tarjetas naranja/azul/verde, hilo, cinta.', 'mapa_estrategico',
 '{"perspectives":[{"key":"gente","label":"Gente y cultura Socya"},{"key":"procesos","label":"Procesos internos"},{"key":"territorios","label":"Territorios y comunidades"},{"key":"autosostenibilidad","label":"Autosostenibilidad y uso de recursos"}]}', 1),
((select id from sessions where code='S5'), 'Validación cruzada de causalidad', 60,
 'Un subgrupo distinto al autor de cada relación cuestiona su lógica ("¿por qué esto lleva a aquello?") y se ajusta el mapa.',
 null, 'notas', '{"categories":[{"key":"cuestionamiento","label":"¿Por qué esto lleva a aquello?"},{"key":"ajuste","label":"Ajuste acordado"}]}', 2),
((select id from sessions where code='S5'), 'Relato estratégico y digitalización', 60,
 'Un voluntario narra el mapa de abajo hacia arriba como una historia; el grupo valida coherencia. Se fotografía el paredón y se asigna responsable de digitalizarlo con la línea gráfica Socya.',
 'Cámara, computador.', 'tarjeta_estructurada',
 '{"fields":[{"key":"relato","label":"Relato estratégico (de abajo hacia arriba)","type":"textarea"},{"key":"responsable_digitalizacion","label":"Responsable de digitalizar","type":"text"},{"key":"enlace","label":"Enlace o archivo del mapa digital","type":"text"}]}', 3),
((select id from sessions where code='S5'), 'Cierre', 30,
 'Acuerdos de ajustes finales y agenda de trabajo entre sesiones para la digitalización.',
 null, 'tarjeta_estructurada',
 '{"fields":[{"key":"ajuste_final","label":"Ajuste final acordado","type":"textarea"},{"key":"fecha_agenda","label":"Fecha de agenda entre sesiones","type":"date"}],"repeatable":true,"repeatLabel":"Acuerdo"}', 4);

-- S6
insert into activities (session_id, title, time_minutes, description, materials, activity_type, config, order_index) values
((select id from sessions where code='S6'), 'De objetivo a proyecto estratégico', 60,
 'Cada líder de aspiración convierte los objetivos de su franja del mapa en 1-2 proyectos estratégicos concretos con alcance definido.',
 null, 'tablero_proyectos',
 '{"fields":[{"key":"nombre","label":"Proyecto estratégico","type":"text"},{"key":"alcance","label":"Alcance definido","type":"textarea"},{"key":"responsable","label":"Responsable","type":"text"}],"perAspiration":true}', 0),
((select id from sessions where code='S6'), 'Feria de indicadores', 90,
 'Estaciones por perspectiva: los equipos rotan proponiendo KPI con nombre, fórmula, línea base (del acumulado anual actual), meta 2027, frecuencia y responsable. Los relatores consolidan las fichas y se depuran duplicados en plenaria.',
 'Fichas de indicador impresas.', 'ficha_kpi', '{"perAspiration":true}', 1),
((select id from sessions where code='S6'), 'Plan de acción y tablero acumulado anual', 60,
 'Diligenciar por proyecto: responsable, actividades clave, cronograma trimestral, presupuesto estimado y riesgos. Diseñar el tablero de seguimiento con los dos porcentajes por aspiración ("Planeación" y "Ejecución"), incorporando las nuevas metas de la S3.',
 'Formato de plan de acción y maqueta del tablero.', 'tablero_proyectos',
 '{"fields":[{"key":"nombre","label":"Proyecto","type":"text"},{"key":"responsable","label":"Responsable","type":"text"},{"key":"actividades","label":"Actividades clave","type":"textarea"},{"key":"cronograma","label":"Cronograma trimestral","type":"text"},{"key":"presupuesto","label":"Presupuesto estimado","type":"text"},{"key":"riesgos","label":"Riesgos","type":"textarea"}],"perAspiration":true,"updatesTrackingBoard":true}', 2),
((select id from sessions where code='S6'), 'Cierre: gobierno del seguimiento', 30,
 'Definir periodicidad de la monitoria (mensual para ejecución, trimestral ante junta) y responsable de consolidar el tablero.',
 null, 'tarjeta_estructurada',
 '{"fields":[{"key":"periodicidad_ejecucion","label":"Periodicidad monitoria ejecución","type":"text"},{"key":"periodicidad_junta","label":"Periodicidad ante junta","type":"text"},{"key":"responsable_tablero","label":"Responsable de consolidar el tablero","type":"text"}]}', 3);

-- S7
insert into activities (session_id, title, time_minutes, description, materials, activity_type, config, order_index) values
((select id from sessions where code='S7'), 'Presentación del mapa y la ruta', 45,
 'El Comité presenta el mapa estratégico digitalizado, los proyectos por aspiración y el tablero de seguimiento a colaboradores, junta y, si aplica, representantes de comunidades y aliados.',
 null, 'tarjeta_estructurada', '{"fields":[{"key":"audiencia","label":"Audiencia presente","type":"textarea"}]}', 0),
((select id from sessions where code='S7'), 'Panel de retroalimentación', 45,
 'Preguntas y comentarios; se registran ajustes menores sin reabrir el proceso de fondo.',
 null, 'notas', '{"categories":[{"key":"ajuste_menor","label":"Ajuste menor registrado"}]}', 1),
((select id from sessions where code='S7'), 'Firma del compromiso y re-tejido de conexiones', 45,
 'Líderes y dirección firman el compromiso de implementación. Se repite brevemente la dinámica del tejido de conexiones (S0), ahora con toda la comunidad presente.',
 'Documento de compromiso, ovillo de lana, mural con el mapa.', 'tarjeta_estructurada',
 '{"fields":[{"key":"firmante","label":"Nombre","type":"text"},{"key":"rol","label":"Rol","type":"text"}],"repeatable":true,"repeatLabel":"Firma"}', 2),
((select id from sessions where code='S7'), 'Cierre y agradecimiento', 45,
 'Cada participante comparte en una palabra qué se lleva del proceso; agradecimiento formal y entrega de la pieza de divulgación (infográfico).',
 null, 'notas', '{"categories":[{"key":"palabra","label":"Una palabra que me llevo"}]}', 3);

-- =========================================================
-- Salidas / resultados esperados por sesión
-- =========================================================
insert into outputs (session_id, description, order_index) values
((select id from sessions where code='S0'), 'Comité de Planeación conformado con un líder responsable por cada aspiración.', 0),
((select id from sessions where code='S0'), 'Cronograma de 12 semanas validado y agendado en calendarios institucionales.', 1),
((select id from sessions where code='S0'), 'Radar de señales del contexto como insumo del diagnóstico externo (S2).', 2),
((select id from sessions where code='S0'), 'Top 3 de ideas Crazy 8 registradas como hipótesis de estrategia para la S4.', 3),
((select id from sessions where code='S0'), 'Tarjetas de hipótesis sobre las brechas planeación-ejecución, como insumo del diagnóstico.', 4),
((select id from sessions where code='S0'), 'Registro fotográfico del "tejido de conexiones" como símbolo del proceso.', 5),

((select id from sessions where code='S1'), 'Tres ruedas de capacidades (una por aspiración) con calificación sustentada en datos.', 0),
((select id from sessions where code='S1'), 'Matriz PCI codificada por aspiración con impactos alto/medio/bajo.', 1),
((select id from sessions where code='S1'), 'Matriz EFI diligenciada con puntaje ponderado total interpretado.', 2),
((select id from sessions where code='S1'), 'Top 3 de fortalezas diferenciadoras y top 3 de debilidades críticas por aspiración.', 3),
((select id from sessions where code='S1'), 'Primera explicación documentada de las brechas planeación vs. ejecución del acumulado anual.', 4),

((select id from sessions where code='S2'), 'Matriz POAM con oportunidades y amenazas calificadas y asociadas a cada aspiración.', 0),
((select id from sessions where code='S2'), 'Matriz EFE con puntaje ponderado total interpretado.', 1),
((select id from sessions where code='S2'), 'Mapa de stakeholders priorizado, con aliados críticos para ingresos internacionales y Socya Invest identificados.', 2),
((select id from sessions where code='S2'), 'Listado de oportunidades concretas de financiamiento internacional y de mercado para los 3 negocios propios.', 3),

((select id from sessions where code='S3'), 'Propósito "Tejemos conexiones..." ratificado como marco del plan.', 0),
((select id from sessions where code='S3'), 'Enunciados finales de las tres aspiraciones, ratificados o ajustados con base en el diagnóstico.', 1),
((select id from sessions where code='S3'), 'Una NUEVA meta oficial por cada aspiración, adoptada por votación, con doliente y fecha objetivo asignados.', 2),
((select id from sessions where code='S3'), 'Seis objetivos corporativos SMART (2 por aspiración, incluyendo las nuevas metas) con línea base del acumulado anual.', 3),
((select id from sessions where code='S3'), 'Pilares organizacionales traducidos a comportamientos observables.', 4),

((select id from sessions where code='S4'), 'Tres matrices DOFA cruzadas (una por aspiración) con estrategias FO, DO, FA y DA.', 0),
((select id from sessions where code='S4'), 'Postura estratégica general definida (vector PEEA) y posición en la matriz IE.', 1),
((select id from sessions where code='S4'), 'Matriz QSPM con ranking cuantitativo de estrategias.', 2),
((select id from sessions where code='S4'), '3 a 5 estrategias corporativas priorizadas, con al menos una por aspiración, ratificadas por consenso.', 3),

((select id from sessions where code='S5'), 'Mapa estratégico con 4 perspectivas adaptadas, coronado por el propósito.', 0),
((select id from sessions where code='S5'), 'Objetivos estratégicos por perspectiva, codificados por color de aspiración.', 1),
((select id from sessions where code='S5'), 'Relaciones causa-efecto validadas por revisión cruzada.', 2),
((select id from sessions where code='S5'), 'Relato estratégico narrado y versión digital del mapa en línea gráfica Socya (borrador).', 3),

((select id from sessions where code='S6'), 'Portafolio de proyectos estratégicos organizado por aspiración, con responsable y alcance.', 0),
((select id from sessions where code='S6'), 'Fichas KPI completas (fórmula, línea base, meta 2027, frecuencia, responsable).', 1),
((select id from sessions where code='S6'), 'Planes de acción con cronograma trimestral, presupuesto y riesgos.', 2),
((select id from sessions where code='S6'), 'Tablero de seguimiento "acumulado anual" rediseñado, con las nuevas metas incorporadas y gobierno de monitoria definido.', 3),

((select id from sessions where code='S7'), 'Plan estratégico institucional validado por la comunidad Socya.', 0),
((select id from sessions where code='S7'), 'Compromiso de implementación firmado por líderes y dirección.', 1),
((select id from sessions where code='S7'), 'Pieza de divulgación (infográfico en línea gráfica Socya) entregada a toda la organización.', 2),
((select id from sessions where code='S7'), 'Calendario de monitoria activado (primera revisión del tablero agendada).', 3);
