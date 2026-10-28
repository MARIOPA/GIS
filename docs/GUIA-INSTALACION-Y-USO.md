# Torrents · Guía para descargar, instalar, utilizar y compartir

Guía de la versión 0.1.0 · 21 de octubre de 2026.

Torrents es una aplicación web SIG para trabajar con cartografía de Baleares, documentar actuaciones en torrentes y consultar un piloto de terreno LiDAR. Se instala en un ordenador o en un servidor y se utiliza desde un navegador.

## 1. Dónde está el proyecto y qué puedes descargar ahora

El repositorio del proyecto es **https://github.com/MARIOPA/GIS**. Según indicas, lo mantienes **privado**: para acceder a él desde GitHub hay que iniciar sesión con una cuenta autorizada.

**Estado comprobado al preparar esta guía:** la rama `main` de GitHub apunta al commit inicial `00efef276f6773edd9b9554e323e00635204ea94`, que solo contiene la licencia. Los archivos de la aplicación están creados en el entorno de desarrollo, pero todavía no están publicados en GitHub. Por tanto, clonar ahora esa rama o usar su botón «Download ZIP» todavía no descarga la aplicación.

Para instalarla ahora, utiliza el archivo **`torrents-gis-0.1.0.zip`** preparado con la aplicación y esta guía. Cuando el código esté subido a GitHub, también podrás descargarlo desde el repositorio. Guardar o publicar la configuración del entorno cloud y subir el código a GitHub son operaciones diferentes.

El ZIP incluye código, scripts de instalación, documentación y pruebas. No incluye contraseñas, usuarios, proyectos personales, dependencias instaladas ni el LAZ de 88 MB. La instalación descarga ese piloto desde el enlace de Drive facilitado por el propietario y comprueba que coincide con la copia inspeccionada. Las copias ya preparadas del LAZ y del MDT permanecen en el entorno original.

## 2. Qué necesitas

La ruta recomendada es **Linux Ubuntu 24.04**. En Windows, utiliza **WSL 2 con Ubuntu 24.04**. La instalación se ha comprobado en Linux; no se ha validado una instalación nativa en Windows o macOS.

Necesitas:

- Node.js **24 o posterior**, con npm.
- Python **3.12**, con soporte para crear entornos virtuales (`venv`).
- Bash, curl y `sha256sum`.
- Git si vas a descargar mediante clonación; no es necesario para el ZIP.
- Navegador moderno con WebGL, como Chrome, Edge o Firefox.
- Internet para instalar dependencias, descargar el piloto y consultar cartografía en línea.
- Como margen práctico para el piloto, reserva unos **2 GB libres** para instalación, cachés y datos; no es una estimación para procesar toda Baleares.

En Windows, abre PowerShell como administrador y, si todavía no tienes WSL, ejecuta:

```powershell
wsl --install -d Ubuntu-24.04
```

Completa la instalación y los reinicios que indique Windows. A partir de ahí, realiza los siguientes pasos **dentro de la terminal de Ubuntu**. Instala también Node dentro de Ubuntu; una instalación de Node en Windows no sustituye la de WSL.

En Ubuntu puedes preparar las herramientas básicas con:

```bash
sudo apt update
sudo apt install -y git curl unzip python3 python3-venv
```

Instala Node.js 24 siguiendo las instrucciones oficiales de **https://nodejs.org/** para Linux. No des por hecho que el paquete `nodejs` disponible en tu distribución es suficientemente reciente. Comprueba las versiones:

```bash
node --version
npm --version
python3 --version
```

La primera debe indicar `v24` o posterior y Python debe ser 3.12 para reproducir el entorno comprobado.

## 3. Descargar la aplicación

### Opción A: ZIP de esta entrega

1. Descarga `torrents-gis-0.1.0.zip` desde el enlace adjunto a la entrega.
2. Descomprímelo. Se creará una carpeta llamada `torrents-gis-0.1.0`.
3. Abre una terminal dentro de esa carpeta.

Si el ZIP está en la carpeta actual de una terminal Linux:

```bash
unzip torrents-gis-0.1.0.zip
cd torrents-gis-0.1.0
```

