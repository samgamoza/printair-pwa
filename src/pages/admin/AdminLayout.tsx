import { Outlet } from 'react-router-dom';
import { Users, Building2, FolderKanban, FileText, Star, Palette, MessageSquare } from 'lucide-react';
import { AppShell, type ShellNavItem } from '@/components/shell/AppShell';

const NAV: ShellNavItem[] = [
  { to: '/admin', label: 'Users', short: 'Users', icon: Users, end: true },
  { to: '/admin/providers', label: 'Providers', short: 'Providers', icon: Building2 },
  // Sits directly under Providers: both are "who is allowed to work here",
  // and unlike the rest of this nav it is a queue with work waiting in it.
  { to: '/admin/designers', label: 'Designers', short: 'Designers', icon: Palette },
  { to: '/admin/projects', label: 'Projects', short: 'Projects', icon: FolderKanban },
  { to: '/admin/quotes', label: 'Quotes', short: 'Quotes', icon: FileText },
  { to: '/admin/reviews', label: 'Reviews', short: 'Reviews', icon: Star },
  // Design reviews are a separate table with their own moderation RPC, so they
  // need their own page rather than a filter on the one above.
  { to: '/admin/design-reviews', label: 'Design Reviews', short: 'Design rev.', icon: MessageSquare },
];

export default function AdminLayout() {
  return (
    <AppShell navItems={NAV} roleLabel="Admin">
      <Outlet />
    </AppShell>
  );
}
