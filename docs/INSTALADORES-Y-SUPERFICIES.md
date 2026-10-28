# Torrents 0.5.0: instalar, abrir y cargar un MDT

La app y las superficies se distribuyen por separado. Los paquetes de aplicación
incluyen Node.js 24.19.0, Python 3.12.12 y las bibliotecas de consulta. No necesitan
instalar Node, Python, Git, WSL ni herramientas de desarrollo en el ordenador.
No incluyen LiDAR, MDT, usuarios, contraseñas ni proyectos personales.

## Qué descargar

| Archivo                          | Uso                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `torrents-windows-x64-0.5.0.zip` | Windows 10/11 de 64 bits, instalación o portable                               |
| `torrents-linux-x64-0.5.0.zip`   | Linux x64 con glibc 2.28 o posterior, instalación o portable                   |
| `mdt-piloto-v3.zip`              | MDT, curvas, sombreado e hidrología topográfica provisional                    |
| `SharePoint-LIDAR-y-MDT.zip`     | Entrega para el propietario: original LiDAR, paquete MDT y nota de preparación |
| `torrents-codigo-0.5.0.zip`      | Código para desarrollo; no es el instalador de usuario                         |

También se entrega `torrents-portable-windows-x64-0.5.0.zip`: la versión Windows
sin instalador, para abrir directamente desde una carpeta o USB.

Los dos primeros ZIP sirven también como **portables**: se descomprimen en una
carpeta con permiso de escritura, incluido un disco USB, y se ejecutan sin instalar.
Los runtimes son específicos de cada sistema: no hay un único ejecutable válido
para Windows, Linux y macOS. Estos paquetes no son para Windows ARM, Linux ARM,
macOS ni Alpine/musl.

Se ha probado el paquete Linux en este entorno. El paquete Windows se ha montado
con runtimes y wheels oficiales x64 y se ha inspeccionado su contenido, pero está
pendiente de una prueba en un equipo Windows real. No se presenta como certificado
en Windows 10. Los lanzadores `.cmd` no son instaladores `.exe` firmados.

## Windows 10/11

En la entrega privada dividida de la rama `downloads`, descomprime todo y haz doble
clic en `INSTALAR-Y-ABRIR-TORRENTS.cmd`. El lanzador reconstruye el paquete,
comprueba su integridad, instala la última actualización y abre Torrents. No hay
que abrir CMD, escribir comandos ni ejecutar actualizaciones por separado.

1. Descarga y **descomprime completamente** `torrents-windows-x64-0.5.0.zip`.
   No abras los lanzadores desde dentro del ZIP.
2. Para instalar, haz doble clic en `Instalar-Windows.cmd`. Copia la app a
   `%LOCALAPPDATA%\Torrents\0.5.0` y crea un acceso directo en el escritorio.
   No requiere permisos de administrador y no cambia las políticas de PowerShell.
3. En la carpeta instalada abre `Importar-MDT.cmd` y elige `mdt-piloto-v3.zip`.
4. Abre `Torrents` desde el escritorio o `Abrir-Torrents.cmd` en esa carpeta.
5. Se abrirá el navegador. Mantén abierta la ventana del servidor mientras trabajas;
   usa `Ctrl+C` para detenerlo.

Para usarlo **portable**, omite el paso de instalación y ejecuta `Importar-MDT.cmd`
y `Abrir-Torrents.cmd` directamente en la carpeta descomprimida. Los proyectos
se guardarán en la carpeta `.data` de esa copia portable. Cierra la app antes de
retirar el USB. Si tu organización restringe ejecutar programas desde USB o
PowerShell, utiliza una ubicación y un método autorizados por su administrador.

## Linux

Descomprime `torrents-linux-x64-0.5.0.zip` y abre una terminal en la carpeta extraída.
Ubuntu 22.04/24.04 o Debian 12 x64 son ejemplos del sistema requerido. La ejecución
también necesita las bibliotecas habituales del sistema, como glibc y libstdc++.

