import Link from "next/link";
import { productConfig } from "@/config/product";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-ink">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-5 py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            {productConfig.name}
          </p>
          <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight text-ink md:text-6xl">
            {productConfig.tagline}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            A focused sales workspace for agencies to turn website evidence into
            prioritized opportunities, service recommendations, and proposals.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/sign-up"
              className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent/90"
            >
              Create account
            </Link>
            <Link
              href="/sign-in"
              className="rounded-md border border-border px-5 py-3 text-sm font-semibold text-ink transition hover:bg-surface"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
