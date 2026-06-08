// 1–10 clickable square rating control
import styles from './RatingDots.module.css';

interface Props {
  value: number;
  onChange?: (v: number) => void;
  accent?: string;
  readonly?: boolean;
}

export default function RatingDots({ value, onChange, accent, readonly = false }: Props) {
  return (
    <div className={styles.row}>
      {Array.from({ length: 10 }, (_, i) => {
        const n = i + 1;
        const active = n <= value;
        return (
          <button
            key={n}
            type="button"
            className={`${styles.dot} ${active ? styles.active : ''}`}
            style={active ? { background: accent ?? 'var(--accent)', borderColor: accent ?? 'var(--accent)' } : undefined}
            onClick={readonly ? undefined : () => onChange?.(n === value ? 0 : n)}
            aria-label={`Rate ${n}`}
            disabled={readonly}
          />
        );
      })}
      {value > 0 && (
        <span className={`num ${styles.val}`}>{value}</span>
      )}
    </div>
  );
}
