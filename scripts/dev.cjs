// ========================================================================
// Dev server restart helper
//
// Solves the recurring "localhost refused to connect" / EADDRINUSE issue:
// orphaned dev servers left over from a previous run hold ports 4000/3001,
// so the next `npm run dev` dies instantly. This script kills any process
// listening on those ports, VERIFIES they actually released them (Windows
// does not always free the socket the instant a process is force-killed,
// and watchers can respawn children), then starts the dev servers.
//
// Usage:  npm run dev:restart   (from repo root)
// ========================================================================

const { execSync, spawn } = require('node:child_process');
const path = require('node:path');

const PORTS = [4000, 3001];
const KILL_RETRIES = 5;
const RETRY_DELAY_MS = 1000;
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

function sleepSync(ms) {
  const sab = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(sab, 0, 0, ms);
}

function clearPorts() {
  for (const port of PORTS) {
    for (let attempt = 1; attempt <= KILL_RETRIES; attempt++) {
      const pids = pidsOnPort(port);
      if (pids.length === 0) {
        if (attempt === 1) console.log(`[dev] Port ${port} is free`);
        break;
      }
      for (const pid of pids) {
        console.log(`[dev] Port ${port} held by PID ${pid} (attempt ${attempt}/${KILL_RETRIES}) — killing it`);
        if (!killPid(pid)) console.error(`[dev] Port ${port}: failed to kill PID ${pid}`);
      }
      if (attempt === KILL_RETRIES) {
        const survivors = pidsOnPort(port);
        throw new Error(
          `Port ${port} still in use by PID ${survivors.join(', ')} after ${KILL_RETRIES} kill attempts. ` +
          `Kill it manually, e.g.: taskkill /F /PID ${survivors[0]}`
        );
      }
      sleepSync(RETRY_DELAY_MS);
    }
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
