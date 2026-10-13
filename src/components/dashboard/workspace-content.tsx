"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { EnglishWorkflow } from "@/components/ui-preferences";

export function WorkspaceContent({ children }: { children: ReactNode }) {
  return usePathname() === "/dashboard" ? (
    children
  ) : (
    <EnglishWorkflow>{children}</EnglishWorkflow>
  );
}
