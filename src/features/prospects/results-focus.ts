export function revealSavedResults(
  region: Pick<HTMLElement, "focus" | "scrollIntoView"> | null,
) {
  if (!region) return;
  region.focus({ preventScroll: true });
  region.scrollIntoView({ block: "start", behavior: "auto" });
}
