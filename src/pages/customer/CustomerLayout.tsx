import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, FolderKanban, Palette, Printer } from 'lucide-react';
import { AppShell, type ShellNavItem } from '@/components/shell/AppShell';
import { Sheet } from '@/components/ui/Sheet';
import { ProjectBuilder } from '@/components/ProjectBuilder';
import type { ProjectRow } from '@/lib/api/projects';
import { DesignRequestBuilder } from '@/components/DesignRequestBuilder';
import { CreateContext, type CreateValue } from './createContext';
import { PageLoader } from '@/components/ui/states';

const NAV: ShellNavItem[] = [
  { to: '/dashboard', label: 'My Projects', short: 'Projects', icon: FolderKanban, end: true },
  { to: '/dashboard/designs', label: 'My Designs', short: 'Designs', icon: Palette },
];

/**
 * Customer frame. Owns the two "create" flows so the + button can start
 * either one from any customer screen, and tells the list pages when a flow
 * closes so they can refresh.
 */
export default function CustomerLayout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [chooserOpen, setChooserOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectCategory, setProjectCategory] = useState<string | null>(null);
  const [projectTemplate, setProjectTemplate] = useState<ProjectRow | null>(null);
  const [designOpen, setDesignOpen] = useState(false);
  const [version, setVersion] = useState(0);

  // `?new=1` opens the matching create flow: fresh customer accounts arrive on
  // /dashboard?new=1, and links elsewhere point at /dashboard/designs?new=1.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      if (pathname.startsWith('/dashboard/designs')) setDesignOpen(true);
      else setProjectOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, pathname]);

  const startProject = useCallback((categoryId?: string | null) => {
    setChooserOpen(false);
    setProjectCategory(categoryId ?? null);
    setProjectTemplate(null);
    setProjectOpen(true);
  }, []);

  const reorder = useCallback((project: ProjectRow) => {
    setChooserOpen(false);
    setProjectCategory(null);
    setProjectTemplate(project);
    setProjectOpen(true);
  }, []);

  const startDesign = useCallback(() => {
    setChooserOpen(false);
    // Post from My Designs, so the new request is on screen when the form closes.
    if (!pathname.startsWith('/dashboard/designs')) navigate('/dashboard/designs');
    setDesignOpen(true);
  }, [pathname, navigate]);

  const value = useMemo<CreateValue>(() => ({ startProject, startDesign, reorder, version }), [startProject, startDesign, reorder, version]);

  return (
    <CreateContext.Provider value={value}>
      <AppShell navItems={NAV} roleLabel="Customer" create={{ label: 'Create', onClick: () => setChooserOpen(true) }}>
        {/* Keeps the tabs and side rail on screen while the next page's code arrives. */}
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </AppShell>

      <Sheet open={chooserOpen} onClose={() => setChooserOpen(false)} size="sm" labelledBy="create-title">
        <div className="px-5 pb-6 pt-6 sm:px-7 sm:pt-8">
          <h2 id="create-title" className="pr-12 text-3xl text-ink-950">
            What are we making?
          </h2>
          <div className="mt-5 grid gap-3">
            <button
              type="button"
              onClick={() => startProject()}
              className="group relative overflow-hidden rounded-3xl bg-cyan-300 p-5 text-left transition-transform active:scale-[0.98]"
            >
              <span className="pointer-events-none absolute -right-4 -top-6 h-28 w-36 bg-halftone bg-dots text-cyan-600/40" aria-hidden="true" />
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-ink-950">
                <Printer className="h-6 w-6" />
              </span>
              <span className="mt-4 block font-display text-2xl font-bold text-ink-950">Print something</span>
              <span className="mt-1 flex items-center gap-1 font-medium text-ink-800">
                Boxes, labels, bags, flyers — get quotes <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
            <button
              type="button"
              onClick={startDesign}
              className="group relative overflow-hidden rounded-3xl bg-magenta-300 p-5 text-left transition-transform active:scale-[0.98]"
            >
              <span className="pointer-events-none absolute -right-4 -top-6 h-28 w-36 bg-halftone bg-dots text-magenta-600/40" aria-hidden="true" />
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-ink-950">
                <Palette className="h-6 w-6" />
              </span>
              <span className="mt-4 block font-display text-2xl font-bold text-ink-950">Get a design first</span>
              <span className="mt-1 flex items-center gap-1 font-medium text-ink-800">
                Logo, label or packaging, print-ready <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          </div>
        </div>
      </Sheet>

      <ProjectBuilder
        open={projectOpen}
        onClose={() => {
          setProjectOpen(false);
          setProjectTemplate(null);
          setVersion((v) => v + 1);
        }}
        initialCategoryId={projectCategory}
        template={projectTemplate}
        onWantDesigner={startDesign}
      />
      <DesignRequestBuilder
        open={designOpen}
        onClose={() => {
          setDesignOpen(false);
          setVersion((v) => v + 1);
        }}
      />
    </CreateContext.Provider>
  );
}
