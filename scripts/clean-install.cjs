#!/usr/bin/env node
/*
 * clean-install.cjs — Fix repeated `npm install` failures on Windows.
 *
 * Handles the two classic failure modes:
 *   1. EPERM during cleanup  -> files in node_modules are locked by a running
 *      process (dev server, editor, file explorer, Windows Defender, or a
 *      terminal whose CWD is inside node_modules). We kill orphaned node
 *      processes and delete with retries.
 *   2. ECONNRESET (network)  -> npm can't route to the registry. We flush the
 *      corrupt npm cache and reinstall with fetch retries already configured
 *      in .npmrc.
 *
 * Usage:
 *   node scripts/clean-install.cjs            # safe: deletes node_modules + cache, reinstalls
 *   node scripts/clean-install.cjs --kill     # also force-kills ALL node.exe processes
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const killProcesses = process.argv.includes('--kill');
const skipInstall = process.argv.includes('--no-install');

function run(cmd, args, opts = {}) {
    const res = spawnSync(cmd, args, {
        stdio: 'inherit',
        shell: process.platform === 'win32',
        cwd: opts.cwd || root,
        env: { ...process.env, ...opts.env },
    });
    return res.status ?? -1;
}

function log(step) {
    console.log(`\n─── ${step} ───\n`);
}

function ensureNotInside(nodeModulesPath) {
    if (process.cwd().startsWith(nodeModulesPath)) {
        console.error(
            '\n[ABORT] Your terminal is currently inside node_modules.\n' +
            'Navigate to the repo root first, then re-run this script.'
        );
        process.exit(1);
    }
}

function removeNodeModules() {
    const nm = path.join(root, 'node_modules');
    if (!fs.existsSync(nm)) return console.log('node_modules not present — skipping delete.');
    log(`Deleting node_modules (retrying on locked files)`);

    // A directory still in use can only be emptied, not removed. Loop a few times.
    let removed = false;
    for (let attempt = 1; attempt <= 5 && !removed; attempt++) {
        try {
            fs.rmSync(nm, { recursive: true, force: true, maxRetries: 20, retryDelay: 500 });
            removed = true;
        } catch (err) {
            console.log(`  attempt ${attempt}/5 failed (${err.code || err.message}) — retrying...`);
            if (process.platform === 'win32') {
                // Force-release things Windows still holds open.
                run('taskkill', ['/F', '/IM', 'node.exe', '/T'], { stdio: 'pipe' });
            }
            // Synchronous sleep so retries actually wait.
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
        }
    }
    if (removed) return console.log('  node_modules removed.\n');

    console.error('\n[ERROR] Could not fully delete node_modules.');
    console.error('Close these and re-run:\n  - your terminal if its CWD is inside node_modules');
    console.error('  - VS Code / editors with the node_modules folder open');
    console.error('  - File Explorer windows browsing node_modules');
    console.error('  - Windows Defender/antivirus scans (exclude the repo folder)');
    console.error('\nOr force-kill all node processes with:  node scripts/clean-install.cjs --kill\n');
    process.exit(1);
}

function cleanNpmCache() {
    log('Verifying & cleaning npm cache');
    const code = run('npm', ['cache', 'verify']);
    if (code !== 0) {
        npm('cache', ['clean', '--force']); // corrupt cache blocks reinstalls otherwise
    }
}

function npm(sub, args) {
    const full = [].concat(sub && [sub] || [], args || []);
    return run('npm', full);
}

function reinstall() {
    log('Installing dependencies with retry settings');
    const code = npm(null, [
        'install',
        '--no-audit',
        '--no-fund',
        '--fetch-retries=5',
        '--fetch-retry-mintimeout=20000',
        '--fetch-retry-maxtimeout=120000',
        '--fetch-timeout=600000',
    ]);
    if (code !== 0) {
        console.error('\n[ERROR] npm install failed again.');
        console.error('If it is ECONNRESET, your network/proxy is blocking registry.npmjs.org.');
        console.error('Try: npm install --registry=https://registry.npmjs.org --prefer-online');
        process.exit(code);
    }
    console.log('\n✔ Done. node_modules installed successfully.\n');
}

const nodeModulesPath = path.join(root, 'node_modules');
ensureNotInside(nodeModulesPath);

if (killProcesses) {
    log('Force-killing all node.exe processes');
    run('taskkill', ['/F', '/IM', 'node.exe', '/T']);
} else {
    console.log('Tip: fully kill running node processes with:  --kill');
    console.log('     (e.g. your NestJS/Next dev servers hold locks)');
}

if (!skipInstall) {
    removeNodeModules();
    cleanNpmCache();
    reinstall();
} else {
    removeNodeModules();
}