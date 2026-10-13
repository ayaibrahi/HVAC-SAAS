import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import {
  EnglishWorkflow,
  PreferenceControls,
} from "@/components/ui-preferences";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-surface flex min-h-screen items-center justify-center bg-surface px-5 py-10 text-ink">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-5">
          <Link href="/" className="font-semibold text-accent">
            <Brand />
          </Link>
          <PreferenceControls />
        </div>
        <div className="rounded-md border border-border bg-white p-6 shadow-sm">
          <EnglishWorkflow>{children}</EnglishWorkflow>
        </div>
      </div>
    </main>
  );
}
