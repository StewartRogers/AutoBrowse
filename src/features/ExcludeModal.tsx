// Set-aside (exclude) modal — captures reason before archiving a vehicle
import { useState } from 'react';
import Modal from '../components/Modal';
import PowertrainBadge from '../components/PowertrainBadge';
import { vehicleName } from '../lib/fmt';
import type { Vehicle } from '../lib/data';

const REASON_CHIPS = [
  'Over budget',
  'Too small / not enough cargo',
  "Didn't like the drive",
  'Reliability concerns',
  'A better option won out',
  'No longer available',
];

interface Props {
  vehicle: Vehicle;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export default function ExcludeModal({ vehicle, onConfirm, onClose }: Props) {
  const [selected, setSelected] = useState('');
  const [custom, setCustom] = useState('');

  const reason = selected === '__custom' ? custom : selected;

  return (
    <Modal
      title="Set aside this vehicle"
      onClose={onClose}
      width={500}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onConfirm(reason)}>
            Set aside
          </button>
        </>
      }
    >
      {/* Vehicle summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 14px', background: 'var(--paper-2)', borderRadius: 'var(--r-sm)' }}>
        <div
          style={{ width: 4, height: 36, borderRadius: 2, background: vehicle.accent, flexShrink: 0 }}
        />
        <div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>{vehicleName(vehicle)}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{vehicle.trim}</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <PowertrainBadge powertrain={vehicle.powertrain} size="sm" />
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16, lineHeight: 1.6 }}>
        It'll drop out of comparisons, rankings and the matrix — but stays saved under Excluded, so you can bring it back anytime.
      </p>

      {/* Reason chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {REASON_CHIPS.map(r => (
          <button
            key={r}
            type="button"
            className="btn"
            style={{
              padding: '6px 12px',
              fontSize: 13,
              border: `1.5px solid ${selected === r ? 'var(--accent)' : 'var(--line)'}`,
              background: selected === r ? 'var(--accent-tint)' : 'var(--card)',
              color: selected === r ? 'var(--accent)' : 'var(--ink)',
              fontWeight: selected === r ? 600 : 400,
            }}
            onClick={() => { setSelected(r); setCustom(''); }}
          >
            {r}
          </button>
        ))}
        <button
          type="button"
          className="btn"
          style={{
            padding: '6px 12px',
            fontSize: 13,
            border: `1.5px solid ${selected === '__custom' ? 'var(--accent)' : 'var(--line)'}`,
            background: selected === '__custom' ? 'var(--accent-tint)' : 'var(--card)',
            color: selected === '__custom' ? 'var(--accent)' : 'var(--ink-faint)',
          }}
          onClick={() => setSelected('__custom')}
        >
          Or write your own…
        </button>
      </div>

      {selected === '__custom' && (
        <input
          className="input"
          autoFocus
          placeholder="Why are you setting this aside?"
          value={custom}
          onChange={e => setCustom(e.target.value)}
        />
      )}
    </Modal>
  );
}
