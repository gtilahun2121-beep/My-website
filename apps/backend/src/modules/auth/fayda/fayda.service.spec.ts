/**
 * fayda.service.spec.ts
 * Unit tests for the FaydaService (eSignet OIDC) — sandbox mode, live-mode
 * guards, PKCE URL shape, and client-assertion token exchange.
 */

import { ServiceUnavailableException } from '@nestjs/common';
import { generateKeyPairSync, createPublicKey } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { FaydaService } from './fayda.service';

/** Builds a fresh base64-encoded RSA JWK private key for a live-mode test. */
function makeJwkBase64(): string {
    const { privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
    });
    const jwk = privateKey.export({ format: 'jwk' });
    return Buffer.from(JSON.stringify(jwk)).toString('base64');
}

describe('FaydaService (sandbox)', () => {
    let service: FaydaService;

    beforeEach(() => {
        service = new FaydaService();
    });

    it('is in sandbox mode by default and needs no network', async () => {
        expect(service.isLive).toBe(false);
        const res = await service.initiate();
        expect(res.mode).toBe('sandbox');
        expect(typeof res.state).toBe('string');
        expect(res.authUrl).toContain('fayda');
    });

    it('verifies a code/state pair with a deterministic mock identity', async () => {
        const { state } = await service.initiate();
        const identity = await service.verify('any-code', state);
        expect(identity.verified).toBe(true);
        expect(identity.provider).toBe('fayda-sandbox');
        expect(identity.name).toBeTruthy();
        expect(identity.phone).toBeTruthy();
    });

    it('does not accept an unknown/consumed state', async () => {
        const { state } = await service.initiate();
        await service.verify('x', state);
        await expect(service.verify('y', state)).rejects.toThrow(ServiceUnavailableException);
        await expect(service.verify('y', 'no-such-state')).rejects.toThrow(ServiceUnavailableException);
    });
});

describe('FaydaService (live mode)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        process.env.FAYDA_MODE = 'live';
        process.env.FAYDA_ENABLED = 'true';
        process.env.FAYDA_CLIENT_ID = 'test-client';
        process.env.FAYDA_PRIVATE_KEY = makeJwkBase64();
        process.env.FAYDA_REDIRECT_URI = 'http://localhost:3001/auth/fayda/callback';
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('throws when credentials are missing', async () => {
        process.env.FAYDA_CLIENT_ID = '';
        const svc = new FaydaService();
        await expect(svc.initiate()).rejects.toThrow(ServiceUnavailableException);
    });

    it('builds a PKCE authorize URL with client_id, redirect_uri, state and scope', async () => {
        const svc = new FaydaService();
        const { authUrl, state, mode } = await svc.initiate();
        expect(mode).toBe('live');
        expect(state).toHaveLength(32);
        const url = new URL(authUrl);
        expect(url.origin).toBe('https://esignet.ida.fayda.et');
        expect(url.searchParams.get('client_id')).toBe('test-client');
        expect(url.searchParams.get('redirect_uri')).toBe(
            'http://localhost:3001/auth/fayda/callback',
        );
        expect(url.searchParams.get('response_type')).toBe('code');
        expect(url.searchParams.get('scope')).toContain('openid');
        expect(url.searchParams.get('code_challenge_method')).toBe('S256');
        expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(url.searchParams.get('state')).toBe(state);
    });

    it('exchanges the authorization code with an RS256 JWT client assertion', async () => {
        const tokenEndpoint = 'https://esignet.ida.fayda.et/v1/esignet/oauth/v2/token';
        const mockFetch = jest
            .fn()
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ access_token: 'mock-access', id_token: 'mock-id' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }),
            )
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ sub: 'fayda-sub-1', name: 'Alem' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }),
            );
        global.fetch = mockFetch as unknown as typeof fetch;

        const svc = new FaydaService();
        const { state, authUrl } = await svc.initiate();
        const identity = await svc.verify('auth-code-123', state);

        expect(authUrl).not.toBe('');
        expect(mockFetch).toHaveBeenCalledTimes(2); // token exchange + userinfo

        const [tokenCall] = mockFetch.mock.calls;
        expect(String(tokenCall[0])).toBe(tokenEndpoint);
        const body = tokenCall[1].body as URLSearchParams;
        expect(body.get('grant_type')).toBe('authorization_code');
        expect(body.get('code')).toBe('auth-code-123');
        expect(body.get('client_assertion_type')).toBe(
            'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        );

        const assertion = body.get('client_assertion')!;
        const jwk = JSON.parse(
            Buffer.from(process.env.FAYDA_PRIVATE_KEY!, 'base64').toString('utf8'),
        ) as import('crypto').JsonWebKey;
        const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
        const decoded = jwt.verify(assertion, publicKey, { algorithms: ['RS256'] }) as jwt.JwtPayload;
        expect(decoded.iss).toBe('test-client');
        expect(decoded.sub).toBe('test-client');
        expect(decoded.aud).toBe(tokenEndpoint);
        expect(decoded.exp).toBeGreaterThan(decoded.iat!);
        expect(identity.verified).toBe(true);
        expect(identity.provider).toBe('fayda');
    });

    it('maps the verified userinfo attributes', async () => {
        const mockFetch = jest
            .fn()
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ access_token: 'a1' }), { status: 200 }),
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        sub: '1100-fayda-sub',
                        name: 'Alem Tesfaye',
                        birthdate: '1995-05-20',
                        gender: 'female',
                        phone: '+251911000000',
                        address: { region: 'Addis Ababa', woreda: '08' },
                        residenceStatus: 'citizen',
                    }),
                    { status: 200 },
                ),
            );
        global.fetch = mockFetch as unknown as typeof fetch;

        const svc = new FaydaService();
        const { state } = await svc.initiate();
        const identity = await svc.verify('code-1', state);

        expect(identity.name).toBe('Alem Tesfaye');
        expect(identity.phone).toBe('+251911000000');
        expect(identity.birthdate).toBe('1995-05-20');
        expect(identity.address?.region).toBe('Addis Ababa');
        expect(identity.residenceStatus).toBe('citizen');
    });

    it('surfaces a failed token exchange as ServiceUnavailableException', async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValue(
                new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }),
            ) as unknown as typeof fetch;

        const svc = new FaydaService();
        const { state } = await svc.initiate();
        await expect(svc.verify('bad-code', state)).rejects.toThrow(ServiceUnavailableException);
    });
});