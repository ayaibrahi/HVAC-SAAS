import type { ReactNode } from "react";
import { LogOut, UserRound } from "lucide-react";
import { WorkspaceNavigation } from "@/components/dashboard/workspace-navigation";
import { productConfig } from "@/config/product";
import { signOutAction } from "@/features/auth/actions";

type DashboardShellProps = {
  children: ReactNode;
  agencyName?: string | null;
  userEmail?: string | null;
};

export function DashboardShell({
  children,
  agencyName,
  userEmail,
}: DashboardShellProps) {
  return (
    <div className="workspace min-h-screen bg-surface text-ink">
      <a
        href="#workspace-main"
        className="sr-only z-50 rounded-md bg-accent px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>
      <WorkspaceNavigation
        productName={productConfig.name}
        agencyName={agencyName}
        account={
          <div className="space-y-4 border-t border-white/10 p-5">
            {userEmail ? (
              <div className="flex items-center gap-3">
                <UserRound
                  size={18}
                  aria-hidden="true"
                  className="shrink-0 text-slate-400"
                />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Signed in as</p>
                  <p className="mt-1 text-sm text-slate-100">{userEmail}</p>
                </div>
              </div>
            ) : null}
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <LogOut size={17} aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        }
      />
      <div className="min-w-0 lg:pl-60">
        <main
          id="workspace-main"
          tabIndex={-1}
          className="mx-auto w-full min-w-0 max-w-7xl px-4 py-7 sm:px-8 sm:py-9 lg:px-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
