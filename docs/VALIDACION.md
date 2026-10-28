# Validación de la instancia

Comprobaciones ejecutadas el 21 de octubre de 2026: 4 pruebas de API, 6 de navegador y 3 de herramientas LiDAR, todas completadas sin fallos. Esta evidencia describe la instancia actual; no prueba publicación ni restauración en una nueva tarea.

- Compilación TypeScript/Vite completada. MapLibre se sirve con su worker empaquetado por Vite; no depende de un worker remoto.
- API: persistencia SQLite, recuperación, actualización y eliminación; rechazo de coordenadas proyectadas o capas inexistentes; autenticación, sesiones caducadas, separación de usuarios, límite de intentos, cierre de sesión y controles de origen.
- API de terreno: fixture ráster sintético con valores conocidos, consultas exactas, NoData/fuera de cobertura y perfil longitudinal; los resultados conservan `vertical_validated=false`.
- Navegador real Chromium: dibujo, selección de la geometría renderizada, notas, borrar/deshacer, guardar y recargar inmediatamente, reapertura de proyecto, GeoJSON/importación/exportación, visibilidad, polígonos, vértices, paneles plegables y móvil.
- Piloto real: LAZ de 88.074.345 bytes descargado, SHA256 registrado y 13.837.404 puntos leídos. MDT COG generado a 1,5 m, manifiesto provisional y vista coloreada/sombreada.
- Consultas reales del piloto: una dentro del área devuelve Z nativa; una fuera devuelve null. Un perfil de unos 680 m devuelve 400 muestras. En navegador, otro perfil de unos 206 m devuelve 139 muestras reales.
- OpenFreeMap y ortofoto PNOA cargan en Chromium sin errores HTTP ni errores JavaScript en la comprobación final. La base local se comprueba por separado en las pruebas de edición.
- Herramientas LAZ/COG: tres pruebas sintéticas que verifican lectura de clases/flags, exclusiones, COG, obstáculos constantes +10 y rechazo de huellas no verificadas o ausencia de terreno.
- Revisión de dependencias de producción: 0 vulnerabilidades comunicadas por npm audit tras actualizar MapLibre a 6.15.0. Esto no sustituye una auditoría completa de la aplicación.

No se han validado la precisión vertical del piloto, huellas reales de edificios, resultados hidrológicos, servicios de IDEIB, geocodificación general ni un despliegue público/privado con HTTPS. La ficha CNIG respondió 503; la web IDEIB respondió 403. No se atribuyen esos estados a permisos del archivo de Drive: su descarga sí funcionó.

Capturas: [visor](screenshots/visor.png), [MDT real provisional](screenshots/mdt-piloto.png), [perfil real provisional](screenshots/perfil-real.png).

# Ampliación 0.2.0: superficies e instaladores (22-10-2026)

- MDT COG nativo reempaquetado sin cambiar ninguna celda ni NoData: comparación
  por bloques con el MDT original. Seis niveles reducidos internos y 50 teselas
  PNG XYZ de zoom 8 a 17, destinadas exclusivamente a visualización.
- 4 pruebas API, 6 pruebas Python y 7 pruebas de navegador superadas. La nueva
  prueba de navegador comprueba que MapLibre sustituye `{z}/{x}/{y}` por números
  y solicita otro nivel al cambiar el zoom. Las pruebas sintéticas validan las
  herramientas, no la exactitud científica del piloto.
- Paquete Linux x64 extraído en una ruta con espacios y `ñ`: arranque mediante
  Node/Python incluidos, importación del MDT, peticiones de teselas en zooms
  8/12/15/17, consulta nativa real, perfil real y persistencia de proyecto.
- Repetido desde una instalación en carpeta de usuario. Se comprobó que no copia
  `.data` del portable, rechaza sobrescribir una instalación y no permite exponer
  el modo local en `0.0.0.0`.
- En este entorno, peticiones locales a teselas tardaron aproximadamente 1–6 ms;
  una consulta de cota, incluyendo el arranque del proceso Python, 270–311 ms.
  Es una observación local de esta tesela, no una garantía para otros equipos,
  un benchmark contra Scalgo o una medida de latencia desde SharePoint.
- Windows x64: runtimes con checksums oficiales, ruedas CPython 3.12/AMD64,
  inspección de ejecutables PE, estructura, dependencias y CRC de los ZIP.
  **Pendiente de ejecución y validación en un Windows 10 real.**
- SharePoint/OneDrive: sin conector disponible. Se ha preparado una entrega con
  carpetas LIDAR/MDT y la nota del proceso; no hay subida, enlace compartido ni
  permisos creados. El importador admite ZIP o carpeta local sincronizada.
- Código y artefactos de datos separados: `.data`, `.build`, runtimes y entregas
  fuera de Git. No se ha realizado commit, push ni despliegue remoto.

La optimización permite navegación por niveles de detalle. El MDT conserva su
estado provisional y su referencia vertical pendiente; el motor de hidrología
estática sigue pendiente de implementación y validación. Dynamic Flood excluido.

# Ampliación 0.3.0: relieve y curvas de nivel (22-10-2026)

- Elevación y sombreado se publican como capas raster XYZ independientes.
- Se generan curvas vectoriales cada 5 m en WGS84; el visor filtra intervalos de
  5, 10 o 20 m sin recalcular el MDT.
- El COG mantiene exactamente las celdas y NoData del MDT v1.
- Las capas son productos de visualización y no certifican el datum vertical.

# Ampliación 0.4.0: hidrología estática provisional (23-10-2026)

- Curvas de 0,25 m rasterizadas en teselas para evitar enviar 63 MB de GeoJSON.
- Acondicionamiento Priority-Flood y dirección D8 de una salida por celda.
- Acumulación en área aportante, red filtrable desde 0,25 ha y depresiones.
- El piloto produjo 1.048 celdas rellenadas y 4.412 segmentos base. El borde de
  la tesela se considera abierto; no se modelan alcantarillas, puentes, edificios,
  rugosidad, lluvia ni inundación.

# Ampliación 0.5.0: instalación directa y controles sencillos (28-10-2026)

- La red de flujo cambia entre vista detallada, media y principal mediante una barra.
- Las curvas de nivel cambian entre 0,25, 5, 10 y 20 m mediante el mismo patrón.
- Precipitación y opacidad mantienen barras coherentes con esos controles.
- La entrega de Windows incorpora un lanzador superior que reconstruye, verifica,
  actualiza y abre la aplicación con un solo doble clic después de descomprimirla.

# Ampliación 0.6.0: cuencas y lluvia estacionaria (28-10-2026)

- Un clic dentro del MDT delimita las celdas que drenan al punto con D8. La cuenca
  se dibuja en verde; el recorrido aguas abajo, en azul con flechas, termina en
  la última celda válida de la tesela.
- El Flash Flood Map es una pantalla estacionaria: lluvia uniforme e instantánea,
  almacenamiento en depresiones conectadas y vertido del exceso. No calcula
  duración, hidrograma, velocidad ni caudal punta.
- El resultado no incorpora todavía infiltración, drenaje urbano, edificios o
  correcciones validadas. Se identifica en la interfaz como provisional.
- La capa de correcciones permite documentar puntos, conexiones y zonas candidatas.
  Esas geometrías se guardan con el proyecto, pero no modifican el D8 actual.
- Las pruebas sintéticas comprueban el área aportante, el recorrido, el llenado y
  el vertido. Validan el algoritmo implementado; no certifican el resultado del
  MDT piloto ni equivalencia científica con SCALGO.
