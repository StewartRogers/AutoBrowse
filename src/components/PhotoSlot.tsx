// Striped CSS placeholder — wire to real image upload in production
import styles from './PhotoSlot.module.css';

interface Props {
  color?: string;
  accent?: string;
  height?: number;
  label?: string;
}

export default function PhotoSlot({ color, accent = '#b4552d', height = 140, label }: Props) {
  return (
    <div
      className={styles.slot}
      style={{
        height,
        '--stripe-color': `${accent}22`,
        borderLeft: `3px solid ${accent}`,
      } as React.CSSProperties}
    >
      {color && (
        <span className={styles.colorLabel}>{color}</span>
      )}
      {label && !color && (
        <span className={styles.colorLabel}>{label}</span>
      )}
    </div>
  );
}
