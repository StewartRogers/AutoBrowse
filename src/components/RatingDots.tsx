// 0–10 star rating control. Ten stars map 1:1 to the 0..10 scale, with an
// always-visible "N/10" label and a hover preview, so the scale is obvious and
// the current score is easy to read at a glance.
import { useState } from 'react';
import styles from './RatingDots.module.css';

interface Props {
  value: number;
  onChange?: (v: number) => void;
  accent?: string;
  readonly?: boolean;
}

const STAR_PATH = 'M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 18.6l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96L12 2.5z';

export default function RatingDots({ value, onChange, accent, readonly = false }: Props) {
  const [hover, setHover] = useState(0);
  const shown = hover || value; // preview while hovering, otherwise the saved value
  const color = accent ?? 'var(--accent)';

  return (
    <div className={styles.row}>
      <div className={styles.stars} onMouseLeave={() => setHover(0)}>
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          const filled = n <= shown;
          return (
            <button
              key={n}
              type="button"
              className={styles.starBtn}
              style={{ color: filled ? color : 'var(--ink-faint)' }}
              // Click the current value again to clear back to 0.
              onClick={readonly ? undefined : () => onChange?.(n === value ? 0 : n)}
              onMouseEnter={readonly ? undefined : () => setHover(n)}
              aria-label={`Rate ${n} of 10`}
              disabled={readonly}
            >
              <svg viewBox="0 0 24 24" className={styles.star} aria-hidden="true">
                <path d={STAR_PATH} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </button>
          );
        })}
      </div>
      <span className={styles.val} style={{ color: value > 0 ? color : 'var(--ink-faint)' }}>
        {value > 0 ? value : '–'}<span className={styles.scale}>/10</span>
      </span>
    </div>
  );
}
