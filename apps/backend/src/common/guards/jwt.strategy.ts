/**
 * jwt.strategy.ts
 *
 * Passport strategy that validates RS256-signed JWTs on every
 * protected request.
 *
 * It reads the Bearer token from the Authorization header,
 * verifies the RS256 signature against the public key from VaultConfig,
 * and attaches the decoded JwtPayload to request.user.
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { VaultConfig } from '../../config/vault.config';
import { AuthRepository } from '../../modules/auth/auth.repository';
import { JwtPayload } from '../../modules/auth/auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(private readonly authRepository: AuthRepository) {
        // Passport requires a synchronous publicKey at construction time.
        // We use a factory-style workaround: sign with a placeholder and
        // override in validate(). The real public key is injected via
        // JwtModule.registerAsync in auth.module.ts.
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            // secretOrKeyProvider resolves the public key asynchronously
            secretOrKeyProvider: async (
                _request: unknown,
                _rawJwtToken: unknown,
                done: (err: Error | null, key?: string) => void,
            ) => {
                try {
                    const secrets = await VaultConfig.load();
                    done(null, secrets.JWT_PUBLIC_KEY);
                } catch (err) {
                    done(err as Error);
                }
            },
            algorithms: ['RS256'],
        });
    }

    /**
     * Called by Passport after the signature is verified.
     * We re-check that the user still exists and is active —
     * this guards against tokens issued to deactivated accounts.
     */
    async validate(payload: JwtPayload): Promise<JwtPayload> {
        const user = await this.authRepository.findById(payload.sub);

        if (!user || !user.is_active) {
            throw new UnauthorizedException(
                'This account no longer exists or has been deactivated.',
            );
        }

        // Return value is attached to request.user
        return payload;
    }
}
