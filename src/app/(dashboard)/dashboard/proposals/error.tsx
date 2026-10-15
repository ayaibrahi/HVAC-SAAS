"use client";

import Link from "next/link";
import { useInterface } from "@/components/ui-preferences";

export default function ProposalWorkspaceError() {
  const { t } = useInterface();
  return (
    <section role="alert" className="space-y-4">
      <h1 className="text-xl font-semibold">{t.pProposalLoadError}</h1>
      <p className="max-w-xl text-sm text-muted">{t.pProposalRecovery}</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/proposals" className="button-secondary">
          {t.pProposals}
        </Link>
        <Link href="/dashboard/prospects" className="button-secondary">
          {t.pSavedBusinesses}
        </Link>
      </div>
    </section>
  );
}
