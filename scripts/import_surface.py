#!/usr/bin/env python3
"""Import an offline/synced surface, validating paths, checksums and raster metadata."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import tempfile
import zipfile
import rasterio

MAX_BYTES = 2 * 1024 ** 3
MAX_FILES = 25000


def validate_name(name):
    p = PurePosixPath(name)
    if not name or '\\' in name or ':' in name or p.is_absolute() or any(part in ('.', '..') for part in name.split('/')):
        raise ValueError('Ruta no permitida en el paquete.')
    if p.suffix not in ('.json', '.tif', '.png'):
        raise ValueError('El paquete de superficie solo admite TIFF, PNG y JSON.')
    return p


def import_surface(source, data_dir):
    source, data_dir = Path(source).resolve(), Path(data_dir).resolve()
    surfaces = data_dir / 'surfaces'
    surfaces.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.import-', dir=surfaces) as temporary:
        work = Path(temporary)
        if source.is_file():
            with zipfile.ZipFile(source) as archive:
                infos = archive.infolist()
                if len(infos) > MAX_FILES or sum(i.file_size for i in infos) > MAX_BYTES:
                    raise ValueError('Paquete demasiado grande; límite 2 GiB y 25.000 archivos.')
                names = set()
                for info in infos:
                    if info.is_dir():
                        continue
                    name = str(validate_name(info.filename))
                    if name in names or (info.external_attr >> 16) & 0o170000 == 0o120000:
                        raise ValueError('Archivo duplicado o enlace simbólico.')
                    names.add(name)
                    dst = work / name
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    with archive.open(info) as src, open(dst, 'xb') as out:
                        shutil.copyfileobj(src, out)
        elif source.is_dir():
            checksums = source / 'checksums.json'
            if checksums.stat().st_size > 10_000_000:
                raise ValueError('Manifiesto demasiado grande.')
            records = json.loads(checksums.read_text(encoding='utf-8'))
            if len(records) > MAX_FILES:
                raise ValueError('Demasiados archivos.')
            total = 0
            for name in [*records, 'checksums.json']:
                name = str(validate_name(name))
                src = source / name
                if src.is_symlink() or not src.resolve().is_relative_to(source):
                    raise ValueError('Enlace fuera de la superficie.')
                total += src.stat().st_size
                if total > MAX_BYTES:
                    raise ValueError('Superficie mayor de 2 GiB.')
                dst = work / name
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)
        else:
            raise ValueError('Selecciona un ZIP de superficie o una carpeta sincronizada con SharePoint.')
        records = json.loads((work / 'checksums.json').read_text(encoding='utf-8'))
        actual = {p.relative_to(work).as_posix() for p in work.rglob('*') if p.is_file()}
        if actual != set(records) | {'checksums.json'}:
            raise ValueError('La lista de archivos no coincide con el paquete.')
        for name, record in records.items():
            path = work / str(validate_name(name))
            h = hashlib.sha256()
            with path.open('rb') as f:
                for block in iter(lambda: f.read(1024 * 1024), b''):
                    h.update(block)
            if path.stat().st_size != record['bytes'] or h.hexdigest() != record['sha256']:
                raise ValueError(f'Archivo dañado o incompleto: {name}')
        info = json.loads((work / 'surface.json').read_text(encoding='utf-8'))
        identifier = info.get('id', '')
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,79}', identifier) or info.get('schema_version') != 1:
            raise ValueError('Formato o identificador de superficie incompatible.')
        with rasterio.open(work / 'dtm.tif') as src:
            if src.count != 1 or not src.crs or not src.crs.is_projected or src.tags(ns='IMAGE_STRUCTURE').get('LAYOUT') != 'COG':
                raise ValueError('Se necesita un MDT COG monobanda con CRS proyectado.')
            if src.res[0] != info['native_resolution_m'] or src.res[1] != info['native_resolution_m']:
                raise ValueError('La resolución del MDT no coincide con el manifiesto.')
        dest = surfaces / identifier
        if dest.exists():
            if (dest / 'checksums.json').read_bytes() != (work / 'checksums.json').read_bytes():
                raise ValueError('Ya hay otra versión con ese identificador. No se sobrescriben datos.')
            # A previous import must still be intact before reselecting it.
            for name, record in records.items():
                if hashlib.sha256((dest / name).read_bytes()).hexdigest() != record['sha256']:
                    raise ValueError('La copia instalada está dañada. Conserva una copia y retírala antes de reimportar.')
        else:
            work.rename(dest)
        pointer = data_dir / 'surface-selection.json'
        pending = data_dir / 'surface-selection.json.pending'
        pending.write_text(json.dumps({'id': identifier}) + '\n', encoding='utf-8')
        os.replace(pending, pointer)
        return {'id': identifier, 'directory': str(dest), 'status': info['validation'], 'hydrology_ready': info['hydrology_ready']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('data_dir', type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(import_surface(args.source, args.data_dir), ensure_ascii=False))
    except Exception as error:
        parser.exit(1, f'No se ha importado la superficie: {error}\n')
