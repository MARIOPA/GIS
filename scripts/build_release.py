#!/usr/bin/env python3
"""Build separate source, Windows/Linux runtime packages and a SharePoint data handoff."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = '0.4.0'
CACHE = Path('/tmp/torrents-release-cache')
PY_RELEASE = 'https://github.com/astral-sh/python-build-standalone/releases/download/20251014/'
DOWNLOADS = {
    'python-linux.tar.gz': (PY_RELEASE + 'cpython-3.12.12%2B20251014-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz', 'c74addcd1b033a6e4d60ead3ab47fcc995569027e01d3061c4a934f363c4a0cf'),
    'python-windows.tar.gz': (PY_RELEASE + 'cpython-3.12.12%2B20251014-x86_64-pc-windows-msvc-install_only_stripped.tar.gz', '3c8b9b10a933909c98b9916297e2093b24a9c2abaa23df1c2622c2bfe052cb94'),
    'node-linux.tar.xz': ('https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-x64.tar.xz', '14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647'),
    'node-windows.zip': ('https://nodejs.org/dist/v24.19.0/node-v24.19.0-win-x64.zip', '57f71ab3652e797d84acddc79c81cc9ff1c6ddb2a1974cdb83f00fee9bff4c73'),
}


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def run(args, **kw):
    subprocess.run([str(a) for a in args], check=True, cwd=ROOT, **kw)


def zip_tree(source, target, prefix=''):
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(source.rglob('*')):
            if path.is_file():
                if path.is_symlink():
                    # Runtime symlinks become regular files so Windows/unzip tools need no privileges.
                    data = path.read_bytes()
                    info = zipfile.ZipInfo(prefix + path.relative_to(source).as_posix())
                    info.external_attr = 0o100755 << 16
                    archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED)
                else:
                    archive.write(path, prefix + path.relative_to(source).as_posix())
    with zipfile.ZipFile(target) as archive:
        if archive.testzip():
            raise ValueError('ZIP corrupto.')
    target.with_suffix(target.suffix + '.sha256').write_text(f'{digest(target)}  {target.name}\n')


def prune_runtime_scripts(destination):
    allowed = {'query_terrain.py', 'import_surface.py', 'surface.mjs', 'launch-local.mjs',
               'pick-surface.mjs', 'install-windows.mjs', 'create-user.mjs'}
    for path in (destination / 'scripts').iterdir():
        if path.is_file() and path.name not in allowed:
            path.unlink()


def refresh(output):
    """Refresh reviewed code/docs without rebuilding immutable runtimes and dependencies."""
    work = ROOT / '.build' / f'release-{VERSION}'
    for system in ['linux', 'windows']:
        destination = work / f'torrents-{system}-x64-{VERSION}'
        if not destination.exists():
            raise ValueError('Primero construye los paquetes completos.')
        for name in ['dist', 'server', 'scripts', 'docs']:
            shutil.copytree(ROOT / name, destination / name, dirs_exist_ok=True,
                            ignore=shutil.ignore_patterns('__pycache__'))
        shutil.copytree(ROOT / 'packaging' / system, destination, dirs_exist_ok=True)
        for name in ['package.json', 'package-lock.json', 'requirements-runtime.lock']:
            shutil.copy2(ROOT / name, destination / name)
        shutil.copy2(ROOT / 'docs/INSTALADORES-Y-SUPERFICIES.md', destination / 'LEEME.md')
        prune_runtime_scripts(destination)
        if system == 'linux':
            for script in destination.glob('*.sh'):
                script.chmod(0o755)
        zip_tree(destination, output / f'torrents-{system}-x64-{VERSION}.zip', destination.name + '/')
    portable = output / f'torrents-portable-windows-x64-{VERSION}.zip'
    with zipfile.ZipFile(output / f'torrents-windows-x64-{VERSION}.zip') as src, zipfile.ZipFile(portable, 'w', zipfile.ZIP_DEFLATED) as dst:
        for info in src.infolist():
            if info.filename.endswith(('Instalar-Windows.cmd', 'scripts/install-windows.mjs')):
                continue
            name = info.filename.replace(f'torrents-windows-x64-{VERSION}/', f'torrents-portable-windows-x64-{VERSION}/', 1)
            dst.writestr(name, src.read(info))
    portable.with_suffix('.zip.sha256').write_text(f'{digest(portable)}  {portable.name}\n')
    source = output / f'torrents-codigo-{VERSION}.zip'
    paths = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=ROOT).decode().split('\0')
    with zipfile.ZipFile(source, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name in sorted(set(p for p in paths if p)):
            p = ROOT / name
            if p.is_file():
                archive.write(p, f'torrents-codigo-{VERSION}/' + name)
    source.with_suffix('.zip.sha256').write_text(f'{digest(source)}  {source.name}\n')
    handoff = output / 'SharePoint-Torrents'
    shutil.copy2(ROOT / 'docs/NOTA-LIDAR-A-MDT.md', handoff / 'INSTRUCCIONES-LIDAR-A-MDT.md')
    zip_tree(handoff, output / 'SharePoint-LIDAR-y-MDT.zip')


def build(output):
    output.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    work = ROOT / '.build' / f'release-{VERSION}'
    if work.exists():
        raise ValueError(f'Ya existe el directorio de preparación: {work}. Conserva o mueve la compilación anterior.')
    work.mkdir(parents=True)
    for filename, (url, expected) in DOWNLOADS.items():
        path = CACHE / filename
        if not path.exists():
            run(['curl', '-fL', '--retry', '2', '--max-time', '300', '-o', path, url])
        if digest(path) != expected:
            raise ValueError(f'Checksum de runtime incorrecto: {filename}')
    run(['npm', 'run', 'build'])
    common = work / 'common'
    common.mkdir()
    for name in ['dist', 'server', 'scripts', 'docs', 'package.json', 'package-lock.json', 'LICENSE', 'requirements-runtime.lock']:
        path = ROOT / name
        if path.is_dir():
            shutil.copytree(path, common / name, ignore=shutil.ignore_patterns('__pycache__'))
        else:
            shutil.copy2(path, common / name)
    shutil.copy2(ROOT / 'docs/INSTALADORES-Y-SUPERFICIES.md', common / 'LEEME.md')
    run(['npm', 'ci', '--prefix', common, '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', '/tmp/torrents-npm-cache'])
    if list((common / 'node_modules').rglob('*.node')):
        raise ValueError('Hay extensiones Node nativas: se requiere compilación específica por plataforma.')
    for system in ['linux', 'windows']:
        print(f'Empaquetando {system}', flush=True)
        destination = work / f'torrents-{system}-x64-{VERSION}'
        shutil.copytree(common, destination)
        shutil.copytree(ROOT / 'packaging' / system, destination, dirs_exist_ok=True)
        runtime = destination / 'runtime'
        runtime.mkdir()
        with tarfile.open(CACHE / f'python-{system}.tar.gz') as archive:
            archive.extractall(runtime, filter='data')
        if system == 'linux':
            with tarfile.open(CACHE / 'node-linux.tar.xz') as archive:
                archive.extractall(runtime, filter='data')
            (runtime / 'node-v24.19.0-linux-x64').rename(runtime / 'node')
            # Remove command-line package managers; installation never needs them.
            for name in ['npm', 'npx', 'corepack']:
                (runtime / 'node/bin' / name).unlink(missing_ok=True)
            shutil.rmtree(runtime / 'node/lib/node_modules', ignore_errors=True)
            site = runtime / 'python/lib/python3.12/site-packages'
            run([sys.executable, '-m', 'pip', 'install', '--only-binary=:all:', '--upgrade', '--target', site,
                 '--cache-dir', '/tmp/torrents-pip-cache', '-r', ROOT / 'requirements-runtime.lock'])
            for script in destination.glob('*.sh'):
                script.chmod(0o755)
        else:
            with zipfile.ZipFile(CACHE / 'node-windows.zip') as archive:
                for name in ['node.exe', 'LICENSE']:
                    target = runtime / 'node' / name
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(archive.read('node-v24.19.0-win-x64/' + name))
            wheels = work / 'windows-wheels'
            wheels.mkdir()
            run([sys.executable, '-m', 'pip', 'download', '--dest', wheels,
                 '--platform', 'win_amd64', '--python-version', '312', '--implementation', 'cp', '--abi', 'cp312',
                 '--only-binary=:all:', '--cache-dir', '/tmp/torrents-pip-cache', '-r', ROOT / 'requirements-runtime.lock'])
            site = runtime / 'python/Lib/site-packages'
            site.mkdir(parents=True, exist_ok=True)
            wheel_checksums = {}
            for wheel in sorted(wheels.glob('*.whl')):
                wheel_checksums[wheel.name] = digest(wheel)
                with zipfile.ZipFile(wheel) as archive:
                    for name in archive.namelist():
                        if name.endswith('/'):
                            continue
                        parts = Path(name).parts
                        if '..' in parts or Path(name).is_absolute():
                            raise ValueError('Ruta de wheel inválida.')
                        if parts[0].endswith('.data'):
                            if parts[1] in ('purelib', 'platlib'):
                                name = '/'.join(parts[2:])
                            else:
                                continue  # Runtime does not use CLI wheel entrypoints/headers.
                        target = site / name
                        target.parent.mkdir(parents=True, exist_ok=True)
                        target.write_bytes(archive.read('/'.join(parts)))
            (runtime / 'wheel-checksums.json').write_text(json.dumps(wheel_checksums, indent=2) + '\n')
        # Developer tool is not needed inside distributed runtimes and must not recursively package itself.
        prune_runtime_scripts(destination)
        (destination / 'RUNTIMES.json').write_text(json.dumps({
            'version': VERSION, 'system': system, 'arch': 'x64', 'node': '24.19.0', 'python': '3.12.12',
            'sources': {k: {'url': u, 'sha256': h} for k, (u, h) in DOWNLOADS.items() if system in k},
            'windows_native_execution_tested': False, 'surface_bundled': False,
        }, indent=2) + '\n')
        zip_tree(destination, output / f'torrents-{system}-x64-{VERSION}.zip', destination.name + '/')
    surface = ROOT / '.data/surfaces/pnoa-bal-462-4382-v3'
    zip_tree(surface, output / 'mdt-piloto-v3.zip')
    handoff = output / 'SharePoint-Torrents'
    (handoff / 'LIDAR').mkdir(parents=True)
    (handoff / 'MDT').mkdir()
    lidar = ROOT / '.data/lidar/PNOA_2024_BAL_462-4382_H31_NPC03.laz'
    shutil.copy2(lidar, handoff / 'LIDAR' / lidar.name)
    shutil.copy2(output / 'mdt-piloto-v3.zip', handoff / 'MDT/mdt-piloto-v3.zip')
    shutil.copy2(output / 'mdt-piloto-v3.zip.sha256', handoff / 'MDT/mdt-piloto-v3.zip.sha256')
    shutil.copy2(ROOT / '.data/lidar/inspection.json', handoff / 'LIDAR/inspection.json')
    shutil.copy2(ROOT / 'docs/NOTA-LIDAR-A-MDT.md', handoff / 'INSTRUCCIONES-LIDAR-A-MDT.md')
    (handoff / 'LIDAR' / (lidar.name + '.sha256')).write_text(f'{digest(lidar)}  {lidar.name}\n')
    zip_tree(handoff, output / 'SharePoint-LIDAR-y-MDT.zip')
    # Source excludes all ignored data, runtimes, credentials, generated artifacts and user databases.
    paths = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=ROOT).decode().split('\0')
    source = output / f'torrents-codigo-{VERSION}.zip'
    with zipfile.ZipFile(source, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name in sorted(set(p for p in paths if p)):
            p = ROOT / name
            if p.is_file():
                archive.write(p, f'torrents-codigo-{VERSION}/' + name)
    source.with_suffix('.zip.sha256').write_text(f'{digest(source)}  {source.name}\n')
    print('Paquetes completos en ' + str(output))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--refresh', action='store_true', help='Actualizar código/guías revisados conservando runtimes ya verificados.')
    args = parser.parse_args()
    if args.refresh:
        refresh(args.output.resolve())
    else:
        build(args.output.resolve())
        refresh(args.output.resolve())
