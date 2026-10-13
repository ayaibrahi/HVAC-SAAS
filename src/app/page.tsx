import Link from "next/link";
import { productConfig } from "@/config/product";
import { Brand } from "@/components/brand";
import {
  EnglishWorkflow,
  PreferenceControls,
} from "@/components/ui-preferences";

export default function HomePage() {
  return (
    <main className="public-home min-h-screen bg-panel text-ink">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-5 px-5 py-6">
        <Link href="/" className="text-accent">
          <Brand />
        </Link>
        <PreferenceControls />
      </header>
      <section className="mx-auto flex max-w-5xl flex-col justify-center px-5 py-16">
        <EnglishWorkflow>
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase text-accent">
              {productConfig.category}
            </p>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight text-ink md:text-6xl">
              {productConfig.name}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
              {productConfig.tagline}
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              {productConfig.description}
            </p>
            <p className="mt-6 text-sm font-semibold text-accent">
              Scan &rarr; Discover &rarr; Propose &rarr; Share
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
        </EnglishWorkflow>
      </section>
    </main>
  );
}
