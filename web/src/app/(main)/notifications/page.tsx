import { redirect } from 'next/navigation';

/** Les notifications vivent dans le panneau de la cloche : l'ancienne page renvoie au fil. */
export default function NotificationsPage() {
  redirect('/feed');
}
