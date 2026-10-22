# Descargas de Torrents 0.2.0

## Actualización 0.3.0: relieve y curvas de nivel

Quien ya tenga la aplicación 0.2.0 debe descargar únicamente
`updates/0.3.0/actualizacion-torrents-0.3.0.zip`, extraer su carpeta dentro de
`C:\Torrents\GIS-downloads` y ejecutar `ACTUALIZAR-TORRENTS-0.3.cmd`.

La actualización conserva `.data`, los proyectos y la superficie anterior. Añade
una superficie v2 con elevación y sombreado separados, además de curvas de nivel
seleccionables cada 5, 10 o 20 m. También guarda una copia local del código 0.2.0.

SHA-256 de la actualización:

```text
368ecc27b2bce31ee1b1e48d6b4bc40d10fd97f8b66baef654470cec57e0c5ec
```

`updates/0.3.0/mdt-piloto-v2.zip` contiene la nueva superficie por separado para
otras instalaciones. No hace falta importarla después de aplicar la actualización.

Esta rama contiene una entrega privada para Windows 10/11 x64 y el MDT piloto por
separado. La aplicación preparada ya lleva el MDT colocado en su estructura local.

## Opción recomendada: aplicación Windows lista con MDT

1. En GitHub, selecciona la rama `downloads`.
2. Pulsa **Code > Download ZIP**.
3. Descomprime por completo el ZIP descargado.
4. Haz doble clic en `PREPARAR-Y-ABRIR-TORRENTS.cmd`.
5. El reconstruidor comprueba el SHA-256, extrae la aplicación y abre Torrents.

Si una descarga anterior se interrumpió durante `Expand-Archive`, sustituye el
reconstruidor por la versión actual o ejecuta `REPARAR-Y-ABRIR-TORRENTS.cmd`.
Esta versión utiliza `tar.exe`, incluido en Windows 10, para admitir mejor rutas
largas. Si la carpeta está dentro de OneDrive y falla, muévela a `C:\Torrents`.

Los tres archivos `windows/*.parte-*` son partes del mismo ZIP. Deben permanecer
juntos dentro de la carpeta `windows`; no se abren uno por uno.

La aplicación extraída queda en:

```text
torrents-portable-windows-x64-0.2.0/
```

Para usos posteriores, abre `Abrir-Torrents.cmd` dentro de esa carpeta. La dirección
local es `http://127.0.0.1:5173` y solo funciona mientras su ventana del servidor
permanezca abierta.

## Dónde está el MDT

La entrega preparada ya contiene:

```text
torrents-portable-windows-x64-0.2.0/
└── .data/
    ├── surface-selection.json
    └── surfaces/
        └── pnoa-bal-462-4382-v1/
            ├── dtm.tif
            ├── surface.json
            ├── checksums.json
            └── tiles/
```

Esa ubicación es local al ordenador. Los proyectos y la base SQLite se guardan
también en `.data`. Para conservarlos, cierra la aplicación y copia la carpeta
`.data` completa.

`mdt/mdt-piloto-v1.zip` es una copia independiente del MDT. Sirve para importarlo
en otra instalación mediante `Importar-MDT.cmd`.

## Verificación

SHA-256 de la aplicación reconstruida:

```text
74909fb90ff17156f7f2689ba42bc206afed7cd7e807f2fe8e09ccc7d8b0a3f5
```

SHA-256 del MDT independiente:

```text
d8003dc9ae3b15c7cbf5f5802fe86f23e317065b836b444b493c366eef175b5c
```

El paquete incluye Node y Python; no es necesario instalarlos aparte. Está montado
con runtimes oficiales x64 y su contenido se ha verificado, pero todavía falta una
prueba completa en un ordenador Windows real. No es un instalador `.exe` firmado.

El MDT piloto conserva celdas de 1,5 m y teselas multirresolución para visualizarlo
con agilidad. Su datum vertical y precisión siguen pendientes de validación. La app
permite visualizar, consultar cotas y perfiles; los análisis hidrológicos estáticos
tipo cuencas, acumulación y depresiones todavía no están implementados.
