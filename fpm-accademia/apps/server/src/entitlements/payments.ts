import { randomUUID } from 'node:crypto';
import { COMMERCIAL } from '@fpm/shared';
import type { Config } from '../config.js';
import { AppError } from '../errors.js';

/**
 * PaymentProvider: astrazione per l'acquisto UNA TANTUM della licenza docente.
 * Nessun abbonamento, nessun credito, nessuna ricarica.
 *
 * Implementazioni reali (DA FARE, bloccate da account e credenziali esterne):
 *  - Apple App Store (acquisto in-app non consumabile + verifica server-side della transazione)
 *  - Google Play Billing (prodotto in-app una tantum + verifica server-side)
 *  - Stripe Checkout per la versione web (pagamento singolo + webhook firmato)
 * Le regole degli store sui contenuti digitali vanno verificate prima del rilascio.
 */
export interface PurchaseResult {
  provider: string;
  providerRef: string;
  priceCents: number;
  currency: 'EUR';
  isMock: boolean;
}

export interface PaymentProvider {
  readonly id: string;
  readonly isMock: boolean;
  /** Completa (o verifica) un acquisto e restituisce un riferimento univoco verificato. */
  purchaseTeacherLicense(teacherId: string): Promise<PurchaseResult>;
}

/** SOLO SVILUPPO: simula un acquisto e lo etichetta come mock. Mai attivo in produzione. */
export class MockPaymentProvider implements PaymentProvider {
  readonly id = 'mock';
  readonly isMock = true;
  async purchaseTeacherLicense(): Promise<PurchaseResult> {
    return {
      provider: 'mock',
      providerRef: `mock-${randomUUID()}`,
      priceCents: COMMERCIAL.teacherLicensePriceEurCents,
      currency: 'EUR',
      isMock: true,
    };
  }
}

class NotConfiguredPaymentProvider implements PaymentProvider {
  readonly isMock = false;
  constructor(readonly id: string) {}
  async purchaseTeacherLicense(): Promise<PurchaseResult> {
    throw new AppError(
      503,
      'payments_not_configured',
      'I pagamenti reali non sono ancora attivi: servono account e credenziali dello store.',
    );
  }
}

export function createPaymentProvider(config: Config): PaymentProvider {
  if (config.PAYMENT_PROVIDER === 'mock') {
    if (config.NODE_ENV === 'production') return new NotConfiguredPaymentProvider('mock-disabled');
    return new MockPaymentProvider();
  }
  return new NotConfiguredPaymentProvider(config.PAYMENT_PROVIDER);
}
