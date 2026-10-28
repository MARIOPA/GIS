#!/usr/bin/env python3
"""Exercise the shipped Linux ZIP after extraction and after user-profile installation."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import tempfile
import time
import urllib.request
import zipfile


def run(args, **kw):
    return subprocess.run([str(a) for a in args], check=True, text=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kw)


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def exercise(root, browser_output=None):
    port = free_port()
    env = {**os.environ, 'PORT': str(port), 'TORRENTS_NO_BROWSER': '1'}
    env.pop('DATA_DIR', None)
    env.pop('TERRAIN_DIR', None)
    env.pop('TORRENTS_PYTHON', None)
    process = subprocess.Popen(['bash', str(root / 'abrir-torrents.sh')], env=env,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    base = f'http://127.0.0.1:{port}'
    def request(path, payload=None):
        body = None if payload is None else json.dumps(payload).encode()
        req = urllib.request.Request(base + path, data=body, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.read()
    try:
        for _ in range(100):
            if process.poll() is not None:
                raise RuntimeError(process.communicate()[1].decode())
            try:
                health = json.loads(request('/api/health'))
                break
            except (OSError, TimeoutError):
                time.sleep(0.1)
        else:
            raise RuntimeError('Timeout de arranque del paquete.')
        assert health['version'] == '0.5.0'
        assert json.loads(request('/api/session'))['authenticated']
        assert b'<div id="root"' in request('/')
        terrain = json.loads(request('/api/capabilities'))['terrain']
        assert terrain['raster']['count'] == 50
        assert terrain['raster']['maxzoom'] == 17
        active = root / '.data/surfaces/pnoa-bal-462-4382-v3'
        tiles = []
        for z in [8, 12, 15, 17]:
            file = next((active / 'tiles' / str(z)).rglob('*.png'))
            route = '/api/terrain/' + file.relative_to(active).as_posix()
            before = time.perf_counter()
            content = request(route)
            elapsed = (time.perf_counter() - before) * 1000
            assert hashlib.sha256(content).digest() == hashlib.sha256(file.read_bytes()).digest()
            tiles.append({'zoom': z, 'bytes': len(content), 'local_request_ms': round(elapsed, 2)})
        center = {'lng': 2.563335168324104, 'lat': 39.582393159305624}
        before = time.perf_counter()
        point = json.loads(request('/api/terrain/elevation', center))
        point_ms = (time.perf_counter() - before) * 1000
        assert abs(point['elevation'] - 382.87677001953125) < 1e-5
        profile = json.loads(request('/api/terrain/profile', {'geometry': {'type': 'LineString',
                    'coordinates': [[center['lng'] - 0.001, center['lat']], [center['lng'] + 0.001, center['lat']]]}}))
        assert profile['length_m'] > 100
        assert sum(s['elevation'] is not None for s in profile['samples']) > 50
        project = {'version': 1, 'name': 'Prueba del paquete portable',
                   'features': {'type': 'FeatureCollection', 'features': []}, 'layers': [],
                   'rainfall': 50, 'basemap': 'local',
                   'view': {'center': [center['lng'], center['lat']], 'zoom': 15, 'bearing': 0, 'pitch': 0}}
        created = json.loads(request('/api/projects', project))
        assert json.loads(request('/api/projects/' + created['id'])) == project
        browser_result = None
        if browser_output:
            module = (Path(__file__).resolve().parents[1] / 'node_modules/@playwright/test/index.mjs').as_uri()
            driver = '''
import { chromium } from MODULE;
const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[], failed=[], zooms=new Set();
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{
  if(!r.url().includes('/api/terrain/tiles/'))return;
  const match=r.url().match(/\\/tiles\\/(\\d+)\\/\\d+\\/\\d+\\.png/);
  if(r.status()>=400 || !match)failed.push(r.url());
  else zooms.add(Number(match[1]));
});
await page.goto(BASE);
await page.getByRole('button',{name:/Base local Natural Earth/}).click();
await page.locator('.map-loading').waitFor({state:'hidden'});
const focus=page.getByRole('button',{name:'Ver piloto LiDAR',exact:true});
if(!await focus.isVisible())await page.getByRole('button',{name:'Elevation',exact:true}).click();
await focus.click();
await page.waitForTimeout(1800);
await page.screenshot({path:SCREENSHOT});
await page.locator('.maplibregl-canvas').hover();
await page.mouse.wheel(0,-650);
await page.waitForTimeout(1800);
await page.mouse.wheel(0,1150);
await page.waitForTimeout(1800);
console.log(JSON.stringify({errors,failed,zooms:[...zooms]}));
await browser.close();
if(errors.length||failed.length||zooms.size<2)process.exit(1);
'''.replace('MODULE', json.dumps(module)).replace('BASE', json.dumps(base)).replace('SCREENSHOT', json.dumps(str(browser_output)))
            result = run([root / 'runtime/node/bin/node', '--input-type=module', '-e', driver])
            browser_result = json.loads(result.stdout)
        return {'health': health, 'tiles': tiles, 'point': point, 'point_request_ms': round(point_ms, 2),
                'profile_samples': len(profile['samples']), 'profile_length_m': profile['length_m'],
                'project_roundtrip': True, 'browser': browser_result}
    finally:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.communicate(timeout=8)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.communicate()


def verify(output):
    report = {'linux_zip_executed': True, 'windows_native_execution_tested': False}
    with tempfile.TemporaryDirectory(prefix='torrents-paquete-') as temporary:
        base = Path(temporary) / 'prueba con espacios y ñ'
        base.mkdir()
        package = output / 'torrents-linux-x64-0.5.0.zip'
        with zipfile.ZipFile(package) as archive:
            assert archive.testzip() is None
            for info in archive.infolist():
                archive.extract(info, base)
                mode = (info.external_attr >> 16) & 0o777
                if mode:
                    (base / info.filename).chmod(mode)
        portable = base / 'torrents-linux-x64-0.5.0'
        run([portable / 'runtime/python/bin/python3', '-c', 'import rasterio,numpy,pyproj'])
        run(['bash', portable / 'importar-mdt.sh', output / 'mdt-piloto-v3.zip'])
        report['portable'] = exercise(portable, output / 'mdt-multirresolucion.png')
        target = base / 'perfil instalado'
        installed = run(['bash', portable / 'instalar-linux.sh', target])
        assert not (target / '.data').exists(), 'El instalador copió datos personales de la copia original.'
        run(['bash', target / 'importar-mdt.sh', output / 'mdt-piloto-v3.zip'])
        report['installed'] = exercise(target)
        rejected = subprocess.run(['bash', portable / 'instalar-linux.sh', target], text=True, capture_output=True)
        assert rejected.returncode != 0
        env = {**os.environ, 'HOST': '0.0.0.0', 'PORT': str(free_port())}
        restricted = subprocess.run([target / 'runtime/node/bin/node', target / 'server/index.mjs', '--local'], env=env, text=True, capture_output=True)
        assert restricted.returncode != 0 and 'localhost' in restricted.stderr
        report['existing_install_preserved'] = True
        report['local_mode_refuses_network_binding'] = True
    for name in ['torrents-windows-x64-0.5.0.zip', 'torrents-portable-windows-x64-0.5.0.zip']:
        with zipfile.ZipFile(output / name) as archive:
            assert archive.testzip() is None
            names = archive.namelist()
            assert any(n.endswith('/runtime/node/node.exe') for n in names)
            assert any(n.endswith('/runtime/python/python.exe') for n in names)
            assert any(n.endswith('/Abrir-Torrents.cmd') for n in names)
            assert any('rasterio/_base.cp312-win_amd64.pyd' in n for n in names)
            assert not any('/.data/' in n or n.endswith(('.laz', '.tif', '.sqlite')) for n in names)
    report['windows_archives_crc_and_contents_verified'] = True
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    report = verify(args.output.resolve())
    (args.output / 'VERIFICACION-PAQUETES.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2, ensure_ascii=False))
