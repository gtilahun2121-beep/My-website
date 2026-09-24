/**
 * fayda.service.ts
 *
 * Real Fayda (Ethiopian National Digital ID) eSignet OIDC integration.
 *
 * Flow (Authorization Code + PKCE, client assertion a/k/a private_key_jwt):
 *   1. initiate() → builds the eSignet /authorize URL. The browser is
 *      redirected there; the citizen authenticates with their national ID
 *      number (FIN) and a real OTP delivered by the Fayda system itself
 *      (eSignet test environment OTP is "111111").
 *   2. eSignet redirects back to FAYDA_REDIRECT_URI with ?code=...&state=...
 *   3. verify() → we look up the one-time code_verifier stored for that
 *      state, exchange the code at the token endpoint authenticating with
 *      a signed JWT client_assertion (RS256, private JWK), then fetch the
 *      verified identity from the userinfo endpoint.
 *
 * Modes:
 *   - sandbox (default): no network calls — returns a deterministic mock
 *     identity so the flow is testable without eSignet credentials.
 *   - live (FAYDA_MODE=live): calls the real eSignet endpoints and FAILS
 *     LOUDLY when credentials are missing (mirrors the SMS policy).
 *
 * Configuration (environment variables):
 *   FAYDA_MODE                     sandbox (default) | live
 *   FAYDA_AUTHORIZATION_ENDPOINT   default https://esignet.ida.fayda.et/authorize
 *   FAYDA_TOKEN_ENDPOINT           default https://esignet.ida.fayda.et/v1/esignet/oauth/v2/token
 *   FAYDA_USERINFO_ENDPOINT        default https://esignet.ida.fayda.et/v1/esignet/oidc/userinfo
 *   FAYDA_CLIENT_ID                eSignet relying-party client id
 *   FAYDA_PRIVATE_KEY              base64-encoded JWK RSA private key used to
 *                                  sign the client assertion (RS256)
 *   FAYDA_REDIRECT_URI             callback URL registered with eSignet
 *   FAYDA_SCOPES                   default "openid profile"
 */

import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomBytes, createHash, createPrivateKey } from 'crypto';
import * as jwt from 'jsonwebtoken';

export interface FaydaVerifiedIdentity {
    verified: boolean;
    sub?: string;
    name?: string;
    phone?: string;
    birthdate?: string;
    gender?: string;
    address?: {
        region?: string;
        zone?: string;
        woreda?: string;
        kebele?: string;
    };
    residenceStatus?: string;
    picture?: string;
    provider: 'fayda' | 'fayda-sandbox';
}

export interface FaydaInitiateResult {
    authUrl: string;
    state: string;
    expiresIn: number;
    mode: 'sandbox' | 'live';
}

interface PendingCode {
    codeVerifier: string;
    expiresAt: number;
}

@Injectable()
export class FaydaService {
    private readonly logger = new Logger(FaydaService.name);

    /** eSignet RSA-JWK private key (live client-assertion signing). */
    private readonly privateKey?: ReturnType<typeof createPrivateKey>;

    private readonly sessions = new Map<string, PendingCode>();
    private static readonly SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

    constructor() {
        this.mode = process.env.FAYDA_MODE === 'live' ? 'live' : 'sandbox';
        const jwk = this.loadPrivateJwk(process.env.FAYDA_PRIVATE_KEY ?? '');
        if (this.isLive && !jwk) {
            this.logger.warn('[FaydaService] FAYDA_MODE=live requires FAYDA_CLIENT_ID and FAYDA_PRIVATE_KEY.');
        }
        if (jwk) {
            try {
                this.privateKey = createPrivateKey({ key: jwk, format: 'jwk' });
            } catch (err) {
                this.logger.error(`[FaydaService] Could not parse FAYDA_PRIVATE_KEY as a JWK: ${(err as Error).message}`);
            }
        }
    }

    readonly mode: 'sandbox' | 'live';

    private get enabled(): boolean {
        return process.env.FAYDA_ENABLED === 'true';
    }

    get isLive(): boolean {
        return this.mode === 'live';
    }

    /** Live mode is usable only when the eSignet client credentials are present. */
    get isConfigured(): boolean {
        return Boolean(
            this.isLive &&
            this.enabled &&
            (process.env.FAYDA_CLIENT_ID ?? '').length > 0 &&
            Boolean(this.privateKey) &&
            (process.env.FAYDA_REDIRECT_URI ?? '').length > 0,
        );
    }

