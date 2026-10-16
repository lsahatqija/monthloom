export function sourceKey(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en-US');
}

export function sourceValues(displayName: string, aliases: string[]) {
  const normalizedDisplayName = displayName.trim();
  const aliasesByKey = new Map<string, string>();
  for (const alias of aliases) {
    const normalizedAlias = alias.trim();
    aliasesByKey.set(sourceKey(normalizedAlias), normalizedAlias);
  }
  const key = sourceKey(normalizedDisplayName);
  aliasesByKey.delete(key);
  return {
    displayName: normalizedDisplayName,
    key,
    aliases: [normalizedDisplayName, ...aliasesByKey.values()],
  };
}
