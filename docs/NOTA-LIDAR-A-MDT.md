# Procedimiento seguido: LiDAR PNOA → MDT → superficie multirresolución

Entrega Torrents 0.2.0, 22 de octubre de 2026. Zona piloto, no toda Baleares.
Esta nota documenta el procesamiento real ejecutado. Optimizar visualización no
equivale a validar el modelo ni a disponer de un motor hidrológico completo.

## 1. Original conservado

- Archivo: `PNOA_2024_BAL_462-4382_H31_NPC03.laz`.
- Tamaño: 88.074.345 bytes.
- SHA-256: `ef6745d44519a57b2015b5afa2d7e7dfdc3f99d2638deb4d7c2473c1a20a2f1f`.
- 13.837.404 puntos LAS 1.4, formato 8.
- CRS horizontal: EPSG:25831, ETRS89 / UTM zona 31N, coordenadas horizontales en metros.
- Cobertura aproximada: un cuadrado de 1 km² cerca de 2,5633° E, 39,5824° N.
- Referencia vertical: no identificada en el CRS del archivo. Se conservan sus Z
  nativas; no se anuncian como cotas ortométricas contrastadas.

El original se conserva en `LIDAR/`. La inspección completa está en `inspection.json`.
Se obtuvo del archivo facilitado por el usuario. La ficha CNIG y el datum vertical
siguen pendientes de contrastar; el nombre PNOA no sustituye esa validación.

## 2. Generación del MDT nativo

Herramientas: Python 3.12, laspy 2.6.1, lazrs 0.7.0, numpy 2.2.6, pyproj 3.7.2,
rasterio 1.4.4 y scipy 1.15.3. Dependencias fijadas en `requirements-lidar.lock`.

Se recorrió el LAZ por bloques. Se usaron exclusivamente los puntos clasificados
como terreno, clase 2, excluyendo indicadores withheld, overlap y synthetic.
No se convirtió vegetación en terreno ni se reinterpretaron las clases 12 o 64.

Se tomaron 2.175.303 puntos de terreno. Se construyó una malla de 1,5 × 1,5 m,
667 columnas y 668 filas, con la media de las Z de cada celda. Solo se rellenaron
huecos a distancia de una celda mediante vecino más próximo. Los huecos mayores
siguen siendo NoData (`-9999`). Se conservó Float32 y el CRS EPSG:25831.

Resultado: 397.571 celdas medidas, 43.806 interpoladas y 4.179 sin datos. El estado
de calidad se mantiene `candidate_not_validated` y `hydrology_ready: false`.
No se han añadido obstáculos de edificios a este piloto.

Comandos desde el código de la aplicación:

```bash
bash scripts/install-lidar.sh
.venv-lidar/bin/python scripts/inspect_laz.py \
  .data/lidar/PNOA_2024_BAL_462-4382_H31_NPC03.laz \
  --sha256 --output .data/lidar/inspection.json

.venv-lidar/bin/python scripts/build_terrain.py \
  .data/lidar/PNOA_2024_BAL_462-4382_H31_NPC03.laz \
  --output .data/terrain --resolution 1.5 \
  --vertical-reference 'Z nativa del LAZ. Datum vertical no confirmado; no usar como cota ortométrica validada.' \
  --source-spec 'Archivo del usuario PNOA_2024_BAL_462-4382_H31_NPC03.laz. LAS 1.4, clase 2. Conformidad PNOA pendiente de contrastar con ficha CNIG.'

.venv-lidar/bin/python scripts/render_terrain.py .data/terrain
```

Estos comandos de generación necesitan el entorno de desarrollo completo. Los
paquetes portables incluyen el motor de consulta; reciben el MDT ya calculado
y no requieren procesar el LiDAR en el ordenador del usuario.

## 3. Optimización sin alterar las cotas

Se creó una copia COG (Cloud Optimized GeoTIFF), compresión DEFLATE sin pérdida,
predictor Float32 y bloques de 256 × 256. Incluye seis niveles reducidos calculados
mediante media. Los factores que informa GDAL en esta malla pequeña son
`2, 4, 8, 16, 32, 61`; el último es el factor efectivo por redondeo de dimensiones
al solicitar el nivel 64. Son aproximaciones para visualización, no más medidas.

Se comparó cada bloque del raster a resolución nativa con el MDT previo. Todas
las cotas y las celdas NoData son idénticas. `surface.json` conserva los hashes de
ambas versiones y `native_values_unchanged: true`.

Se generaron 50 teselas PNG XYZ de 256 × 256 para los niveles de zoom 8 a 17, en
EPSG:3857. La paleta usa los percentiles globales 2 y 98 y un sombreado calculado
a partir del MDT. No se recolorea cada tesela por separado. La banda alpha deja
transparentes las zonas sin datos. El navegador solicita solo las teselas visibles
y cambia de nivel al cambiar el zoom. Por encima del último nivel se amplía lo
existente: no se crea precisión adicional.

```bash
.venv-lidar/bin/python scripts/optimize_surface.py \
  .data/terrain .data/surfaces/pnoa-bal-462-4382-v1
```

El script exige una salida nueva. Conserva la procedencia y no reemplaza el
original. La primera versión ocupa pocos MB. Los tamaños y hashes exactos están
en `checksums.json` dentro del paquete. Las teselas son para ver el relieve;
las consultas de cotas y perfiles leen `dtm.tif` a resolución nativa.

## 4. Publicación y uso previstos

La app/código se mantiene separada de los datos. El código está preparado en el
checkout de GitHub, pendiente de publicación; los datos no se añaden a Git.
Este paquete de entrega no ha creado contenido remoto en Microsoft.

Descomprimir `SharePoint-LIDAR-y-MDT.zip` y subir su contenido a la biblioteca:

```text
Torrents/LIDAR/       original LAZ, inspección y checksum
Torrents/MDT/         mdt-piloto-v1.zip y su checksum
Torrents/INSTRUCCIONES-LIDAR-A-MDT.md
```

Comparte `MDT/` con quienes usen la app y necesiten descargar la superficie.
El LiDAR solo es necesario para auditar o regenerar el MDT. Los permisos de
SharePoint y GitHub son independientes. No se han creado enlaces compartidos.

El importador local verifica rutas, tamaños, hashes SHA-256 y metadatos del COG.
Guarda una copia en `.data/surfaces/pnoa-bal-462-4382-v1` y la selecciona. También
puede importar una carpeta de superficie sincronizada y descargada completamente.
No consulta directamente SharePoint en cada movimiento del mapa.

## 5. Hidrología estática: siguiente fase independiente

Quedan pendientes validación vertical, controles de exactitud, huecos, continuidad
con los datos vecinos, acondicionamiento hidrológico y pasos bajo carreteras.
Los límites de esta tesela no deben tratarse como divisorias de cuenca.

Para las funciones del tipo Flash Flood estático hacen falta dirección/acumulación,
una jerarquía conectada de depresiones y sus volúmenes/umbrales de desbordamiento,
así como reglas de lluvia efectiva e infiltración documentadas. Los cálculos deben
mantener conexiones entre teselas y abarcar las cuencas completas. La optimización
del MDT no implementa esos procesos. Dynamic Flood permanece fuera del alcance.

La técnica multirresolución es habitual en cartografía. Se busca una interacción
ágil, sin afirmar que esta app reproduzca la arquitectura interna, los algoritmos
propietarios o el rendimiento de Scalgo en todo un territorio.
