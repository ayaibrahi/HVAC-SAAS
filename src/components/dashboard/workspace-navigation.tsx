"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Menu,
  Settings,
  Users,
  Wrench,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  closeNavigationDrawer,
  getDrawerFocusTarget,
  isNavigationActive,
  openNavigationDrawer,
  workspaceNavigation,
} from "@/components/dashboard/navigation";

type WorkspaceNavigationProps = {
  productName: string;
  agencyName?: string | null;
  account: ReactNode;
};

const navigationIcons = {
  Dashboard: LayoutDashboard,
  Prospects: Users,
  Services: Wrench,
  Proposals: FileText,
  Settings,
};

export function WorkspaceNavigation({
  productName,
  agencyName,
  account,
}: WorkspaceNavigationProps) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const currentSection = workspaceNavigation.find((item) =>
    isNavigationActive(pathname, item.href),
  );

  function closeDrawer() {
    if (closeNavigationDrawer(dialogRef.current)) setIsOpen(false);
  }

  function containKeyboardFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]',
      ),
    ).filter(
      (element) => element.tabIndex >= 0 && element.getClientRects().length > 0,
    );
    const target = getDrawerFocusTarget(
      controls,
      document.activeElement,
      event.shiftKey,
    );
    if (target) {
      event.preventDefault();
      target.focus();
    }
  }

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    function handleResize() {
      if (desktop.matches && closeNavigationDrawer(dialogRef.current))
        setIsOpen(false);
    }
    desktop.addEventListener("change", handleResize);
    return () => desktop.removeEventListener("change", handleResize);
  }, []);

  useEffect(() => {
    closeNavigationDrawer(dialogRef.current);
  }, [pathname]);

  function identity() {
    return (
      <div className="min-w-0 px-5 pb-5 pt-8">
        <Link
          href="/dashboard"
          onClick={closeDrawer}
          className="flex min-w-0 items-center gap-3"
        >
          <Image
            src="/workspace-mark.svg"
            alt=""
            width={32}
            height={32}
            className="shrink-0 rounded-md bg-white p-1"
          />
          <span className="min-w-0 text-base font-semibold leading-snug text-white">
            {productName}
          </span>
        </Link>
        <div className="mt-8 flex items-start gap-3 border-y border-white/10 py-4">
          <Building2
            aria-hidden="true"
            size={18}
            className="mt-1 shrink-0 text-teal-300"
          />
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Agency workspace</p>
            <p className="mt-1 text-sm font-medium text-slate-100">
              {agencyName || "Your agency"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  function navigation(label: string) {
    return (
      <nav aria-label={label} className="flex-1 space-y-1 px-3 pb-6">
        {workspaceNavigation.map((item) => {
          const Icon = navigationIcons[item.label];
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeDrawer}
              aria-current={
                isNavigationActive(pathname, item.href) ? "page" : undefined
              }
              className="workspace-nav-link"
            >
              <Icon
                aria-hidden="true"
                size={18}
                strokeWidth={1.7}
                className="shrink-0"
              />
              <span>{item.label}</span>
              {isNavigationActive(pathname, item.href) ? (
                <ChevronRight
                  aria-hidden="true"
                  size={16}
                  className="ml-auto shrink-0"
                />
              ) : null}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <>
      <aside
        aria-label="Workspace sidebar"
        className="workspace-sidebar fixed inset-y-0 left-0 hidden w-60 flex-col overflow-y-auto lg:flex"
      >
        {identity()}
        {navigation("Main navigation")}
        {account}
      </aside>
      <header className="flex min-h-16 items-center gap-4 border-b border-border bg-white px-4 sm:px-8 lg:ml-60">
        <button
          type="button"
          aria-label="Open navigation"
          aria-controls="workspace-navigation-drawer"
          aria-expanded={isOpen}
          onClick={() => {
            if (openNavigationDrawer(dialogRef.current)) setIsOpen(true);
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border text-2xl lg:hidden"
          title="Open navigation"
        >
          <Menu aria-hidden="true" size={20} />
        </button>
        <p className="min-w-0 text-sm text-muted">
          <span className="hidden sm:inline">
            Workspace{" "}
            <span aria-hidden="true" className="mx-2">
              /
            </span>{" "}
          </span>
          <span className="font-medium text-ink">
            {currentSection?.label ?? "Workspace"}
          </span>
        </p>
        <span className="ml-auto hidden min-w-0 max-w-sm py-3 text-right text-sm text-muted sm:block">
          {agencyName || "Agency workspace"}
        </span>
      </header>
      <dialog
        id="workspace-navigation-drawer"
        ref={dialogRef}
        onKeyDown={containKeyboardFocus}
        aria-labelledby="workspace-navigation-title"
        onCancel={() => setIsOpen(false)}
        onClose={() => setIsOpen(false)}
        className="workspace-drawer"
      >
        <div className="flex min-h-full flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
            <h2
              id="workspace-navigation-title"
              className="text-sm font-semibold"
            >
              Workspace navigation
            </h2>
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Close navigation"
              title="Close navigation"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/20"
            >
              <X aria-hidden="true" size={20} />
            </button>
          </div>
          {identity()}
          {navigation("Mobile navigation")}
          {account}
        </div>
      </dialog>
    </>
  );
}
