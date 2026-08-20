import { CurrencyCode } from '../types';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  rateFromUSD: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  NGN: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira (₦)', rateFromUSD: 1550 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar ($)', rateFromUSD: 1 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro (€)', rateFromUSD: 0.92 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound (£)', rateFromUSD: 0.78 },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen (¥)', rateFromUSD: 155 },
  ZAR: { code: 'ZAR', symbol: 'R', name: 'South African Rand (R)', rateFromUSD: 18.2 },
};

export function convertFromUSD(amountInUSD: number, targetCurrency: CurrencyCode = 'NGN'): number {
  const config = CURRENCIES[targetCurrency] || CURRENCIES.NGN;
  return amountInUSD * config.rateFromUSD;
}

export function formatCurrency(
  amountInUSD: number,
  targetCurrency: CurrencyCode = 'NGN',
  compact: boolean = false
): string {
  const config = CURRENCIES[targetCurrency] || CURRENCIES.NGN;
  const converted = amountInUSD * config.rateFromUSD;

  if (compact) {
    if (converted >= 1_000_000_000) {
      return `${config.symbol}${(converted / 1_000_000_000).toFixed(1)}B`;
    }
    if (converted >= 1_000_000) {
      return `${config.symbol}${(converted / 1_000_000).toFixed(1)}M`;
    }
    if (converted >= 1_000) {
      return `${config.symbol}${(converted / 1_000).toFixed(0)}K`;
    }
    return `${config.symbol}${Math.round(converted).toLocaleString()}`;
  }

  return `${config.symbol}${Math.round(converted).toLocaleString()}`;
}
