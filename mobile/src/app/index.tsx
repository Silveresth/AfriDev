import { Redirect } from 'expo-router';

import { useSession } from '@/shared/session';

/** Point d'entrée : le fil si l'on est connecté, sinon l'écran de connexion. */
export default function Index() {
  const { isAuthenticated } = useSession();
  return <Redirect href={isAuthenticated ? '/feed' : '/login'} />;
}
