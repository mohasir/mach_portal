export const toPercent = (decimal: number) => decimal * 100;

export const fromPercent = (percent: number) => percent / 100;

/** Rate as the percent shown in the UI, with up to 3 decimals so rates like 8.875% stay exact. */
export const toDisplayPercent = (decimal: number) => Math.round(decimal * 100000) / 1000;
