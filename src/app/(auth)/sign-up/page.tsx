import Link from "next/link";
import { FeedbackMessage } from "@/components/feedback-message";
import { signUpAction } from "@/features/auth/actions";

type SignUpPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Create account</h1>
        <p className="mt-2 text-sm text-muted">Start with email and password.</p>
      </div>

      <FeedbackMessage error={params.error} />

      <form action={signUpAction} className="space-y-4">
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Full name</span>
          <input
            name="fullName"
            autoComplete="name"
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </label>

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
            autoComplete="new-password"
            required
            minLength={8}
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </label>

        <button className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90">
          Create account
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-accent">
          Sign in
        </Link>
      </p>
    </div>
  );
}
