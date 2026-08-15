/**
 * reference.ts
 *
 * Unique transaction reference generator (Tier 3 recommendation).
 *
 * Every financial transaction must carry a globally unique reference so it can
 * be traced end-to-end and reconciled with the gateway:
 *
 *   QAL-<PROVIDER>-<EQUB>-R<ROUND>-<MEMBER>-<UNIQUEID>
 *
 * Example:
 *   QAL-CHAPA-A1B2C3D4-R3-M9X8Y7Z6-6f1c9a2e
 */

import * as crypto from 'crypto';

/** UUIDs are 36 chars; 8 chars keeps references compact yet collision-safe. */
const SHORT_ID_LENGTH = 8;

function shortId(id: string): string {
    return id.replace(/-/g, '').slice(0, SHORT_ID_LENGTH).toUpperCase();
}

/**
 * Builds a QAL transaction reference.
 *
 * @param provider  Gateway / channel prefix, e.g. 'CHAPA', 'WLT', 'BANK'.
 * @param equbId    Equb group UUID.
 * @param round     Round number the transaction belongs to.
 * @param memberId  Member (user) UUID.
 * @param suffix    Optional custom suffix (defaults to a fresh UUID fragment).
 */
export function buildTransactionReference(
    provider: string,
    equbId: string,
    round: number,
    memberId: string,
    suffix?: string,
): string {
    const unique = (suffix ?? crypto.randomUUID()).replace(/-/g, '').slice(0, SHORT_ID_LENGTH);
    return [
        'QAL',
        provider.toUpperCase(),
        shortId(equbId),
        `R${round}`,
        shortId(memberId),
        unique,
    ].join('-');
}