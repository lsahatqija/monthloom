/** Convert a contract decimal amount to integer cents without floating-point arithmetic. */
export function toCents(amount: string): number {
  const [whole, fraction = ''] = amount.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
}

export function fromCents(amount: number): string {
  return (amount / 100).toFixed(2);
}

export function averageAmounts(amounts: string[]): string {
  if (amounts.length === 0) throw new Error('At least one amount is required.');
  const total = amounts.reduce((sum, amount) => sum + toCents(amount), 0);
  return fromCents(Math.round(total / amounts.length));
}