En WSL es preferible trabajar en una carpeta de Ubuntu, por ejemplo dentro de tu directorio personal. Si el ZIP se descargó en Windows, puedes copiarlo allí desde el explorador o acceder a la carpeta de Windows mediante `/mnt/c/Users/…`.

### Opción B: GitHub, después de subir el código

Primero necesitas que el propietario haya subido los archivos de la aplicación y que tu cuenta tenga acceso al repositorio privado. Puedes utilizar GitHub Desktop o Git con su gestor de credenciales.

```bash
git clone https://github.com/MARIOPA/GIS.git
cd GIS
```

Si Git solicita autenticación, utiliza el acceso de GitHub configurado en tu equipo. GitHub no admite la contraseña habitual de la cuenta como contraseña de Git por HTTPS. No escribas tokens dentro de la URL ni los guardes en archivos del proyecto.

También podrás entrar en GitHub, abrir el repositorio y elegir **Code → Download ZIP**. Comprueba que contiene `package.json`, `src/`, `server/` y `scripts/`; si solo aparece `LICENSE`, el código todavía no se ha publicado en esa rama.

## 4. Instalar

Desde la carpeta que contiene `package.json`, ejecuta:

```bash
bash scripts/install.sh
```

El instalador:

1. Comprueba Node y descarga las dependencias fijadas en `package-lock.json`.
2. Crea `.venv-lidar` e instala las dependencias Python fijadas.
3. Compila la interfaz.
4. Descarga y comprueba el LAZ piloto si falta.
5. Inspecciona el piloto y prepara un MDT provisional a 1,5 m y su vista cartográfica si no existen.

Espera a que termine. No hace falta ejecutar el instalador cada vez que quieras utilizar la aplicación.

La descarga del piloto depende de que siga disponible el archivo compartido en Drive. Si falla ese último paso, la interfaz y sus dependencias pueden haber quedado instaladas: puedes arrancar el visor para dibujar, importar capas y gestionar proyectos, pero no tendrás las consultas del terreno piloto. Para repetir exclusivamente su preparación:

```bash
bash scripts/prepare-pilot.sh
```

Si dispones del LAZ original, puedes copiarlo, sin cambiarle el nombre, a `.data/lidar/` y repetir ese comando. El script comprobará su SHA256 antes de utilizarlo. No modifiques el hash esperado para ocultar una descarga incompleta o un archivo diferente.

## 5. Arrancar, abrir y detener

Para uso en tu propio ordenador:

```bash
bash scripts/start.sh
```

Deja esa terminal abierta. La aplicación escucha en el **puerto 5173**, limitada al propio ordenador. Abre el navegador de ese mismo equipo y escribe en su barra de direcciones **`127.0.0.1:5173`**. En WSL, accede desde el navegador de Windows si el reenvío local de WSL está habilitado.

Si todavía no hay usuarios configurados, funciona en modo «Desarrollo local», sin solicitar contraseña. Ese modo es para pruebas en el propio ordenador.

Para detenerla, vuelve a la terminal y pulsa **Ctrl+C**. Para utilizarla otro día, abre una terminal en la misma carpeta y ejecuta de nuevo `bash scripts/start.sh`.

Si el puerto está ocupado, no abras otra copia. Comprueba si ya tienes la aplicación arrancada. Como alternativa:

```bash
PORT=5174 bash scripts/start.sh
```

En ese caso, utiliza el puerto 5174 en el navegador.

## 6. Primeros pasos de uso

### Navegar y elegir el mapa

- Arrastra para desplazarte y usa la rueda o los botones `+` y `−` para cambiar el zoom.
- **Address** permite ir a lugares de referencia de Baleares o introducir `longitud, latitud`. No es un buscador general de direcciones postales.
- En **Base Map**, elige Cartografía (OpenFreeMap/OSM), Ortofoto (PNOA/IGN) o Base local (Natural Earth).
- Los paneles laterales se pueden plegar para ampliar el visor.

### Crear un proyecto

1. Escribe su nombre en el panel izquierdo.
2. Dibuja o importa los elementos que necesites.
3. Pulsa **Guardar proyecto**, o **Ctrl+S** fuera de los campos de texto.
4. Utiliza **Workspace** para abrir proyectos guardados, crear uno nuevo o guardar una copia.

El borrador se conserva en ese navegador y los proyectos guardados se almacenan en la base local del servidor. Para trasladarlos a otra instalación, exporta el proyecto completo y abre ese archivo en la otra copia.

