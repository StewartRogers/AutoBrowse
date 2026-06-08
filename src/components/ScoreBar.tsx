import styles from './ScoreBar.module.css';

interface Props {
  value: number;   // 0–10 or 0–100
  max?: number;
  accent?: string; // hex override
  height?: number;
}

export default function ScoreBar({ value, max = 10, accent, height = 4 }: Props) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className={styles.track} style={{ height }}>
      <div
        className={styles.fill}
        style={{ width: `${pct}%`, background: accent ?? 'var(--accent)', height }}
      />
    </div>
  );
}
