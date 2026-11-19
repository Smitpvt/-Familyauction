// Render preview screenshots of every team jersey (front / back / sides / three-quarter).
// Requires the Vite dev server (npm run dev in client/) on http://localhost:5173.
// A headless Edge/Chrome opens tools/jersey/preview.html, which renders each view with the
// real Three.js GLTFLoader pipeline and POSTs the frames back to this script.
//
//   node tools/jersey/render_previews.mjs                 # all teams
//   node tools/jersey/render_previews.mjs sherle-warriors # one team
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'previews');
mkdirSync(outDir, { recursive: true });

const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
];
const browser = process.env.BROWSER || BROWSERS.find(existsSync);
if (!browser) throw new Error('No Edge/Chrome found; set BROWSER=/path/to/chrome');

const base = process.env.PREVIEW_URL || 'http://localhost:5174/tools/jersey/preview.html';
const TEAMS = { ratnagiri: [], malgund: [], kotwade: [], sherle: [] };
const VIEWS = process.env.VIEWS || 'front:0,back:180,left:90,right:-90,three-quarter:35,three-quarter-back:215';
const PORT = 5199;

let pending = null;
const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    if (u.pathname === '/save') {
      const file = path.join(outDir, path.basename(u.searchParams.get('file')));
      writeFileSync(file, Buffer.from(body.split(',')[1], 'base64'));
      console.log('  saved', path.relative(process.cwd(), file));
    } else if (u.pathname === '/done' && pending) {
      pending(u.searchParams.get('error') || null, u.searchParams.get('info'));
    }
    res.end('ok');
  });
});
await new Promise((r) => server.listen(PORT, r));

const teams = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TEAMS);
let failed = 0;
for (const team of teams) {
  const url = `${base}?team=${team}&w=${process.env.W || 900}&h=${process.env.H || 900}` +
    `&save=http://localhost:${PORT}&views=${VIEWS}` + (process.env.EXTRA || '');
  const profile = mkdtempSync(path.join(os.tmpdir(), 'hfpl-render-'));
  const proc = spawn(browser, ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--window-size=1000,1100', `--user-data-dir=${profile}`, '--no-first-run', url],
    { stdio: 'ignore' });
  console.log(team);
  const result = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ err: 'timeout' }), 180000);
    pending = (err, info) => { clearTimeout(timer); resolve({ err, info }); };
  });
  // kill the whole headless-browser tree (renderer/GPU children outlive a plain kill on Windows)
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    // Edge detaches its real browser process from the launcher: stop everything using this run's profile
    const leaf = path.basename(profile);
    spawnSync('powershell', ['-NoProfile', '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${leaf}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`],
    { stdio: 'ignore' });
  }
  else proc.kill('SIGKILL');
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* profile still locked */ }
  if (result.err) { failed++; console.log('  ERROR', result.err); } else console.log('  ', result.info);
}
server.close();
process.exit(failed ? 1 : 0);
