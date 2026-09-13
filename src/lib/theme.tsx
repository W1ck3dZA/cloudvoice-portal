import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
type Theme = 'light' | 'dark';
type Ctx = { theme: Theme; toggleTheme: () => void };
const ThemeContext = createContext<Ctx | null>(null);
function getInitialTheme(): Theme {
  const stored = localStorage.getItem('cv_theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cv_theme', theme);
  }, [theme]);
  const toggleTheme = () =>
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  const value = useMemo(() => ({ theme, toggleTheme }), [theme]);
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
export const useTheme = () => {
  const c = useContext(ThemeContext);
  if (!c) throw new Error('ThemeProvider missing');
  return c;
};
