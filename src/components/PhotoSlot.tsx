import { useState } from 'react';
import styles from './PhotoSlot.module.css';

interface Props {
  color?: string;
  accent?: string;
  height?: number;
  label?: string;
  photoUrl?: string;
}

export default function PhotoSlot({ color, accent = '#b4552d', height = 140, label, photoUrl }: Props) {
  // A transient aborted load (Firefox reports NS_BINDING_ABORTED — e.g. a
  // StrictMode remount or navigation cancelling the in-flight request) fires the
  // img `error` event exactly like a real 404. The old handler hid the image via
  // display:none, which permanently dropped a perfectly valid photo. Instead we
  // retry once (recovers from an abort) and only fall back to the placeholder if
  // it genuinely fails again. Reset when the URL changes.
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  // Reset on URL change via the "adjust state during render" pattern (React's
  // recommended alternative to a setState-in-effect) so a new photo gets a fresh try.
  const [prevUrl, setPrevUrl] = useState(photoUrl);
  if (photoUrl !== prevUrl) {
    setPrevUrl(photoUrl);
    setAttempt(0);
    setFailed(false);
  }

  if (photoUrl && !failed) {
    return (
      <div className={`${styles.slot} ${styles.hasPhoto}`} style={{ height, borderLeft: `3px solid ${accent}` }}>
        <img
          key={attempt}
          src={photoUrl}
          alt={color || label || 'Vehicle photo'}
          className={styles.photo}
          onError={() => { if (attempt < 1) setAttempt(attempt + 1); else setFailed(true); }}
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
