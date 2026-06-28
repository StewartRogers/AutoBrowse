import { money } from '../lib/fmt';

interface Props {
  value: number;
  onChange: (n: number) => void;
  className?: string;
}

// Currency input: always shows the value as $99,999 (no decimals) and accepts any
// number, including 0. It strips non-digits on every keystroke, so the formatting
// can never block entry — unlike a `value={n || ''}` number field, where typing 0
// blanks the box. The numeric value is passed back to the caller via onChange.
export default function MoneyInput({ value, onChange, className = 'input num' }: Props) {
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9]/g, '');
    onChange(digits === '' ? 0 : Number(digits));
  };
  return (
    <input
      className={className}
      type="text"
      inputMode="numeric"
      value={money(value)}
      onChange={handle}
    />
  );
}
