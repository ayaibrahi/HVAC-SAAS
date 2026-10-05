import Link from "next/link";
import type { ReactNode } from "react";
import { productConfig } from "@/config/product";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-5 py-10 text-ink">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-sm font-semibold text-accent">
          {productConfig.name}
        </Link>
        <div className="rounded-md border border-border bg-white p-6 shadow-sm">
          {children}
        </div>
      </div>
    </main>
  );
}
