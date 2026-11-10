'use client';

import type { AdminLogEntry } from '@monthloom/contracts';
import { useEffect, useRef, useState } from 'react';

export function HealthEventTable({
  entries,
  locale,
  labels,
}: {
  entries: AdminLogEntry[];
  locale: string;
  labels: { event: string; source: string; time: string; details: string; close: string };
}) {
  const [selected, setSelected] = useState<AdminLogEntry>();
  const dialog = useRef<HTMLDialogElement>(null);
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  useEffect(() => {
    if (selected) dialog.current?.showModal();
  }, [selected]);

  function close() {
    dialog.current?.close();
    setSelected(undefined);
  }

  return (
    <>
      <div className="adminTableWrap">
        <table className="adminLogTable">
          <thead>
            <tr>
              <th>{labels.event}</th>
              <th>{labels.source}</th>
              <th>{labels.time}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={`${entry.timestamp}-${entry.level}-${index}`}>
                <td>
                  <button
                    className="adminLogButton"
                    type="button"
                    onClick={() => setSelected(entry)}
                  >
                    <span className="adminLogEvent">
                      <span className="adminLevel" data-level={entry.level}>
                        {entry.level}
                      </span>
                      <span>
                        <strong>{entry.message}</strong>
                        {entry.detail ? <small>{entry.detail}</small> : null}
                      </span>
                    </span>
                  </button>
                </td>
                <td>{entry.category}</td>
                <td className="adminNumeric">{dates.format(new Date(entry.timestamp))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dialog ref={dialog} className="adminLogDialog" onClose={() => setSelected(undefined)}>
        {selected ? (
          <div>
            <header>
              <div>
                <span className="adminLevel" data-level={selected.level}>
                  {selected.level}
                </span>
                <h2>{labels.details}</h2>
              </div>
              <button type="button" onClick={close} aria-label={labels.close}>
                ×
              </button>
            </header>
            <dl>
              <div>
                <dt>{labels.time}</dt>
                <dd>{dates.format(new Date(selected.timestamp))}</dd>
              </div>
              <div>
                <dt>{labels.source}</dt>
                <dd>{selected.category}</dd>
              </div>
            </dl>
            <pre>{selected.fullMessage ?? selected.detail ?? selected.message}</pre>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
