import styles from './SectionLabel.module.css';

interface Props {
  children: React.ReactNode;
  accent?: string;
}

export default function SectionLabel({ children, accent }: Props) {
  return (
    <div className={styles.label} style={accent ? { color: accent } : undefined}>
      {children}
    </div>
  );
}
