import styles from './PhotoSlot.module.css';

interface Props {
  color?: string;
  accent?: string;
  height?: number;
  label?: string;
  photoUrl?: string;
}

export default function PhotoSlot({ color, accent = '#b4552d', height = 140, label, photoUrl }: Props) {
  if (photoUrl) {
    return (
      <div className={styles.slot} style={{ height, borderLeft: `3px solid ${accent}` }}>
        <img
          src={photoUrl}
          alt={color || label || 'Vehicle photo'}
          className={styles.photo}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        {color && <span className={styles.colorLabel}>{color}</span>}
      </div>
    );
  }

  return (
    <div
      className={styles.slot}
      style={{
        height,
        '--stripe-color': `${accent}22`,
        borderLeft: `3px solid ${accent}`,
      } as React.CSSProperties}
    >
      {color && <span className={styles.colorLabel}>{color}</span>}
      {label && !color && <span className={styles.colorLabel}>{label}</span>}
    </div>
  );
}
