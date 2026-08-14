// ========================================================================
// PM2 ecosystem — permanent supervisor for the QalNet apps.
//
// Fixes the recurring "API / localhost died after a few hours" problem:
// PM2 keeps both processes alive, auto-restarts them on crash, and logs
// everything to ~/.pm2/logs. Unlike `nest start --watch` / `next dev`,
// these run the PRODUCTION bundles (no file watcher), so they do not
// spontaneously die on recompile or Windows sleep.
//
// Usage (from repo root):
//   npm run pm2:start     # build once, then start + save the app list
//   npm run pm2:status    # check health
//   npm run pm2:logs      # tail logs
//   npm run pm2:restart   # restart both apps
//   npm run pm2:stop      # stop both apps
//
// IMPORTANT: the backend is intentionally NOT given NODE_ENV=production.
// That flag makes VaultConfig load secrets from AWS Secrets Manager;
// this setup reads the same apps/backend/.env used by `npm run dev`.
// ========================================================================

const path = require('node:path');

module.exports = {
    apps: [
        {
            name: 'qalnet-backend',
            cwd: __dirname,
            script: path.join(__dirname, 'apps/backend/dist/apps/backend/src/main.js'),
            interpreter: 'node',
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            max_restarts: 10,
            restart_delay: 5000,
            min_uptime: '10s',
            watch: false,
            kill_timeout: 10000,
            env: {
                NODE_ENV: 'development',
            },
        },
        {
            name: 'qalnet-web',
            cwd: path.join(__dirname, 'apps/web'),
            script: path.join(__dirname, 'node_modules/next/dist/bin/next'),
            args: 'start -p 3001',
            interpreter: 'node',
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            max_restarts: 10,
            restart_delay: 5000,
            min_uptime: '10s',
            watch: false,
            kill_timeout: 10000,
            env: {
                NODE_ENV: 'production',
            },
        },
    ],
};
