import Link from "next/link";
import { Suspense } from "react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r bg-sidebar md:block">
        <div className="flex h-14 items-center border-b px-5">
          <Link href="/" className="font-semibold tracking-tight">
            Byznys
          </Link>
        </div>
        <SidebarNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-2 border-b px-4 md:px-6">
          <div className="flex items-center gap-2">
            <MobileNav />
            <span className="font-semibold md:hidden">Byznys</span>
          </div>
          <Suspense fallback={<Skeleton className="h-8 w-40" />}>
            <UserMenu />
          </Suspense>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto grid max-w-7xl gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