    /** Exposes integration state to the frontend so it can pick the correct signup path. */
    status(): { enabled: boolean; mode: 'sandbox' | 'live'; configured: boolean } {
        return {
            enabled: this.enabled,
            mode: this.mode,
            configured: this.isConfigured,
        };
    }

    private get clientId(): string {
        return process.env.FAYDA_CLIENT_ID ?? '';
    }

    private get redirectUri(): string {
        return process.env.FAYDA_REDIRECT_URI ?? '';
    }

    private get scopes(): string {
        return process.env.FAYDA_SCOPES ?? 'openid profile';
    }

    private get authEndpoint(): string {
        return (
            process.env.FAYDA_AUTHORIZATION_ENDPOINT ??
            'https://esignet.ida.fayda.et/authorize'
        );
    }

    private get tokenEndpoint(): string {
        return (
            process.env.FAYDA_TOKEN_ENDPOINT ??
            'https://esignet.ida.fayda.et/v1/esignet/oauth/v2/token'
        );
    }

    private get userinfoEndpoint(): string {
        return (
            process.env.FAYDA_USERINFO_ENDPOINT ??
            'https://esignet.ida.fayda.et/v1/esignet/oidc/userinfo'
        );
    }

    /**
     * Initiates a Fayda eSignet login. Returns the authorize URL (plus the
     * state that must be kept to complete this session) and stores the PKCE
     * code_verifier server-side keyed by state.
     */
    async initiate(): Promise<FaydaInitiateResult> {
        if (this.isLive && !this.isConfigured) {
            throw new ServiceUnavailableException(
                'Fayda eSignet integration is not configured. Contact support.',
            );
        }

        if (!this.isLive) {
            // Sandbox: deterministic mock authorize URL — user can complete the
            // flow with any code, or just call verify() directly.
            const sandboxState = `fayda-sandbox-${randomBytes(8).toString('hex')}`;
            this.sessions.set(sandboxState, {
                codeVerifier: 'sandbox-verifier',
                expiresAt: Date.now() + FaydaService.SESSION_TTL_MS,
            });
            return {
                authUrl: `${this.authEndpoint}?client_id=sandbox&response_type=code&scope=openid&state=${sandboxState}`,
                state: sandboxState,
                expiresIn: 600,
                mode: 'sandbox',
            };
        }

        const state = randomBytes(16).toString('hex');
        const nonce = randomBytes(16).toString('hex');
        const codeVerifier = this.generateCodeVerifier();
        const codeChallenge = this.generateCodeChallenge(codeVerifier);

        this.sessions.set(state, {
            codeVerifier,
            expiresAt: Date.now() + FaydaService.SESSION_TTL_MS,
        });

        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: 'code',
            scope: this.scopes,
            state,
            nonce,
            prompt: 'login',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
        });

        const authUrl = `${this.authEndpoint}?${params.toString()}`;
        this.logger.log('[FaydaService] eSignet authorization URL built.');
        return { authUrl, state, expiresIn: 600, mode: 'live' };
    }

    /**
     * Completes the eSignet flow: exchanges the authorization code for tokens
     * (client assertion) and returns the verified identity from userinfo.
     */
    async verify(code: string, state: string): Promise<FaydaVerifiedIdentity> {
        if (!this.isLive) {
            return this.verifySandbox(code, state);
        }

        const pending = this.takeSession(state);
        if (!pending) {
            throw new ServiceUnavailableException('Fayda session expired or invalid. Please try again.');
        }

        try {
            const tokens = await this.exchangeCodeForTokens(pending.codeVerifier, code);
            const identity = await this.getUserInfo(tokens.access_token);
            return { ...identity, provider: 'fayda' };
        } catch (err) {
            this.logger.error(`[FaydaService] eSignet verification failed: ${(err as Error).message}`);
            throw new ServiceUnavailableException('Fayda verification failed. Please try again.');
        }
    }

    // ── Live eSignet calls ──────────────────────────────────────────────────

    private async exchangeCodeForTokens(codeVerifier: string, code: string): Promise<{ access_token: string; id_token?: string }> {
        if (!this.isConfigured || !this.privateKey) {
            throw new ServiceUnavailableException('Fayda eSignet integration is not configured.');
        }

        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: this.redirectUri,
            client_id: this.clientId,
            code_verifier: codeVerifier,
            client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            client_assertion: this.buildClientAssertion(),
        });

        const res = await fetch(this.tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        });

        const data = (await res.json().catch(() => null)) as
            | { access_token?: string; id_token?: string; error?: string; error_description?: string }
            | null;

        if (!res.ok || !data?.access_token) {
            const detail = data?.error_description ?? data?.error ?? `HTTP ${res.status}`;
            throw new Error(`Fayda token exchange failed: ${detail}`);
        }

        return { access_token: data.access_token, id_token: data.id_token };
    }

    private async getUserInfo(accessToken: string): Promise<FaydaVerifiedIdentity> {
        const res = await fetch(this.userinfoEndpoint, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        if (!res.ok || !data) {
            throw new Error(`Fayda userinfo failed: HTTP ${res.status}`);
        }

        const rawAddress = (data.address ?? {}) as Record<string, unknown>;
        return {
            verified: true,
            sub: typeof data.sub === 'string' ? data.sub : undefined,
            name: typeof data.name === 'string' ? data.name : undefined,
            phone: typeof data.phone === 'string' ? data.phone : undefined,
            birthdate: typeof data.birthdate === 'string' ? data.birthdate : undefined,
            gender: typeof data.gender === 'string' ? data.gender : undefined,
            address: {
                region: typeof rawAddress.region === 'string' ? rawAddress.region : undefined,
                zone: typeof rawAddress.zone === 'string' ? rawAddress.zone : undefined,
                woreda: typeof rawAddress.woreda === 'string' ? rawAddress.woreda : undefined,
                kebele: typeof rawAddress.kebele === 'string' ? rawAddress.kebele : undefined,
            },
            residenceStatus: typeof data.residenceStatus === 'string' ? data.residenceStatus : undefined,
            picture: typeof data.picture === 'string' ? data.picture : undefined,
            provider: 'fayda',
        };
    }

    // ── Sandbox ├── mock mode ─────────────────────────────────────────────────

    private verifySandbox(code: string, state: string): FaydaVerifiedIdentity {
        const pending = this.takeSession(state);
        if (!pending || !code) {
            throw new ServiceUnavailableException('Fayda session expired or invalid. Please try again.');
        }
        return {
            verified: true,
            sub: `fayda-sandbox-${state.slice(-8)}`,
            name: 'Alem Tesfaye',
            phone: '+251911000000',
            birthdate: '1995-05-20',
            gender: 'female',
            address: { region: 'Addis Ababa', zone: 'Yeka', woreda: '08', kebele: '05' },
            residenceStatus: 'citizen',
            provider: 'fayda-sandbox',
        };
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private takeSession(state: string): PendingCode | undefined {
        const pending = this.sessions.get(state);
        if (pending) {
            this.sessions.delete(state);
            if (pending.expiresAt < Date.now()) {
                return undefined;
            }
        }
        return pending;
    }

    private generateCodeVerifier(): string {
        return randomBytes(32).toString('base64url');
    }

    private generateCodeChallenge(verifier: string): string {
        return createHash('sha256').update(verifier).digest('base64url');
    }

    /**
     * Signs a JWT (RS256) with the eSignet client's private JWK.
     * aud = token endpoint, iss = sub = client_id, per RFC 7523.
     */
    private buildClientAssertion(): string {
        if (!this.privateKey) {
            throw new ServiceUnavailableException('Fayda eSignet private key is missing.');
        }
        const now = Math.floor(Date.now() / 1000);
        return jwt.sign(
            {
                iss: this.clientId,
                sub: this.clientId,
                aud: this.tokenEndpoint,
                jti: randomBytes(16).toString('hex'),
                iat: now,
                exp: now + 60,
            },
            this.privateKey,
            { algorithm: 'RS256' },
        );
    }

    private loadPrivateJwk(base64: string): import('crypto').JsonWebKey | undefined {
        if (!base64) return undefined;
        try {
            const json = Buffer.from(base64, 'base64').toString('utf8');
            const parsed = JSON.parse(json) as import('crypto').JsonWebKey;
            return parsed.kty ? parsed : undefined;
        } catch {
            return undefined;
        }
    }
}