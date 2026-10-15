"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { EnglishWorkflow } from "@/components/ui-preferences";

export function WorkspaceContent({ children }: { children: ReactNode }) {
  const path = usePathname();
  return path === "/dashboard" ||
    path === "/dashboard/prospects" ||
    /^\/dashboard\/proposals\/[^/]+$/.test(path) ? (
    children
  ) : (
    <EnglishWorkflow>{children}</EnglishWorkflow>
  );
}
