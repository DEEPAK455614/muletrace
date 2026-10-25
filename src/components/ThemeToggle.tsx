import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeChoice } from '../state/theme';

const OPTIONS: { id: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

export default function ThemeToggle() {
  const [choice, setChoice] = useTheme();
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          role="radio"
          aria-checked={choice === id}
          title={`${label} theme`}
          className={`theme-toggle-btn ${choice === id ? 'active' : ''}`}
          onClick={() => setChoice(id)}
        >
          <Icon size={13} strokeWidth={2.2} />
          <span className="hidden lg:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
