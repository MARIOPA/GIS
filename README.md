# Descargas de Torrents 0.5.0

## Instalación automática en Windows

Después de descomprimir esta rama, haz doble clic en
`INSTALAR-Y-ABRIR-TORRENTS.cmd`. El lanzador reconstruye y verifica la aplicación,
instala la versión 0.5.0 con el MDT y abre Torrents. No hay que abrir CMD, escribir
comandos ni ejecutar actualizaciones intermedias.

Los lanzadores antiguos `PREPARAR-Y-ABRIR-TORRENTS.cmd` y
`REPARAR-Y-ABRIR-TORRENTS.cmd` redirigen al mismo instalador automático.

## Actualización 0.5.0: controles mediante barras

Quien ya tenga la aplicación preparada puede descargar únicamente
`updates/0.5.0/actualizacion-torrents-0.5.0.zip`, extraerla dentro de
`C:\Torrents\GIS-downloads` y ejecutar `ACTUALIZAR-TORRENTS-0.5.cmd`.

- La red cambia entre **Detallada**, **Media** y **Principal** mediante una barra.
- Las curvas cambian entre **0,25, 5, 10 y 20 m** mediante otra barra.
- El actualizador conserva los proyectos y vuelve a abrir Torrents.

SHA-256 de la actualización:

```text
43f6ec3b9b3610dc5e323b88c7e31f73fd17481e8c7b4cb95ed68c326207e8dd
```

## Actualización 0.4.0: hidrología D8 y curvas de 0,25 m

Si ya funciona Torrents 0.2.0/0.3.0, descarga
`updates/0.4.0/actualizacion-torrents-0.4.0.zip`, extráelo dentro de
`C:\Torrents\GIS-downloads` y ejecuta `ACTUALIZAR-TORRENTS-0.4.cmd`.

El actualizador encuentra la carpeta `torrents-portable-windows-x64-0.2.0`,
conserva sus proyectos, instala la aplicación 0.4.0 y deja seleccionada la
superficie v3. El ZIP ya incluye el MDT v3; no hay que importarlo aparte.

Novedades:

- curvas de nivel de 0,25 m en teselas para la vista cercana;
- relleno de depresiones mediante Priority-Flood;
- dirección D8 y acumulación en área aportante;
- red de flujo filtrable desde 0,25, 1 o 5 ha;
- capas para visualizar acumulación y relleno de depresiones.

SHA-256 de la actualización:

```text
3a9899adf7af04b19aad624926363db87da8ab14327949a805598f29c3bc06cb
```

La superficie independiente está en `updates/0.4.0/mdt-piloto-v3.zip` y su
SHA-256 es:

```text
58c6ed06061bd1b188d508fe57263f1b33a52254c65abee455dfb860c3211017
```

Los resultados hidrológicos son topográficos y provisionales. El borde de la
tesela se considera abierto; no incluyen lluvia, inundación, alcantarillas,
puentes, edificios, rugosidad o infiltración.

## Actualización 0.3.0: relieve y curvas de nivel

Quien ya tenga la aplicación 0.2.0 debe descargar únicamente
`updates/0.3.0/actualizacion-torrents-0.3.0.zip`, extraer su carpeta dentro de
`C:\Torrents\GIS-downloads` y ejecutar `ACTUALIZAR-TORRENTS-0.3.cmd`.

La actualización conserva `.data`, los proyectos y la superficie anterior. Añade
una superficie v2 con elevación y sombreado separados, además de curvas de nivel
seleccionables cada 5, 10 o 20 m. También guarda una copia local del código 0.2.0.

SHA-256 de la actualización:

```text
ef6022033838a32692366bc09da223f9851350904287d611434fe4d0eda01353
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
con agilidad. Su datum vertical y precisión siguen pendientes de validación. La
versión 0.4.0 añade el análisis D8 provisional descrito arriba; el intervalo vertical
de curvas de 0,25 m no aumenta la resolución horizontal del MDT.
