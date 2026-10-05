export const supportedCurrencies = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;

export type CurrencyCode = (typeof supportedCurrencies)[number];

export const defaultCurrency: CurrencyCode = "USD";
