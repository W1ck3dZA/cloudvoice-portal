import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Role, User } from '../types/api';
type Session = { user: User; orgId: string | null; role: Role | null };
type Ctx = {
  session: Session | null;
  setSession: (s: Session | null) => void;
  logout: () => void;
};
const SessionContext = createContext<Ctx | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setState] = useState<Session | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('cv_session') || 'null');
    } catch {
      return null;
    }
  });
  const setSession = (s: Session | null) => {
    setState(s);
    if (s) localStorage.setItem('cv_session', JSON.stringify(s));
    else localStorage.removeItem('cv_session');
  };
  const logout = () => {
    localStorage.removeItem('cv_token');
    setSession(null);
    location.href = '/login';
  };
  const value = useMemo(() => ({ session, setSession, logout }), [session]);
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
export const useSession = () => {
  const c = useContext(SessionContext);
  if (!c) throw new Error('SessionProvider missing');
  return c;
};