### Dibujar y editar

La barra inferior permite seleccionar, añadir texto, crear puntos y dibujar líneas, polígonos o áreas.

- En líneas y polígonos, haz clic para añadir vértices.
- **Enter** o doble clic termina el trazado; **Esc** cancela el dibujo en curso.
- Selecciona un elemento para cambiar su nombre o añadir notas.
- **Editar vértices** permite mover los de geometrías simples.
- **Supr** elimina el elemento seleccionado, fuera de los campos de texto.
- **Ctrl+Z** deshace y **Ctrl+Mayús+Z** rehace.

### Importar capas y fotografías

En **Library**:

- **Importar capa** admite GeoJSON de puntos, líneas y polígonos, también Multi, en **WGS84/EPSG:4326**, hasta 24 MB. Un shapefile o unas coordenadas UTM deben convertirse y reproyectarse previamente, por ejemplo con QGIS.
- **Añadir fotografía** admite JPEG, PNG o WebP. Lee el GPS EXIF si existe y permite comprobarlo o introducir coordenadas manuales si falta.
- Las fotografías se reducen para incorporarlas al proyecto; conserva los originales por separado.

Las capas se pueden mostrar u ocultar y permiten ajustar color y opacidad. **Canvas** muestra la lista de elementos del proyecto.

### Consultar el LiDAR piloto

1. Abre **Elevation → Ver piloto LiDAR**.
2. Con **Point Query**, haz clic dentro de la tesela para consultar Z nativa.
3. Para un perfil, activa **Profile**, dibuja una línea y termina con Enter.
4. En el elemento seleccionado, pulsa **Consultar perfil real**.

Las consultas y perfiles se calculan a partir del MDT real preparado en el servidor. Fuera de la tesela o en zonas sin datos no se inventan valores.

**El MDT es provisional:** falta confirmar datum vertical y precisión. La herramienta no debe interpretarse como un modelo de inundación validado. La versión 0.6.0 calcula cuencas, recorrido D8 y una pantalla estacionaria con lluvia uniforme e instantánea. No incluye infiltración, drenaje, tiempos, velocidades ni correcciones validadas. El modelo con edificios requiere huellas verificadas.

### Exportar

- **Export → Geometrías** descarga un GeoJSON.
- **Export → Proyecto completo** descarga un JSON con capas, geometrías, notas, fotografías y parámetros.
- Las cartografías de fondo no se incluyen. Tampoco se incluye el COG completo del terreno.

## 7. Compartir el repositorio privado de GitHub

**Sí: puedes mantener el repositorio privado e invitar a una persona concreta.** La persona necesita una cuenta de GitHub y aceptar la invitación.

Como propietario, abre el repositorio **MARIOPA/GIS** en GitHub:

1. Entra en **Settings**.
2. Busca **Collaborators** o **Manage access**; el nombre puede variar según la cuenta y la interfaz.
3. Pulsa **Add people** o **Invite a collaborator**.
4. Introduce su usuario de GitHub o correo electrónico.
5. Envía la invitación. La persona tendrá que aceptarla.
6. Una vez aceptada, podrá acceder y descargar lo que esté publicado en el repositorio privado.

En un repositorio de una **cuenta personal**, el rol de colaborador normalmente incluye lectura y escritura; no presupongas que existe un rol independiente de solo lectura. Los repositorios de organizaciones ofrecen roles como **Read**, según su configuración. Si solo quieres que alguien pruebe el programa, también puedes entregarle el ZIP de forma privada o darle acceso a una instalación alojada, sin darle acceso al código en GitHub.

Puedes revocar el acceso posteriormente desde los ajustes. Eso impide futuros accesos, pero no elimina las copias que esa persona haya descargado.

No se han enviado invitaciones ni se ha cambiado la visibilidad del repositorio al preparar esta guía.

## 8. Compartir la aplicación para que otra persona la pruebe

Hay dos formas distintas:

| Forma de prueba                  | Qué necesita la otra persona                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Instalarla en su ordenador       | El ZIP o acceso al repositorio, los requisitos de instalación y esta guía. Tendrá su propia base de proyectos. |
| Utilizar una instalación alojada | Una dirección HTTPS y una cuenta de la aplicación. No necesita GitHub ni instalar Node o Python.               |

