export const workspaceNavigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/prospects", label: "Prospects" },
  { href: "/dashboard/services", label: "Services" },
  { href: "/dashboard/proposals", label: "Proposals" },
  { href: "/dashboard/settings", label: "Settings" },
] as const;

export function isNavigationActive(pathname: string, href: string) {
  return (
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(`${href}/`))
  );
}

// Native modal dialogs provide focus containment, Escape, and focus restoration.
export function openNavigationDrawer(dialog: HTMLDialogElement | null) {
  if (!dialog || dialog.open) return false;
  dialog.showModal();
  return true;
}

export function closeNavigationDrawer(dialog: HTMLDialogElement | null) {
  if (!dialog?.open) return false;
  dialog.close();
  return true;
}

export function getDrawerFocusTarget(
  controls: HTMLElement[],
  activeElement: Element | null,
  shiftKey: boolean,
) {
  const first = controls[0];
  const last = controls.at(-1);
  if (!first || !last) return null;
  if (shiftKey && activeElement === first) return last;
  if (!shiftKey && activeElement === last) return first;
  return null;
}
