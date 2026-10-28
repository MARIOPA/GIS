# Cobertura, infiltración y correcciones: propuesta para España

## Decisión para esta versión

La versión 0.6.0 incorpora la delimitación de cuenca, el recorrido aguas abajo,
el registro de posibles correcciones y un mapa estático de agua acumulada. No
activa todavía una cobertura del suelo ni descuenta infiltración. Esos dos pasos
necesitan escoger fuentes, traducir clases y contrastar resultados antes de que
puedan usarse en un análisis.

El mapa estático es una pantalla estacionaria sobre el terreno piloto: supone
lluvia uniforme e instantánea, llena depresiones y vierte el exceso aguas abajo.
No contiene duración, hidrograma, velocidad, alcantarillado, infiltración,
edificios ni correcciones ya aplicadas. Es una aproximación inspirada en el
flujo de trabajo de SCALGO Live; no reproduce su motor ni sus datos propietarios.

## Referencia observada en SCALGO

La documentación pública de SCALGO describe su *Flash Flood Map* como un análisis
estacionario basado en un volumen total de lluvia disponible al comienzo. El
agua llena depresiones y el sobrante sigue aguas abajo. La lluvia se convierte
en escorrentía mediante funciones por clase de cobertura, lineales o basadas en
Curve Number (CN).

En Suecia combina terreno de Lantmäteriet, edificios, correcciones conservadoras
en cruces de hidrografía con infraestructuras, cobertura propia de alta resolución,
suelo superficial de SGU y zonas urbanas de SCB. Para España, su documentación
cita MDT del IGN, edificios y red de la BTN, y correcciones donde la hidrografía
cruza transporte, presas o edificios. Su cobertura detallada es un producto
propio; no es una descarga pública que podamos copiar a Torrents.

Referencias consultadas:

- [Flash Flood Map de SCALGO](https://scalgo.com/en-US/scalgo-live-documentation/analysis/flash-flood-map)
- [Runoff en SCALGO](https://scalgo.com/en-US/scalgo-live-documentation/analysis/depression-free-flow/runoff)
- [Fuentes y proceso para Suecia](https://scalgo.com/en-US/scalgo-live-documentation/country-specific/sweden)
- [Fuentes y proceso para España](https://scalgo.com/en-US/scalgo-live-documentation/country-specific/spain)

## Cobertura del suelo recomendada

La base pública nacional más detallada y preparada para asignar usos es
**SIOSE de Alta Resolución (SIOSE AR)** del IGN/CNIG. La edición nacional 2020
es una base vectorial semántica de referencia. No equivale a una clasificación
continua de píxel de 25 cm y su fecha no coincide necesariamente con la última
ortofoto disponible.

Para acercarse al detalle visual de SCALGO se propone esta jerarquía:

1. Usar SIOSE AR como verdad semántica inicial y conservar su fecha y linaje.
2. Actualizar límites visibles mediante la ortofoto PNOA más reciente disponible
   para la zona, con clasificación supervisada y revisión humana.
3. Imponer geometrías fiables de BTN para edificios, carreteras e hidrografía.
4. Añadir SIGPAC o Catastro solo para clases concretas después de comprobar
   cobertura, licencia y fecha.
5. Usar Copernicus High Resolution Layers, por ejemplo impermeabilidad, como
   comprobación auxiliar. CORINE es demasiado general para este piloto.

Cada celda terminará en una clase hidrológica breve y trazable: agua, cubierta
impermeable, edificio, vial, suelo desnudo, cultivo, pradera, matorral o bosque.
La app debe mostrar fuente, año y confianza. Una clasificación automática se
marcará como candidata hasta que una persona revise el área piloto.

## Suelo, permeabilidad y modelo CN

No conviene digitalizar manualmente mapas impresos del MITECO si existe una capa
vectorial oficial. Se comprobarán primero los servicios y descargas de
IGME-CSIC, en especial GEODE/MAGNA y el Mapa de Permeabilidades de España a
escala 1:200.000, y después las capas de geología o permeabilidad de IDEIB para
Baleares si ofrecen mayor detalle y metadatos suficientes. La cartografía de
MITECO/DGA servirá como contraste hidrogeológico. Una escala 1:200.000 no debe
presentarse como precisión de parcela.

El primer modelo reproducible será NRCS/SCS Curve Number:

1. Traducir litología, permeabilidad y, cuando exista, textura de suelo a grupo
   hidrológico A, B, C o D. Las zonas dudosas conservan un rango.
2. Cruzar ese grupo con la clase de cobertura y asignar `CN2` mediante una tabla
   versionada. Las superficies impermeables se modelan por separado.
3. Para una lluvia `P` en milímetros calcular `S = 25400 / CN - 254`,
   `Ia = λ · S`, y `Q = 0` si `P ≤ Ia`; en otro caso,
   `Q = (P - Ia)² / (P - Ia + S)`.
4. Empezar con `λ = 0,20`, mantenerlo visible y comparar con `λ = 0,05`. No
   elegir uno como calibrado sin episodios observados.
5. Aplicar el volumen `Q` al mapa estacionario. El drenaje urbano será otro
   descuento explícito y nunca quedará escondido dentro del CN.
6. Comparar volúmenes y manchas con episodios, aforos o inventarios locales y
   documentar cualquier ajuste de CN, humedad antecedente o drenaje.

Este modelo sirve para cribado y escenarios. La lluvia total sin duración no
produce tiempos, caudales punta ni velocidades y no sustituye un modelo dinámico.

## Correcciones hidrológicas

Un MDT de terreno desnudo y su suavizado no demuestran que exista una alcantarilla
o una obra de paso. El detector debe producir **candidatos** donde una vaguada o
la hidrografía de BTN queda cortada por una carretera, ferrocarril, presa,
terraplén o edificio. Cada candidato se revisará con ortofoto, inventario de obras
y, si hace falta, campo.

La capa `Correcciones hidrológicas` de 0.6.0 permite dibujar un posible paso, una
conexión o una zona. Estas geometrías se guardan y exportan, pero todavía no
modifican la dirección D8. El siguiente paso técnico será exigir estado
`propuesta/validada/rechazada`, cota de entrada y salida, diámetro o anchura y
fuente; solo las validadas podrán quemarse en una nueva versión del MDT
acondicionado. El MDT original se conservará siempre intacto.

## Orden de ejecución propuesto

1. Validar datum, precisión y límites del MDT piloto.
2. Generar candidatos de obras de paso con BTN y revisarlos.
3. Acondicionar una copia del MDT con las correcciones validadas y recalcular D8.
4. Preparar el piloto SIOSE AR + PNOA y revisar sus clases.
5. Preparar grupos A-D con IGME/IDEIB y publicar la tabla CN versionada.
6. Ejecutar escenarios con y sin infiltración y contrastarlos con observaciones.
7. Solo entonces marcar cobertura, CN y resultados como disponibles en la app.
