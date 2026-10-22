# Piloto PNOA real

Inspección realizada el 21 de octubre de 2026 del archivo proporcionado por el usuario:

- `PNOA_2024_BAL_462-4382_H31_NPC03.laz`, descargado desde su enlace de Drive.
- Tamaño: 88.074.345 bytes. SHA256: `ef6745d44519a57b2015b5afa2d7e7dfdc3f99d2638deb4d7c2473c1a20a2f1f`.
- LAS 1.4, formato de punto 8, comprimido LAZ.
- Lectura completa: 13.837.404 puntos; coincide con la cabecera.
- CRS horizontal declarado: ETRS89 / UTM 31N, EPSG:25831, ejes horizontales en metros.
- Límites XY: 462.000–462.999,99 E; 4.381.000–4.381.999,99 N. Aproximadamente 1 km².
- Z de todos los puntos: 102,185–2.600,565. **No son las cotas mínimas y máximas del terreno**; incluye clases no utilizadas.
- La cabecera no incluye CRS vertical. No se ha supuesto EGM08, REDNAP ni otro datum.

Distribución de clases: 1: 230.558; 2: 2.175.303; 3: 1.345.358; 4: 1.337.882; 5: 5.036.005; 6: 7.144; 7: 5.262; 12: 3.699.786; 14: 13; 64: 93. Flags withheld, overlap, synthetic y key_point: cero. La interpretación específica de clases 12 y 64 debe cotejarse con las especificaciones del vuelo; no se han incluido en el terreno ni reinterpretado como clase 2.

El [informe JSON completo](INSPECCION-PILOTO.json) contiene clasificación, CRS, escalas y estadísticas. La ficha CNIG `https://centrodedescargas.cnig.es/CentroDescargas/detalleArchivo?sec=13023168` respondió HTTP 503 durante estas comprobaciones. La procedencia indicada en el nombre no sustituye la validación documental.

## MDT provisional preparado

Aproximadamente 13,84 puntos/m² totales y 2,18 puntos de terreno/m² sobre el rectángulo envolvente. Estas densidades no garantizan una distribución uniforme bajo vegetación.

Se ha usado una malla **provisional de 1,5 m**: unas 4,9 observaciones de clase 2 por celda en promedio global, antes de considerar su distribución espacial. No se interpreta esa resolución como precisión alcanzada ni como cumplimiento de una especificación PNOA.

El método calcula la media Z de puntos de clase 2 por celda, excluyendo withheld, overlap y synthetic. No usa clases de vegetación, edificios, ruido ni solape histórico de clase 12. Los huecos a distancia de una celda reciben el valor del vecino más próximo; los demás conservan NoData. Este método de preparación no constituye un procedimiento PNOA certificado ni un acondicionamiento hidrológico.

Productos locales en `.data/terrain/`:

- `dtm.tif`: COG Float32, EPSG:25831, NoData -9999, 667 × 668 celdas, unos 1,7 MiB.
- 397.571 celdas con observaciones; 43.806 interpoladas; 4.179 NoData. Hay bordes sin cobertura: no se extrapolan como terreno.
- `manifest.json`: método, archivo, SHA, resolución, exclusiones y estado `candidate_not_validated`; `hydrology_ready=false`.
- `preview.png` y `preview.json`: vista ligera reproyectada a Web Mercator para el visor; no sustituyen el COG de cálculo. La máscara del remuestreo puede diferir de los recuentos de la malla nativa.
- Consulta de Z y perfiles: muestreo servidor del COG nativo, sin descargar el MDT entero en el navegador. Las muestras procedentes de celdas interpoladas siguen perteneciendo al MDT provisional; no son observaciones independientes.

Comprobaciones reales ejecutadas: apertura y lectura completa del LAZ, consistencia de recuentos, clasificación y flags, CRS, forma del COG, NoData, consulta dentro y fuera de la cobertura y perfil de 400 muestras en un trazado de aproximadamente 680 m. La app también se comprobó en navegador con un perfil de 139 muestras sobre aproximadamente 206 m.

**Pendiente para validar:** ficha y especificaciones del vuelo, referencia y unidades verticales, comparación con puntos de control independientes, errores y sesgos por celda, cobertura bajo vegetación, continuidad con teselas vecinas y tratamiento de estructuras. No hay una estimación de precisión independiente.

## Edificios

No se ha producido un modelo real con edificios porque aún no hay huellas verificadas. La clase 6 del LAZ no se considera por sí sola una verificación de huellas.

`build_terrain.py --buildings huellas.geojson` admite polígonos WGS84 con `properties.verified=true`. Esta marca documenta una revisión previa que debe realizarse; el programa no verifica materialmente un edificio. Cada huella recibe **máxima Z del MDT bajo ella + 10 m**, constante por edificio. Rechaza huellas que crucen la cobertura, no ocupen ninguna celda o se apoyen en NoData. No quema árboles como barreras. El producto es una simplificación para análisis, no una altura real ni un MDS convencional.

## Continuación

```bash
bash scripts/prepare-pilot.sh
.venv-lidar/bin/python scripts/inspect_laz.py .data/lidar/PNOA_2024_BAL_462-4382_H31_NPC03.laz --header-only
```

Para reprocesar con otro método o resolución, elige una carpeta vacía diferente y conserva los productos existentes. No reutilices el borde de esta tesela como divisoria hidrológica. Una cuenca completa puede requerir otras teselas aunque todavía no se haya elegido un punto de salida.
