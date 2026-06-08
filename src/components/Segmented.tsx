// Pill-style segmented control
import styles from './Segmented.module.css';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}

export default function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <div className={styles.track}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          className={`${styles.pill} ${opt.value === value ? styles.active : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
