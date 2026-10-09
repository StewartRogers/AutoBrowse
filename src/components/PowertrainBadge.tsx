import type { Powertrain } from '../lib/data';
import { POWERTRAINS } from '../lib/data';
import styles from './PowertrainBadge.module.css';

interface Props {
  powertrain: Powertrain;
  size?: 'sm' | 'md';
}

export default function PowertrainBadge({ powertrain, size = 'md' }: Props) {
  // Tolerate unknown values from older/imported records instead of crashing.
  const pt = POWERTRAINS[powertrain] ?? { label: String(powertrain || 'Unknown'), color: 'var(--ink-soft)', tint: 'transparent' };
  return (
    <span
      className={`${styles.badge} ${styles[size]}`}
      style={{ color: pt.color, background: pt.tint, border: `1px solid ${pt.color}33` }}
    >
      <span className={styles.dot} style={{ background: pt.color }} />
      {pt.label.toUpperCase()}
    </span>
  );
}
