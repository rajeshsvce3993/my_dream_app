export function money(currency: string | undefined, amount: number): string {
  const symbol = !currency || currency === 'INR' ? '₹' : `${currency} `;
  return `${symbol}${Math.round(amount)}`;
}

export function formatDeliveredAt(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function orderSerial(orderNumber: string): string {
  const parts = orderNumber.split('-');
  const serial = parts.length >= 3 ? parts[parts.length - 1] : '';
  return serial && /^\d+$/.test(serial) ? serial : orderNumber;
}

export function greetingForNow(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
