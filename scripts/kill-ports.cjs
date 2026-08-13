// ========================================================================
// Pre-dev port cleanup
//
// Runs automatically via the root `predev` npm lifecycle hook before
// `turbo dev`. Kills any orphaned dev server still holding ports 4000/3001
// (left over from a previous run that didn't shut down cleanly), which
// otherwise causes an instant EADDRINUSE failure on the next start.
// ========================================================================

const { clearPorts } = require('./dev.cjs');

try {
  clearPorts();
} catch (err) {
  console.error(`[kill-ports] Failed to clear ports: ${err.message}`);
  process.exit(1);
}
