# Referencia SCALGO y estado del alcance

Fuente oficial consultada el 21 de octubre de 2026: [Flash Flood Map](https://scalgo.com/en-US/scalgo-live-documentation/analysis/flash-flood-map). Se conserva un [extracto del concepto](scalgo/flash-flood-concept.txt), atribuido a Scalgo, para documentar las decisiones.

La documentación describe un análisis estacionario por evento: precipitación total por celda, transporte aguas abajo, llenado de depresiones y transferencia del volumen sobrante cuando desbordan. No describe una simulación temporal de la duración de la lluvia. El deslizador de profundidad filtra el resultado; no equivale al de precipitación. No se conocen ni se reproducen fórmulas internas o implementaciones propietarias.

La aplicación adopta la organización del espacio cartográfico: barra superior, panel de capas/Canvas, parámetros contextuales, biblioteca, herramientas de dibujo y exportación. Usa identidad propia y textos de estado. No es SCALGO ni ofrece resultados equivalentes.

**Implementado:** navegación, cartografía real, ortofoto, base local, importación, dibujo/edición, capas, fotografías, proyectos, exportación y autenticación. Un MDT piloto real permite consultas y perfiles provisionales con sus limitaciones visibles.

**Pendiente:** flujo D8 u otro esquema validado, acumulación/umbral, recorrido aguas abajo, delimitación de cuencas, árbol de depresiones y conexión entre ellas, balance de volúmenes, llenado/desbordamiento, correcciones hidráulicas, permeabilidad e infiltración. La UI guarda lluvia pero no dibuja manchas o cuencas simuladas. Los endpoints `/api/analysis/*` responden 409; las consultas reales disponibles están en `/api/terrain/elevation` y `/api/terrain/profile`.

Para habilitar Flash Flood Map se necesita un motor probado con conservación de masa, casos de depresiones conectadas, salida de volúmenes y condiciones de borde documentadas. Una simple diferencia entre terreno y superficie rellenada no es una simulación de lluvia. DynamicFlood queda excluido.
