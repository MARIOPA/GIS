# Arquitectura, datos y alojamiento

## Flujo actual

React/TypeScript organiza herramientas y proyectos; MapLibre renderiza teselas vectoriales y WMS. El navegador solo recibe teselas, geometrías y una vista ligera del piloto. Las consultas y perfiles se ejecutan en Python/rasterio sobre el COG local, con muestreo parcial. No se descarga la nube ni un MDT completo por consulta.

La API Node/Express usa SQLite con WAL y propiedad de proyectos por usuario. Las contraseñas usan scrypt y sal aleatoria; la base solo guarda el hash de las sesiones, con expiración de 24 horas. La autenticación debe funcionar detrás de HTTPS en producción. No se ha desplegado públicamente ni se han creado credenciales reales.

El proxy cartográfico admite exclusivamente rutas de OpenFreeMap y el WMS PNOA del IGN; no acepta URLs arbitrarias. Reutiliza el proxy y los certificados del entorno con `EnvHttpProxyAgent`, sin desactivar TLS. Caché en memoria de hasta 300 respuestas y una hora de duración. El servicio Python admite dos consultas simultáneas y tiempos máximos. Adecuado para un piloto de pocos técnicos; un grupo mayor necesita colas, cuotas por usuario y workers persistentes.

El mapa tiene una base Natural Earth local. Los errores externos se informan y no sustituyen los datos del proyecto por datos sintéticos. No se han implementado geocodificación de direcciones general ni WMS arbitrarios: Address ofrece lugares de referencia y coordenadas; los servicios oficiales se integrarán tras verificar capa, CRS, licencia y disponibilidad.

## Servicios y red

- `tiles.openfreemap.org`: estilo, fuentes, sprites y teselas; comprobados en navegador.
- `www.ign.es`: WMS PNOA GetCapabilities y GetMap; comprobados en navegador.
- `drive.google.com` y `drive.usercontent.google.com`: página y descarga del piloto; descarga completa y hash verificados.
- `scalgo.com`: documentación consultada.
- `centrodedescargas.cnig.es`: ficha del piloto; HTTP 503 observado, sin confirmar su causa.
- `ideib.caib.es`: acceso HTTP 403 observado; no se ha verificado un servicio hidrológico.
- npm y PyPI: instalación verificada por los destinos del preset de gestores de paquetes.

Las reglas guardadas en el borrador no prueban su activación o publicación. Las comprobaciones anteriores describen la instancia usada en esta tarea. No se han añadido comodines, S3 genérico ni destinos sin uso efectivo.

## Evolución de los cálculos

Separar terreno de visualización, terreno de análisis y obstáculos. Preparar una vez COG, pirámides y estructuras de flujo/depresiones. Posteriormente servir resultados por teselas y trabajos asíncronos con límites de extensión, versión de datos y caché de parámetros. Mantener parámetros, fuentes, CRS, datum vertical y validación junto a cada resultado. No usar bordes de tesela como divisorias naturales ni interpolar huecos extensos como terreno cierto.

Para múltiples usuarios y colaboración, migrar proyectos a PostgreSQL/PostGIS y fotografías/productos grandes a almacenamiento de objetos; añadir edición concurrente/versionado. SQLite es válido para esta primera instancia única con pocos escritores y volumen persistente local.

## OneDrive

Útil para entregar nubes, fotografías, copias o resultados por lotes. No conviene como origen principal de teselas, rangos de COG o cola de cálculos: enlaces y permisos, límites, caché y disponibilidad no están diseñados como un servicio cartográfico dedicado. Puede coexistir con almacenamiento de objetos y un backend de cálculo.

## Espacio y coste con supuestos

Número de celdas: `área_km² × 1.000.000 / resolución_m²`. Un ráster Float32 sin comprimir requiere cuatro bytes por celda. Como ejemplo, **1 km² a 1,5 m** son unas 444.444 celdas y 1,78 MB decimales por ráster, antes de sobrecargas, overviews, compresión y máscara. El COG real preparado ocupa aproximadamente 1,7 MiB y el LAZ unos 84 MiB. No extrapolar su ratio de compresión a todo Baleares.

Un conjunto ilustrativo de MDT, modelo de obstáculos, terreno acondicionado, direcciones UInt8 y acumulación Float64 requiere al menos `4+4+4+1+8 = 21 bytes/celda` sin comprimir, más máscaras, depresiones, índices, vistas y copias. A **100 km² y 1 m**, eso ya son 2,1 GB de esas matrices, antes de nube de puntos y temporales. La memoria del procesamiento puede superar varias veces el tamaño en disco.

Para el visor piloto de pocos usuarios, un servidor de 2 vCPU y 4 GB RAM con disco persistente es un punto de partida para medir. El procesamiento de zonas mayores debe separarse. Un presupuesto inicial orientativo puede reservar 15–40 €/mes para esa máquina pequeña, más disco, copias, dominio y tráfico; no es una tarifa comprobada ni un presupuesto de cobertura regional. El coste real debe calcularse con proveedor, área, resolución, productos, usuarios y retención elegidos. No se ha contratado ningún recurso ni se ha fijado un coste único para Baleares.
