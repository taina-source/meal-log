import { useId } from 'react';
export function NumberField({ label, unit, value, onChange, required = false, max = 2000, min = 0 }: { label: string; unit: string; value: string; onChange: (value: string) => void; required?: boolean; max?: number; min?: number }) {
  const id = useId();
  return <label className="field" htmlFor={id}><span>{label}{required && <span className="required">必須</span>}</span><div className="input-unit"><input id={id} type="number" inputMode="decimal" step="any" min={min} max={max} required={required} value={value} onChange={event => onChange(event.target.value)} placeholder={required ? '入力してください' : '0'} /><span>{unit}</span></div></label>;
}
export function FormError({ message }: { message: string }) { return message ? <p className="form-error" role="alert">{message}</p> : null; }
