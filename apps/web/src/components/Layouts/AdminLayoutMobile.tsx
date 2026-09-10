'use client';
import { Layout } from 'antd';
import { BottomNav } from '@/components/shared/BottomNav';
import { PullToRefresh } from '@/components/shared/PullToRefresh';
import { MobileTopbar } from '@/components/shared/Topbar';
import { useHideBottomNav } from '@/lib/navigation';
import { useLayoutStore } from '@/lib/stores/layout.store';

export function AdminLayoutMobile({ children }: { children: React.ReactNode }) {
  const fillViewport = useLayoutStore((s) => s.fillViewport);
  const hideBottomNav = useHideBottomNav();

  return (
    <Layout className={`h-full overflow-hidden bg-white`}>
      <Layout.Header className="relative z-10 shadow-xs flex h-auto min-h-16 items-center pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] px-4 leading-normal bg-white">
        <MobileTopbar />
      </Layout.Header>

      {/* z-0 (not just relative) pins its own stacking context, so the z-10 content div
          inside PullToRefresh stays contained here instead of leaking out and painting
          over BottomNav's floating "+" button below. */}
      <Layout.Content className="relative z-0 min-h-0 flex-1 overflow-hidden">
        {/* Disabled when fillViewport: this pane doesn't scroll itself then (children like the
            quote builder manage their own inner scroll), so scrollTop would sit at 0
            permanently and misfire on any downward swipe. */}
        <PullToRefresh
          disabled={fillViewport}
          className={`h-full px-4 pt-4 ${fillViewport ? 'overflow-hidden pb-0' : 'overflow-y-auto pb-6'}`}
        >
          <div className={fillViewport ? 'flex h-full min-h-0 flex-col' : undefined}>{children}</div>
        </PullToRefresh>
      </Layout.Content>

      {!hideBottomNav && <BottomNav />}
    </Layout>
  );
}
