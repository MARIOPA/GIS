# Torrents · SIG Balears

Aplicación SIG de gabinete para conservar y documentar torrentes en Baleares. React, TypeScript y MapLibre, con API Node/Express, proyectos en SQLite y sesiones privadas. Creada desde cero en `MARIOPA/GIS`; el prototipo del entorno anterior no estaba disponible y no se ha modificado `design-patterns`.

Para instalar la versión 0.6.0 en Windows/Linux, usarla portable o cargar superficies, consulta la [guía de instaladores y superficies](docs/INSTALADORES-Y-SUPERFICIES.md). La versión 0.6.0 añade cuencas, trazado aguas abajo, correcciones documentales y un mapa de inundación estático provisional.

## Arranque

Requiere Node 24+, Python 3.12 y acceso a npm/PyPI. La instalación utiliza las versiones fijadas en los lockfiles y cachés en `/tmp`.

```bash
cd /workspace/GIS
bash scripts/install.sh
bash scripts/start.sh
```

El servidor de desarrollo usa el puerto **5173**, ligado a `127.0.0.1`. Se utiliza el checkout existente; cada tarea cloud ya está aislada y no necesita un worktree. Los datos preparados y la base SQLite se conservan en `.data/`, excluido de Git. La publicación de la instantánea del entorno es independiente del guardado del código y la configuración.

`install.sh` instala dependencias, compila y prepara el piloto si falta. El LAZ se descarga desde el enlace del usuario con TLS y se verifica frente al SHA256 de la copia ya inspeccionada. Ese SHA no es una certificación de origen del CNIG. La descarga depende de que el archivo de Drive siga accesible.

## Qué funciona

| Capacidad                                               | Estado                                                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Mapa fluido, zoom, desplazamiento, escala y coordenadas | Implementado; cartografía real OpenFreeMap/OSM                                                           |
| Ortofoto oficial PNOA/IGN                               | Implementada mediante WMS y comprobada en navegador                                                      |
| Base local de Baleares                                  | Natural Earth, dominio público, para trabajar sin los servicios externos                                 |
| Paneles plegables, capas, color, visibilidad y opacidad | Implementados                                                                                            |
| Puntos, líneas, polígonos, áreas y texto                | Implementados; edición de vértices para geometrías simples                                               |
| Selección, notas, longitudes y superficies              | Implementados; medidas geodésicas de Turf                                                                |
| GeoJSON WGS84                                           | Importación, validación y exportación; también geometrías Multi                                          |
| Fotografías                                             | JPEG/PNG/WebP, GPS EXIF o coordenadas manuales; copias reducidas incorporadas al proyecto                |
| Proyectos                                               | SQLite en el servidor, borrador por usuario en el navegador, exportación e importación JSON              |
| Autenticación                                           | Usuarios con scrypt, sesiones HttpOnly, aislamiento, caducidad, controles de origen y límite de intentos |
| Piloto LiDAR real                                       | Descargado y recorrido completo de 13.837.404 puntos                                                     |
| MDT piloto                                              | COG real de clase 2 a 1,5 m; **provisional, precisión y datum vertical sin validar**                     |
| Elevación y perfiles                                    | Muestras reales del MDT en el servidor, con NoData y límites de cobertura explícitos                     |
| Hidrología topográfica                                  | Acondicionamiento Priority-Flood, dirección D8, acumulación, depresiones y red de flujo provisionales     |
| Cuencas y Flash Flood Map                               | Implementados sobre el piloto como análisis estacionario **provisional y sin validar**                    |
| Modelo con edificios                                    | Herramienta preparada y probada con datos sintéticos; faltan huellas verificadas del piloto              |
| Capas hidrológicas IDEIB y Portal de l’Aigua            | Catálogo enlazado; integración pendiente de verificar cada servicio                                      |
| Curvas de nivel                                         | Teselas de 0,25 m para vista cercana y vectores filtrables de 5, 10 y 20 m                               |
| Infiltración y permeabilidad                            | Pendientes de datos y validación                                                                         |
| DynamicFlood                                            | Excluido del alcance                                                                                     |

Las cuencas y el recorrido aguas abajo usan la red D8. El Flash Flood Map distribuye lluvia uniforme e instantánea, llena depresiones y vierte el exceso. No incorpora duración, alcantarillas, puentes, edificios, rugosidad, infiltración ni correcciones dibujadas. La vista del piloto muestra Z nativa del archivo, no una cota ortométrica certificada. Los fallos de cartografía en línea activan la base local sin borrar el proyecto.

Para consultar el terreno: abre **Elevation → Ver piloto LiDAR**. Point Query consulta Z nativa. Dibuja una línea con **Profile**, termina con Enter, y usa **Consultar perfil real** en el elemento seleccionado. Los huecos son ausencia de datos y no se rellenan en el perfil.

## Validación

```bash
npm run build
npm test
npm run test:e2e
.venv-lidar/bin/python -m unittest discover -s tests -p 'test_*.py' -v
npm audit --omit=dev --cache /tmp/torrents-npm-cache
```

Las pruebas de navegador usan Chromium del sistema (`CHROMIUM_PATH` permite otra ruta), un puerto y una base de pruebas independientes. Cubren dibujo y selección real renderizada, notas, borrado/deshacer, recuperación tras recargar, importación/exportación, visibilidad, polígonos, vértices, paneles y móvil. Las pruebas de API comprueban persistencia, sesiones, aislamiento, coordenadas y muestreo de rásteres. Las pruebas Python utilizan fixtures sintéticos y **no certifican la calidad del piloto real**.

## Uso privado y despliegue

Antes de exponer la aplicación, crea un usuario desde una terminal interactiva. La contraseña no se pasa como argumento ni se guarda en el repositorio:

```bash
npm run user:add
npm run build
npm start
```

Producción se niega a arrancar sin usuarios. Se necesita un proxy HTTPS delante de Node; configura `TRUST_PROXY=1` solo si el proxy de confianza es el único acceso al proceso. Las cookies de producción son Secure. El desarrollo sin usuario se limita a localhost y rechaza `HOST` externo. Autenticación implementada no equivale a un despliegue privado ya publicado.

Variables opcionales: `PORT`, `HOST`, `DATA_DIR` (SQLite), `TERRAIN_DIR` (COG y manifiestos; por defecto `.data/terrain`), `TRUST_PROXY`. Conserva las variables de proxy y certificados que inyecta la plataforma. Copias de seguridad: usuarios, proyectos, sesiones y datos están en `.data/`; usa la API de backup de SQLite o para el servidor antes de copiar la base y sus ficheros WAL/SHM. Protege también el volumen de datos y sus backups.

Consulta [arquitectura y alojamiento](docs/ARQUITECTURA.md), [informe del piloto](docs/pnoa/PILOTO.md), [alcance respecto a SCALGO](docs/SCALGO-ALCANCE.md) y la [propuesta de cobertura, CN y correcciones](docs/COBERTURA-INFILTRACION-Y-CORRECCIONES.md).

# Instaladores y superficies 0.6.0

Consulta [instalación Windows/Linux y uso portable](docs/INSTALADORES-Y-SUPERFICIES.md)
y el [procedimiento real de LiDAR a MDT optimizado](docs/NOTA-LIDAR-A-MDT.md).
La superficie se distribuye por separado y se importa desde ZIP o carpeta local
sincronizada con SharePoint. El MDT tiene niveles COG y la visualización utiliza
teselas XYZ. La versión 0.6.0 incorpora cuencas y el mapa estático provisional del piloto.
