/**
 * vault.config.ts
 *
 * Resolves all runtime secrets from AWS Secrets Manager.
 * No secret values are ever hardcoded or read from plain .env files
 * in production. In local development, falls back to process.env for
 * developer convenience.
 *
 * Usage:
 *   const secrets = await VaultConfig.load();
 *   const dbUrl = secrets.DATABASE_URL;
 */

import {
    SecretsManagerClient,
    GetSecretValueCommand,
    GetSecretValueCommandOutput,
} from '@aws-sdk/client-secrets-manager';

export interface QalNetSecrets {
    DATABASE_URL: string;
    JWT_PRIVATE_KEY: string;    // RS256 private key (PEM format)
    JWT_PUBLIC_KEY: string;     // RS256 public key  (PEM format)
    ARGON2_PEPPER: string;      // Extra pepper mixed into Argon2id hashing
    REDIS_URL: string;          // Redis connection for Redlock + caching
    CHAPA_SECRET_KEY: string;   // Chapa payment gateway secret
    TELEBIRR_APP_KEY: string;   // Telebirr B2C app key
    TELEBIRR_APP_SECRET: string;
    PGCRYPTO_SYMMETRIC_KEY: string; // Application-layer pgcrypto key for Fayda ID
    ADMIN_BOOTSTRAP_TOKEN: string;  // One-time token for seeding the first Admin user
}

// Name of the secret stored in AWS Secrets Manager
const SECRET_NAME = process.env.AWS_SECRET_NAME ?? 'qalnet/production/secrets';
const AWS_REGION = process.env.AWS_REGION ?? 'us-east-1';

/**
 * Fetches the QalNet secret bundle from AWS Secrets Manager.
 * Returns a strongly-typed object so the rest of the app never
 * needs to know where secrets come from.
 */
async function fetchFromAWS(): Promise<QalNetSecrets> {
    const client = new SecretsManagerClient({ region: AWS_REGION });

    const response: GetSecretValueCommandOutput = await client.send(
        new GetSecretValueCommand({ SecretId: SECRET_NAME }),
    );

    if (!response.SecretString) {
        throw new Error(
            `[VaultConfig] AWS Secrets Manager returned an empty secret for "${SECRET_NAME}". ` +
            'Ensure the secret is stored as a JSON string.',
        );
    }

    return JSON.parse(response.SecretString) as QalNetSecrets;
}

/**
 * Builds a local secrets object from process.env for development.
 * All fields are required — missing values will throw at startup
 * so misconfigured dev environments fail fast.
 */
function loadFromEnv(): QalNetSecrets {
    const required: (keyof QalNetSecrets)[] = [
        'DATABASE_URL',
        'JWT_PRIVATE_KEY',
        'JWT_PUBLIC_KEY',
        'ARGON2_PEPPER',
        'REDIS_URL',
        'CHAPA_SECRET_KEY',
        'TELEBIRR_APP_KEY',
        'TELEBIRR_APP_SECRET',
        'PGCRYPTO_SYMMETRIC_KEY',
        'ADMIN_BOOTSTRAP_TOKEN',
    ];

    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(
            `[VaultConfig] Missing required environment variables: ${missing.join(', ')}. ` +
            'Copy .env.example to .env and fill in the values.',
        );
    }

    return {
        DATABASE_URL: process.env.DATABASE_URL!,
        JWT_PRIVATE_KEY: process.env.JWT_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        JWT_PUBLIC_KEY: process.env.JWT_PUBLIC_KEY!.replace(/\\n/g, '\n'),
        ARGON2_PEPPER: process.env.ARGON2_PEPPER!,
        REDIS_URL: process.env.REDIS_URL!,
        CHAPA_SECRET_KEY: process.env.CHAPA_SECRET_KEY!,
        TELEBIRR_APP_KEY: process.env.TELEBIRR_APP_KEY!,
        TELEBIRR_APP_SECRET: process.env.TELEBIRR_APP_SECRET!,
        PGCRYPTO_SYMMETRIC_KEY: process.env.PGCRYPTO_SYMMETRIC_KEY!,
        ADMIN_BOOTSTRAP_TOKEN: process.env.ADMIN_BOOTSTRAP_TOKEN!,
    };
}

/**
 * VaultConfig singleton.
 * Call VaultConfig.load() once at application bootstrap (in main.ts).
 * Subsequent calls return the cached result — no extra AWS round trips.
 */
export class VaultConfig {
    private static cache: QalNetSecrets | null = null;

    /**
     * Loads secrets from AWS Secrets Manager in production,
     * or from process.env in development (NODE_ENV !== 'production').
     */
    static async load(): Promise<QalNetSecrets> {
        if (VaultConfig.cache) {
            return VaultConfig.cache;
        }

        const isProduction = process.env.NODE_ENV === 'production';

        VaultConfig.cache = isProduction
            ? await fetchFromAWS()
            : loadFromEnv();

        return VaultConfig.cache;
    }

    /** Clears the cache — useful for tests only. */
    static clearCache(): void {
        VaultConfig.cache = null;
    }
}
