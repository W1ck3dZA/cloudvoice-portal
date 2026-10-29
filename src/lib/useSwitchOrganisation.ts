import { useMutation } from '@tanstack/react-query';
import { authApi } from './api';
import { useSession } from './session';
import type { Role } from '../types/api';
// Every org-scoped request uses the organisation in the token, so switching
// swaps the token, then reloads so cached data and the live event socket
// start fresh for the new organisation. Errors are toasted by the API client.
export function useSwitchOrganisation() {
  const { setSession } = useSession();
  return useMutation({
    mutationFn: authApi.switchOrganisation,
    onSuccess: (d) => {
      localStorage.setItem('cv_token', d.token);
      setSession({ user: d.user, orgId: d.orgId, role: d.role as Role });
      window.location.assign('/');
    },
  });
}
