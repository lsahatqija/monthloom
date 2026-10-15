export function transactionTypeLabel(type: string): string {
  if (type === 'cafe') return 'Café';

  return type
    .split('-')
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(' ');
}
