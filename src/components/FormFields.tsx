import type { Field } from "../content/activities";

export type FormValues = Record<string, string | number | string[] | undefined>;

export function missingRequired(fields: Field[], values: FormValues) {
  return fields
    .filter((f) => "required" in f && f.required)
    .filter((f) => {
      const v = values[f.id];
      return v === undefined || v === "" || (Array.isArray(v) && !v.length);
    });
}

export function FormFields({
  fields,
  values,
  onChange,
  disabled,
}: {
  fields: Field[];
  values: FormValues;
  onChange: (id: string, v: FormValues[string]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="stack">
      {fields.map((f) => {
        const v = values[f.id];
        switch (f.type) {
          case "text":
            return (
              <label key={f.id} className="field">
                {f.label}
                <input
                  value={(v as string) ?? ""}
                  maxLength={200}
                  disabled={disabled}
                  onChange={(e) => onChange(f.id, e.target.value)}
                />
              </label>
            );
          case "textarea":
            return (
              <label key={f.id} className="field">
                {f.label}
                <textarea
                  value={(v as string) ?? ""}
                  maxLength={2000}
                  disabled={disabled}
                  onChange={(e) => onChange(f.id, e.target.value)}
                />
              </label>
            );
          case "number":
            return (
              <label key={f.id} className="field">
                {f.label}
                <input
                  type="number"
                  inputMode="numeric"
                  min={f.min}
                  max={f.max}
                  value={v === undefined ? "" : String(v)}
                  disabled={disabled}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") return onChange(f.id, undefined);
                    let n = Math.round(Number(raw));
                    if (f.min !== undefined) n = Math.max(f.min, n);
                    if (f.max !== undefined) n = Math.min(f.max, n);
                    onChange(f.id, n);
                  }}
                />
              </label>
            );
          case "select":
            return (
              <label key={f.id} className="field">
                {f.label}
                <select
                  value={(v as string) ?? ""}
                  disabled={disabled}
                  onChange={(e) => onChange(f.id, e.target.value)}
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
            );
          case "scale":
            return (
              <div
                key={f.id}
                className="field"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--ink-2)",
                }}
              >
                {f.label}
                <div className="scale">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={disabled}
                      className={v === n ? "on" : ""}
                      onClick={() => onChange(f.id, n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            );
          case "checks": {
            const list = (v as string[]) ?? [];
            return (
              <div key={f.id} className="stack" style={{ gap: 6 }}>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--ink-2)",
                  }}
                >
                  {f.label}
                </span>
                <div className="checks">
                  {f.options.map((o) => (
                    <label key={o.id} className="check">
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={list.includes(o.id)}
                        onChange={(e) =>
                          onChange(
                            f.id,
                            e.target.checked
                              ? [...list, o.id]
                              : list.filter((x) => x !== o.id),
                          )
                        }
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          }
        }
      })}
    </div>
  );
}
