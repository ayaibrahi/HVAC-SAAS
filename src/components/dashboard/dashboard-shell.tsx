import type { ReactNode } from "react";
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
          <div className="space-y-3 border-t border-border p-5">
            {userEmail ? (
              <p className="text-sm text-muted">{userEmail}</p>
            ) : null}
            <form action={signOutAction}>
              <button type="submit" className="button-secondary w-full">
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
