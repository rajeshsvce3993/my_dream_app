export function orderSerial(orderNumber: string): string {
  const parts = orderNumber.split('-');
  const serial = parts.length >= 3 ? parts[parts.length - 1] : '';
  return serial && /^\d+$/.test(serial) ? serial : orderNumber;
}

export function formatMoney(symbol: string, amount: number) {
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
