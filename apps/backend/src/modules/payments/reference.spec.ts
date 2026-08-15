import { buildTransactionReference } from './reference';

describe('buildTransactionReference', () => {
    it('builds the QAL-<PROVIDER>-<EQUB>-R<ROUND>-<MEMBER>-<UNIQUE> format', () => {
        const ref = buildTransactionReference(
            'CHAPA',
            '123e4567-e89b-42d3-a456-426614174000',
            3,
            '98765432-aaaa-bbbb-cccc-111111111111',
            'deadbeef',
        );

        const parts = ref.split('-');
        expect(parts[0]).toBe('QAL');
        expect(parts[1]).toBe('CHAPA');
        expect(parts[2]).toBe('123E4567'); // first 8 hex chars, uppercased
        expect(parts[3]).toBe('R3');
        expect(parts[4]).toBe('98765432');
        expect(parts[5]).toBe('deadbeef');
    });

    it('generates a unique suffix when none is provided', () => {
        const ref1 = buildTransactionReference('WLT', 'e1', 1, 'm1');
        const ref2 = buildTransactionReference('WLT', 'e1', 1, 'm1');
        expect(ref1).not.toBe(ref2);
    });

    it('collapses UUID hyphens into the compact segments', () => {
        const ref = buildTransactionReference(
            'PAY',
            'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            9,
            '11111111-2222-3333-4444-555555555555',
        );
        const parts = ref.split('-');
        expect(parts[2]).toMatch(/^[0-9A-F]{8}$/);
        expect(parts[4]).toMatch(/^[0-9A-F]{8}$/);
    });
});