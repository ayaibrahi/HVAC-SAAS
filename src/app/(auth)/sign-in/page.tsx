import Link from "next/link";
import { FeedbackMessage } from "@/components/feedback-message";
import { signInAction } from "@/features/auth/actions";

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Sign in</h1>
        <p className="mt-2 text-sm text-muted">Use your email and password.</p>
      </div>

      <FeedbackMessage error={params.error} success={params.success} />

      <form action={signInAction} className="space-y-4">
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </label>

        <button className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90">
          Sign in
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        Need an account?{" "}
        <Link href="/sign-up" className="font-semibold text-accent">
          Sign up
        </Link>
      </p>
    </div>
  );
}
