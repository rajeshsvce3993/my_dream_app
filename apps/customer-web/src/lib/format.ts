export function orderSerial(orderNumber: string): string {
  const parts = orderNumber.split('-');
  const serial = parts.length >= 3 ? parts[parts.length - 1] : '';
  return serial && /^\d+$/.test(serial) ? serial : orderNumber;
}

export function formatMoney(currencySymbol: string, amount: number) {
  return `${currencySymbol}${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
