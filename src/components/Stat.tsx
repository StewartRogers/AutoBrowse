// Summary stat — label + big number + optional sub-label
import styles from './Stat.module.css';

interface Props {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
  className?: string;
}

export default function Stat({ label, value, sub, accent = false, className }: Props) {
  return (
    <div className={`${styles.stat} ${className ?? ''}`}>
      <div className="label">{label}</div>
      <div className={`num ${styles.value} ${accent ? styles.accent : ''}`}>{value}</div>
      {sub && <div className={styles.sub}>{sub}</div>}
    </div>
  );
}
