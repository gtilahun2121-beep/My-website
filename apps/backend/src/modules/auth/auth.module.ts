/**
 * auth.module.ts
 *
 * NestJS module that wires together the auth controller, service,
 * repository, and JWT configuration.
 *
 * JwtModule is registered asynchronously so it can pull the RS256
 * public key from VaultConfig at startup (not at import time).
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { JwtStrategy } from '../../common/guards/jwt.strategy';
import { VaultConfig } from '../../config/vault.config';
import { SmsModule } from '../sms/sms.module';
import { FaydaModule } from './fayda/fayda.module';

@Module({
    imports: [
        SmsModule,
        FaydaModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),

        // Async registration so we can resolve the RS256 public key from Vault
        JwtModule.registerAsync({
            useFactory: async () => {
                const secrets = await VaultConfig.load();
                return {
                    publicKey: secrets.JWT_PUBLIC_KEY,
                    signOptions: { algorithm: 'RS256' },
                    verifyOptions: { algorithms: ['RS256'] },
                };
            },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, AuthRepository, JwtStrategy],
    exports: [AuthService, JwtModule],
})
export class AuthModule { }
