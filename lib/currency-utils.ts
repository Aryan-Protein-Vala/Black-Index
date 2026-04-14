/**
 * currency-utils.ts
 * Utility functions for handling multi-currency formatting on Black Index.
 * 
 * Future-proofing for when founders can set their own currencies (USD, EUR, GBP, etc.)
 */

export type SupportedCurrency = 'INR' | 'USD' | 'EUR' | 'GBP';

interface CurrencyConfig {
    locale: string;
    currencyCode: string;
    symbol: string;
    divisor: number;
}

const CURRENCY_MAP: Record<SupportedCurrency, CurrencyConfig> = {
    'INR': { locale: 'en-IN', currencyCode: 'INR', symbol: '₹', divisor: 100 },
    'USD': { locale: 'en-US', currencyCode: 'USD', symbol: '$', divisor: 100 },
    'EUR': { locale: 'de-DE', currencyCode: 'EUR', symbol: '€', divisor: 100 },
    'GBP': { locale: 'en-GB', currencyCode: 'GBP', symbol: '£', divisor: 100 },
};

/**
 * Format an amount in its smallest unit (e.g. paise, cents) to a localized currency string.
 * Defaults to INR / Paise.
 */
export function formatCurrencyValue(amountInSmallestUnit: number, currency: SupportedCurrency = 'INR'): string {
    const config = CURRENCY_MAP[currency] || CURRENCY_MAP['INR'];
    const value = amountInSmallestUnit / config.divisor;

    return new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: config.currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(value);
}

/**
 * Extract the symbol for a given currency
 */
export function getCurrencySymbol(currency: SupportedCurrency = 'INR'): string {
    return CURRENCY_MAP[currency]?.symbol || '₹';
}
