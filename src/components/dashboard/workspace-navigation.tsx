"use client";

import { Brand } from "@/components/brand";
import { PreferenceControls, useInterface } from "@/components/ui-preferences";
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
  const { t } = useInterface();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const currentSection = workspaceNavigation.find((item) =>
    isNavigationActive(pathname, item.href),
  );
  const labels = {
    Dashboard: t.dashboard,
    Prospects: t.prospects,
    Services: t.services,
    Proposals: t.proposals,
    Settings: t.settings,
  };

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
          <span className="min-w-0 text-white">
            <Brand name={productName} />
          </span>
        </Link>
        <div className="mt-8 flex items-start gap-3 border-y border-white/10 py-4">
          <Building2
            aria-hidden="true"
            size={18}
            className="mt-1 shrink-0 text-teal-300"
          />
          <div className="min-w-0">
            <p className="text-xs text-slate-400">{t.agencyWorkspace}</p>
            <p className="mt-1 text-sm font-medium text-slate-100">
              <bdi>{agencyName || t.yourAgency}</bdi>
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
              <span>{labels[item.label]}</span>
              {isNavigationActive(pathname, item.href) ? (
                <ChevronRight
                  aria-hidden="true"
                  size={16}
                  className="ms-auto shrink-0 rtl:rotate-180"
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
        aria-label={t.sidebar}
        className="workspace-sidebar fixed inset-y-0 start-0 hidden w-60 flex-col overflow-y-auto lg:flex"
      >
        {identity()}
        {navigation(t.mainNavigation)}
        {account}
      </aside>
      <header className="flex min-h-16 flex-wrap items-center gap-2 border-b border-border bg-panel px-4 py-2 sm:gap-4 sm:px-8 lg:ms-60">
        <button
          type="button"
          aria-label={t.openNavigation}
          aria-controls="workspace-navigation-drawer"
          aria-expanded={isOpen}
          onClick={() => {
            if (openNavigationDrawer(dialogRef.current)) setIsOpen(true);
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border text-2xl lg:hidden"
          title={t.openNavigation}
        >
          <Menu aria-hidden="true" size={20} />
        </button>
        <p className="hidden min-w-0 text-sm text-muted sm:block">
          <span className="hidden sm:inline">
            {t.workspace}{" "}
            <span aria-hidden="true" className="mx-2">
              /
            </span>{" "}
          </span>
          <span className="font-medium text-ink">
            {currentSection ? labels[currentSection.label] : t.workspace}
          </span>
        </p>
        <div className="ms-auto">
          <PreferenceControls />
        </div>
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
              {t.navigation}
            </h2>
            <button
              type="button"
              onClick={closeDrawer}
              aria-label={t.closeNavigation}
              title={t.closeNavigation}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/20"
            >
              <X aria-hidden="true" size={20} />
            </button>
          </div>
          {identity()}
          {navigation(t.mobileNavigation)}
          {account}
        </div>
      </dialog>
    </>
  );
}
