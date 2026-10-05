import Link from "next/link";
import type { ReactNode } from "react";
import { productConfig } from "@/config/product";
import { signOutAction } from "@/features/auth/actions";

type DashboardShellProps = {
  children: ReactNode;
  agencyName?: string | null;
  userEmail?: string | null;
};

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/prospects", label: "Prospects" },
  { href: "/dashboard/services", label: "Services" },
  { href: "/dashboard/proposals", label: "Proposals" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashboardShell({ children, agencyName, userEmail }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <aside className="fixed inset-y-0 hidden w-64 border-r border-border bg-white px-5 py-6 md:block">
        <Link href="/dashboard" className="block">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            {productConfig.name}
          </p>
          <p className="mt-1 text-lg font-semibold text-ink">
            {agencyName ?? "Agency workspace"}
          </p>
        </Link>

        <nav className="mt-8 space-y-1">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-6 left-5 right-5 space-y-3">
          {userEmail ? <p className="truncate text-xs text-muted">{userEmail}</p> : null}
          <form action={signOutAction}>
            <button className="w-full rounded-md border border-border px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="border-b border-border bg-white px-5 py-4 md:hidden">
          <div className="flex items-center justify-between gap-4">
            <Link href="/dashboard" className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{productConfig.name}</p>
            </Link>
            <form action={signOutAction}>
              <button className="rounded-md border border-border px-3 py-2 text-sm font-semibold">
                Sign out
              </button>
            </form>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md border border-border px-3 py-2 text-sm font-medium text-muted"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
      </div>
    </div>
  );
}
