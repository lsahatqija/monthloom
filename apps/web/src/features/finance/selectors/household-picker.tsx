'use client';

import type { ManagedHousehold } from '@monthloom/contracts';
import { useTranslations } from 'next-intl';

export function resolveHouseholdId(
  households: ReadonlyArray<Pick<ManagedHousehold, 'id' | 'isPrimary'>>,
  requestedId: string,
): string {
  if (households.some((household) => household.id === requestedId)) return requestedId;
  return households.find((household) => household.isPrimary)?.id ?? households[0]?.id ?? '';
}

export function HouseholdPicker({
  households,
  value,
  onChange,
}: {
  households: ManagedHousehold[];
  value: string;
  onChange: (householdId: string) => void;
}) {
  const t = useTranslations('Finance');
  const selected = households.find((household) => household.id === value) ?? households[0];
  if (!selected) return null;

  return (
    <div className="householdControl">
      {households.length > 1 ? (
        <>
          <label className="householdPicker">
            <span className="srOnly">{t('household')}</span>
            <select value={value} onChange={(event) => onChange(event.target.value)}>
              {households.map((household) => (
                <option key={household.id} value={household.id}>
                  {household.name}
                  {household.isPrimary ? t('defaultSuffix') : ''}
                </option>
              ))}
            </select>
          </label>
          <h1 className="srOnly">{selected.name}</h1>
        </>
      ) : (
        <h1 className="householdNameText" title={selected.name}>
          {selected.name}
        </h1>
      )}
    </div>
  );
}
