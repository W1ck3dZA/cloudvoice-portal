import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';
type Ctx = {
  /** The theme in use right now. */
  theme: Theme;
  /** What the user chose; 'system' follows the device. */
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  toggleTheme: () => void;
};
const ThemeContext = createContext<Ctx | null>(null);
const query = '(prefers-color-scheme: dark)';
const systemTheme = (): Theme =>
  window.matchMedia(query).matches ? 'dark' : 'light';
function getInitialPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem('cv_theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system')
      return stored;
  } catch {
    /* storage unavailable */
  }
  return 'system';
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] =
    useState<ThemePreference>(getInitialPreference);
  const [system, setSystem] = useState<Theme>(systemTheme);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const theme = preference === 'system' ? system : preference;
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  useEffect(() => {
    try {
      localStorage.setItem('cv_theme', preference);
    } catch {
      /* storage unavailable */
    }
  }, [preference]);
  const value = useMemo(
    () => ({
      theme,
      preference,
      setPreference,
      toggleTheme: () => setPreference(theme === 'dark' ? 'light' : 'dark'),
    }),
    [theme, preference],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
export const useTheme = () => {
  const c = useContext(ThemeContext);
  if (!c) throw new Error('ThemeProvider missing');
  return c;
};