**Los permisos de GitHub y los usuarios de Torrents son independientes.** Invitar a GitHub no crea un usuario de Torrents. Un usuario de Torrents tampoco concede acceso al repositorio. El acceso al archivo de Drive es otro permiso separado.

Para preparar cuentas en una instalación privada, desde la carpeta del proyecto:

```bash
npm run user:add
```

La terminal solicita usuario y contraseña de forma interactiva. La contraseña debe tener al menos 12 caracteres. Repite el comando para cada persona; los usuarios tienen proyectos separados y actualmente no existe edición compartida del mismo proyecto.

Después de crear las cuentas, para servir la versión de producción:

```bash
npm run build
npm start
```

Antes de ofrecer acceso desde Internet, la aplicación necesita alojamiento, dominio o dirección accesible y un proxy **HTTPS** delante de Node. Las cookies de producción son Secure y no debe utilizarse el servidor de desarrollo como despliegue público. El servidor de producción está limitado por defecto a `127.0.0.1`, para situarlo detrás del proxy. `TRUST_PROXY=1` solo procede cuando el proxy de confianza sea el único acceso al proceso.

Esta entrega no incluye un despliegue privado en Internet ya realizado. Las instrucciones de arquitectura y alojamiento están en `docs/ARQUITECTURA.md`.

## 9. Conservación de datos y actualizaciones

Los datos de cada instalación se guardan en **`.data/`**. Ahí están la base SQLite de usuarios/proyectos y los productos locales del piloto. Esa carpeta está excluida de Git y no viaja con una clonación o con el ZIP de código.

Para una copia de seguridad sencilla, detén primero la aplicación y copia la carpeta `.data/` completa a un destino privado. Alternativamente, utiliza un procedimiento de backup de SQLite. Exportar un proyecto desde la interfaz es útil para transportarlo, pero no es una copia de los usuarios ni de todo el terreno.

Cuando haya una nueva versión publicada en GitHub, conserva tus datos y cambios locales antes de actualizar. Si utilizas Git y tu copia está limpia:

```bash
git pull
bash scripts/install.sh
bash scripts/start.sh
```

Si utilizas ZIP, conserva la versión anterior y sus datos hasta comprobar la nueva. Las actualizaciones futuras que cambien la estructura de la base pueden requerir instrucciones de migración específicas.

## 10. Problemas frecuentes

| Problema                                       | Qué comprobar                                                                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| El repositorio no aparece o indica «not found» | Inicia sesión con la cuenta invitada, acepta la invitación y comprueba los permisos. Un repositorio privado no se ve desde una cuenta no autorizada. |
| El ZIP de GitHub solo contiene la licencia     | El código de la aplicación todavía no está subido a esa rama. Usa el ZIP de esta entrega mientras tanto.                                             |
| Node es demasiado antiguo                      | Instala Node 24 o posterior dentro del sistema donde ejecutas los comandos; en WSL, dentro de Ubuntu.                                                |
| Falla la creación del entorno Python           | Comprueba `python3 --version` y que `python3-venv` está instalado.                                                                                   |
| Falla la descarga del LAZ                      | Comprueba Internet y el acceso al archivo de Drive. Repite `bash scripts/prepare-pilot.sh`. No cambies el checksum para forzarla.                    |
| No carga la cartografía externa                | Comprueba Internet y prueba Base local. Las capas y proyectos propios se conservan.                                                                  |
| El punto no tiene elevación                    | Comprueba que esté dentro del piloto y sobre una celda válida. No hay cobertura de elevación para toda Baleares.                                     |
| El puerto está ocupado                         | Reutiliza el servidor existente o utiliza otro puerto con `PORT=5174`.                                                                               |
| Producción dice que falta un usuario           | Ejecuta `npm run user:add` desde la misma carpeta y con el mismo `DATA_DIR`, si lo has personalizado.                                                |
| Otra persona no puede abrir tu dirección local | `127.0.0.1` solo representa el propio ordenador. Para acceso remoto hace falta alojar la aplicación y configurar HTTPS.                              |

Para información técnica y resultados de pruebas, consulta `README.md`, `docs/VALIDACION.md` y `docs/pnoa/PILOTO.md`.
