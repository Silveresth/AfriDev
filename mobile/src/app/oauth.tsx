import { Redirect } from 'expo-router';

/**
 * Retour OAuth (afridev://oauth, exp://…/--/oauth) : le navigateur d'authentification capte
 * normalement ce lien ; si le système ouvre quand même l'appli dessus, on revient à l'accueil.
 */
export default function OAuthReturn() {
  return <Redirect href="/" />;
}
