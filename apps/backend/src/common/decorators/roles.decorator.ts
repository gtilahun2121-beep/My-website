/**
 * roles.decorator.ts
 *
 * Custom metadata decorator used with RolesGuard.
 *
 * Usage:
 *   @Roles('admin')
 *   @Roles('host', 'admin')
 */

import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: ('participant' | 'host' | 'admin')[]) =>
    SetMetadata(ROLES_KEY, roles);
