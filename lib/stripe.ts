import Stripe from 'stripe';

export const CHECKOUT_PAYMENT_METHOD_TYPES = [
  'card',
  'mobilepay',
  'pay_by_bank',
] as const satisfies readonly Stripe.Checkout.SessionCreateParams.AllowedPaymentMethodType[];

/**
 * The Stripe client for server-side calls (Checkout Sessions, webhook
 * verification). Test keys (sk_test_) while the account is in sandbox mode.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY ei ole asetettu.');
  }
  return new Stripe(key);
}
