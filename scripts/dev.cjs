// ========================================================================
// Dev server restart helper
//
// Solves the recurring "localhost refused to connect" / EADDRINUSE issue:
// orphaned dev servers left over from a previous run hold ports 4000/3001,
// so the next `npm run dev` dies instantly. This script kills any process
// listening on those ports, then starts the full monorepo dev servers.
//
// Usage:  npm run dev:restart   (from repo root)
// ========================================================================

const { execSync, spawn } = require('node:child_process');
const path = require('node:path');

const PORTS = [4000, 3001];
const isWin = process.platform === 'win32';

function pidsOnPort(port) {
  const pids = new Set();
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    for (const rawLine of out.split(/\r?\n/)) {
      const line = rawLine.trim();
      const m = line.match(/^TCP\s+(\S+)\s+\S+\s+(\S+)\s+(\d+)$/i);
      if (!m) continue;
      const local = m[1];
      const state = m[2];
      if (local.endsWith(`:${port}`) && /^listen/i.test(state)) {
        pids.add(m[3]);
      }
    }
  } catch (err) {
    console.error(`[dev] Could not inspect port ${port}: ${err.message}`);
  }
  return [...pids];
}

function killPid(pid) {
  try {
    if (isWin) {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      process.kill(Number(pid), 'SIGKILL');
    }
    return true;
  } catch {
    return false;
  }
}

function clearPorts() {
  for (const port of PORTS) {
    const pids = pidsOnPort(port);
    for (const pid of pids) {
      console.log(`[dev] Port ${port} held by PID ${pid} — killing it`);
      killPid(pid);
    }
    if (pids.length === 0) console.log(`[dev] Port ${port} is free`);
  }
}

function main() {
  clearPorts();
  console.log('[dev] Starting dev servers (backend :4000, web :3001)...');
  const root = path.join(__dirname, '..');
  const child = spawn('npm', ['run', 'dev'], {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
  });
  child.on('error', (err) => {
    console.error(`[dev] Failed to start: ${err.message}`);
    process.exit(1);
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

if (require.main === module) {
  main();
}

module.exports = { pidsOnPort, killPid, clearPorts };
