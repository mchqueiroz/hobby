"use client";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/**
 * Uma linha de filtros que rola na horizontal (nada quebra em várias linhas).
 * O número fica fora do nome acessível: leitor de tela fala "Anime", não "Anime 12".
 */
export function FilterRow<T extends string>({ label, options, selected, onPick }: {
  label: string;
  options: FilterOption<T>[];
  selected: T | T[];
  onPick: (v: T) => void;
}) {
  const on = (v: T) => (Array.isArray(selected) ? selected.includes(v) : selected === v);
  return (
    <div className="frow">
      <span className="frow-label">{label}</span>
      <div className="hscroll" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" className="chip" data-empty={o.count === 0 && !on(o.value) ? "sim" : undefined} aria-pressed={on(o.value)} onClick={() => onPick(o.value)}>
            {o.label}
            {o.count !== undefined && <span className="n" aria-hidden="true">{o.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
