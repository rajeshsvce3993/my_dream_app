export function formatMoney(currencySymbol: string, amount: number) {
  return `${currencySymbol}${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
