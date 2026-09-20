import { isDatabaseAvailable, isDatabaseStartupDegraded } from './database.config';

describe('database startup fallback', () => {
    const originalStartupFailed = process.env._DB_STARTUP_FAILED;
    const originalUrlCache = process.env._DB_URL_CACHE;

    afterEach(() => {
        if (originalStartupFailed === undefined) {
            delete process.env._DB_STARTUP_FAILED;
        } else {
            process.env._DB_STARTUP_FAILED = originalStartupFailed;
        }

        if (originalUrlCache === undefined) {
            delete process.env._DB_URL_CACHE;
        } else {
            process.env._DB_URL_CACHE = originalUrlCache;
        }
    });

    it('flags degraded mode when the database is unavailable', () => {
        delete process.env._DB_URL_CACHE;
        process.env._DB_STARTUP_FAILED = 'true';

        expect(isDatabaseStartupDegraded()).toBe(true);
        expect(isDatabaseAvailable()).toBe(false);
    });
});
