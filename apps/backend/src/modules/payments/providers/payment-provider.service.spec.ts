import { PaymentProviderService } from './payment-provider.service';
import { SandboxPaymentProvider } from './sandbox.provider';

describe('PaymentProviderService', () => {
    const originalMode = process.env.PAYMENT_MODE;

    afterEach(() => {
        if (originalMode === undefined) {
            delete process.env.PAYMENT_MODE;
        } else {
            process.env.PAYMENT_MODE = originalMode;
        }
    });

    it('defaults to sandbox mode', () => {
        delete process.env.PAYMENT_MODE;
        const service = new PaymentProviderService();
        expect(service.currentMode).toBe('sandbox');
    });

    it('resolves every gateway to the sandbox provider in sandbox mode', () => {
        process.env.PAYMENT_MODE = 'sandbox';
        const service = new PaymentProviderService();

        expect(service.resolve('chapa')).toBeInstanceOf(SandboxPaymentProvider);
        expect(service.resolve('telebirr')).toBeInstanceOf(SandboxPaymentProvider);
    });

    it('resolves the real Chapa/Telebirr providers in live mode', () => {
        process.env.PAYMENT_MODE = 'live';
        const service = new PaymentProviderService();

        expect(service.resolve('chapa').name).toBe('chapa');
        expect(service.resolve('telebirr').name).toBe('telebirr');
    });
});

describe('SandboxPaymentProvider', () => {
    const provider = new SandboxPaymentProvider();

    it('creates a deterministic checkout URL', async () => {
        const result = await provider.createCheckout({
            amount: 1000,
            currency: 'ETB',
            txRef: 'QAL-CHAPA-ABC-R1-DEF-1234',
        });
        expect(result.checkoutUrl).toContain('QAL-CHAPA-ABC-R1-DEF-1234');
    });

    it('verifies a matching amount as success', async () => {
        const result = await provider.verifyTransaction({
            txRef: 'QAL-CHAPA-ABC-R1-DEF-1234',
            expectedAmount: 1000,
            amount: 1000,
            currency: 'ETB',
        });
        expect(result.verified).toBe(true);
        expect(result.status).toBe('success');
    });

    it('rejects a mismatched amount', async () => {
        const result = await provider.verifyTransaction({
            txRef: 'QAL-CHAPA-ABC-R1-DEF-1234',
            expectedAmount: 1000,
            amount: 999,
            currency: 'ETB',
        });
        expect(result.verified).toBe(false);
        expect(result.status).toBe('failed');
        expect(result.failureReason).toContain('Amount mismatch');
    });

    it('accepts any signature in sandbox mode', async () => {
        await expect(
            provider.verifyWebhookSignature(Buffer.from('{}'), 'anything'),
        ).resolves.toBe(true);
    });
});