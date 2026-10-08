import { HubNav } from '@/features/hubs';
import { NotificationBell } from '@/features/notifications';
import { CommandPalette } from '@/features/search';
import { AppShell } from '@/shared/layout';

/** Pages de l'application : cadre commun (navigation, hubs, recherche ⌘K, connectivité). */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell notifications={<NotificationBell />} communities={<HubNav />} search={<CommandPalette />}>
      {children}
    </AppShell>
  );
}