Para instalar en tu perfil, sin `sudo`:

```bash
bash instalar-linux.sh
```

El instalador muestra la ruta de destino. Por defecto es
`~/.local/share/torrents/0.5.0` (respeta `XDG_DATA_HOME`). Desde esa carpeta:

```bash
bash importar-mdt.sh "/ruta/a/mdt-piloto-v3.zip"
bash abrir-torrents.sh
```

Para usarlo **portable**, ejecuta esos dos últimos comandos en la carpeta
descomprimida, sin ejecutar `instalar-linux.sh`. No cambies la estructura interna.

## Primer uso

La dirección local es `http://127.0.0.1:5173`. Solo es accesible en ese ordenador.
Este modo no publica la app en Internet ni hace que se abra desde un móvil.
Si el puerto está ocupado, cierra la otra copia o usa otro puerto:

```bash
PORT=5174 bash abrir-torrents.sh
```

En Windows abre una consola en la carpeta y usa:

```bat
set PORT=5174
Abrir-Torrents.cmd
```

En una copia nueva el modo local permite trabajar sin crear una cuenta. El
servidor se limita a `127.0.0.1` y rechaza exponer este modo en otras interfaces.
Para un despliegue compartido se mantienen el modo privado, usuarios y HTTPS;
ese despliegue es una operación independiente de estos instaladores.

Abre el panel de capas, activa **MDT piloto** y pulsa el botón para ir a su zona.
Al cambiar el zoom se solicitan teselas de distinto nivel, en lugar de enviar el
raster completo. Alejar el mapa reduce el detalle y acercarlo llega al detalle
del modelo original de 1,5 m. Seguir acercándose no añade mediciones nuevas.

Puedes dibujar, medir, añadir fotos, guardar proyectos y consultar cotas/perfiles.
Las cotas y perfiles se leen del COG nativo. Las imágenes de colores y los niveles
reducidos son exclusivamente para visualizar; no se emplean como cotas de cálculo.

El MDT piloto es provisional: datum vertical y exactitud no validados. La versión
0.5.0 incluye acondicionamiento Priority-Flood, dirección D8, acumulación, relleno
de depresiones y una red de flujo topográfica. El borde de esta tesela se considera
abierto y no se incorporan alcantarillas, puentes, edificios, rugosidad, infiltración
ni lluvia. No calcula inundación, cuencas ni Dynamic Flood.

Las curvas de 0,25 m son una capa de visualización preparada en teselas y aparecen
al acercarse al mapa. Su intervalo vertical de 0,25 m no aumenta la resolución
horizontal ni la exactitud del MDT original, que sigue teniendo celdas de 1,5 m.

## Datos de SharePoint

La estructura prevista es:

```text
Torrents/
├── LIDAR/
│   ├── PNOA_2024_BAL_462-4382_H31_NPC03.laz
│   ├── PNOA_2024_BAL_462-4382_H31_NPC03.laz.sha256
│   └── inspection.json
├── MDT/
│   ├── mdt-piloto-v3.zip
│   └── mdt-piloto-v3.zip.sha256
└── INSTRUCCIONES-LIDAR-A-MDT.md
```

**La carpeta preparada está en esta entrega; no se ha subido a Microsoft.** El
conector de SharePoint/OneDrive no está disponible en esta sesión. No se han
creado carpetas remotas, enlaces compartidos ni permisos de Microsoft.

El propietario puede descomprimir `SharePoint-LIDAR-y-MDT.zip` y subir el contenido
a su biblioteca. Los usuarios que solo visualicen y consulten el terreno necesitan
acceso a `MDT`, no al LiDAR original. Comparte con las personas concretas y verifica
que puedan descargar. Dar acceso al GitHub privado permite obtener el código;
no concede acceso a SharePoint ni a la aplicación desplegada.

