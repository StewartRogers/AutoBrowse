import { useEffect } from 'react';
import styles from './Modal.module.css';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  footer?: React.ReactNode;
}

export default function Modal({ title, onClose, children, width = 560, footer }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal} style={{ maxWidth: width }}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close" style={{ padding: '4px 6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
