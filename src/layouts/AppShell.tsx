import { NavLink, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import Icon from '../components/Icon';
import styles from './AppShell.module.css';

interface Props {
  children: React.ReactNode;
  onAddVehicle: () => void;
}

export default function AppShell({ children, onAddVehicle }: Props) {
  const compareIds = useStore(s => s.compareIds);
  const vehicles = useStore(s => s.vehicles);
  const activeCount = vehicles.filter(v => !v.archived).length;
  const location = useLocation();

  // Keep "Garage" highlighted for /vehicle/:id too
  const garageActive =
    location.pathname === '/garage' || location.pathname.startsWith('/vehicle/');

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <Icon name="car" size={20} style={{ color: '#fff' }} />
          </div>
          <div>
            <div className={styles.brandName}>AutoBrowse</div>
            <div className={styles.brandSub}>shopping workbook</div>
          </div>
        </div>

        {/* Nav */}
        <nav className={styles.nav}>
          <NavLink to="/" end className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
            <Icon name="dashboard" size={17} />
            Dashboard
          </NavLink>
          <NavLink
            to="/garage"
            className={`${styles.navItem} ${garageActive ? styles.active : ''}`}
          >
            <Icon name="garage" size={17} />
            Garage
          </NavLink>
          <NavLink to="/compare" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
            <Icon name="compare" size={17} />
            Compare
            {compareIds.length > 0 && (
              <span className={styles.badge}>{compareIds.length}</span>
            )}
          </NavLink>
          <NavLink to="/matrix" className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
            <Icon name="matrix" size={17} />
            Decision Matrix
          </NavLink>
        </nav>

        <div style={{ flex: 1 }} />

        {/* Footer */}
        <div className={styles.footer}>
          <button className={`btn btn-primary ${styles.addBtn}`} onClick={onAddVehicle}>
            <Icon name="plus" size={15} />
            Add vehicle
          </button>
          <div className={styles.footerNote}>
            <span className="num">{activeCount}</span> active · saved on this device
          </div>
        </div>
      </aside>

      <main className="app-main">
        <div className="app-content fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