Cada usuario descarga `mdt-piloto-v3.zip` y lo importa. Es una copia local, no una
lectura directa de teselas desde SharePoint. Funciona también con una carpeta de
superficie sincronizada con OneDrive y marcada **Mantener siempre en este dispositivo**.
Esa carpeta debe contener `surface.json`, `checksums.json`, `dtm.tif` y `tiles/`:

```bash
# En el paquete Linux, importar una carpeta local ya sincronizada:
runtime/node/bin/node scripts/surface.mjs "/ruta/OneDrive/MDT/superficie-descomprimida"
```

```bat
REM En el paquete Windows:
runtime\node\node.exe scripts\surface.mjs "C:\ruta\OneDrive\MDT\superficie-descomprimida"
```

El importador verifica cada archivo con SHA-256, valida el COG y copia una versión
local. No elimina ni modifica la carpeta de SharePoint. Reinicia la app tras
importar. Un paquete modificado con el mismo identificador se rechaza para evitar
sobrescrituras: una nueva superficie debe llevar un identificador de versión nuevo.
Los checksums detectan corrupción; la procedencia debe confirmarse obteniendo el
paquete desde la biblioteca o enlace que haya compartido el propietario.

SharePoint sirve para **distribuir paquetes versionados**. Para ver un territorio
grande mediante streaming desde Internet haría falta, además, un servicio que
entregue teselas y consultas bajo demanda. No se atribuye la arquitectura interna
de Scalgo a esta implementación.

## Dónde se guarda y cómo conservarlo

```text
carpeta-de-la-app/
├── runtime/                  # Node y Python incluidos
├── dist/                     # Interfaz lista para abrir
├── .data/
│   ├── torrents.sqlite       # Proyectos y posibles cuentas de esta copia
│   ├── surface-selection.json
│   └── surfaces/
│       └── pnoa-bal-462-4382-v3/
│           ├── dtm.tif
│           ├── surface.json
│           ├── checksums.json
│           └── tiles/
└── ...
```

Haz copia de `.data` con el servidor detenido. Los instaladores rechazan un destino
que ya existe y excluyen `.data` al copiar la aplicación: no sobrescriben ni migran
proyectos de una copia anterior. Conserva la versión anterior hasta comprobar una
migración. Para desinstalar, cierra la app y retira su carpeta y su acceso directo,
conservando primero los datos que necesites.

El MDT y sus teselas funcionan sin conexión después de importarlos. Los mapas de
fondo que provienen de Internet siguen necesitando conexión. No es un mapa de fondo
completo descargado para uso offline.

Si falta el MDT, la app sigue ofreciendo el mapa y las anotaciones. Si una importación
falla, no cambia la superficie activa. Si la app se cierra con un error en Windows,
conserva el texto de la consola para la prueba de compatibilidad pendiente.

## Desarrollo y reproducción

El código sigue en el checkout del repositorio privado `MARIOPA/GIS`. No se ha
realizado commit ni push como parte de esta entrega. El repositorio remoto no
debe darse por actualizado hasta publicar el código expresamente. `.data/`,
`runtime/`, `.build/`, `releases/`, LAZ y TIFF están excluidos de Git.

Para reconstruir los paquetes en Linux, con Node 24, Python 3.12 y el entorno
de desarrollo preparado:

```bash
.venv-lidar/bin/python scripts/build_release.py --output /ruta/fuera-del-repositorio/entrega
```

`build_release.py` comprueba SHA-256 de los runtimes contra valores fijados a
partir de las publicaciones oficiales de Node.js y Astral Python Build Standalone.
Las versiones de las bibliotecas están fijadas en `requirements-runtime.lock`;
la distribución conserva sus licencias y metadatos. Las fuentes de los runtimes
figuran en `RUNTIMES.json` dentro de cada paquete. El constructor exige una carpeta
de preparación nueva para no reutilizar silenciosamente una compilación anterior.
