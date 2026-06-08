// Label + input wrapper used throughout forms
interface Props {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}

export default function Field({ label, children, hint, required }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label className="label" style={{ display: 'flex', gap: 4 }}>
        {label}
        {required && <span style={{ color: 'var(--accent)' }}>*</span>}
      </label>
      {children}
      {hint && <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{hint}</span>}
    </div>
  );
}
