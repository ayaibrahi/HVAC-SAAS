"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { buildFeedbackUrl, getValidationErrorMessage } from "@/lib/action-feedback";
import { formDataToObject } from "@/lib/forms";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema } from "@/lib/validation/auth";

export async function signInAction(formData: FormData) {
  if (!getSupabasePublicConfig()) {
    redirect(
      buildFeedbackUrl("/sign-in", {
        error: "Supabase is not configured. Add the required environment variables.",
      }),
    );
  }

  const result = signInSchema.safeParse(formDataToObject(formData));

  if (!result.success) {
    redirect(
      buildFeedbackUrl("/sign-in", {
        error: getValidationErrorMessage(result.error),
      }),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(result.data);

  if (error) {
    redirect(buildFeedbackUrl("/sign-in", { error: "Invalid email or password." }));
  }

  redirect("/dashboard");
}

export async function signUpAction(formData: FormData) {
  if (!getSupabasePublicConfig()) {
    redirect(
      buildFeedbackUrl("/sign-up", {
        error: "Supabase is not configured. Add the required environment variables.",
      }),
    );
  }

  const result = signUpSchema.safeParse(formDataToObject(formData));

  if (!result.success) {
    redirect(
      buildFeedbackUrl("/sign-up", {
        error: getValidationErrorMessage(result.error),
      }),
    );
  }

  const headersList = await headers();
  const origin = headersList.get("origin") ?? "http://localhost:3000";
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: result.data.email,
    password: result.data.password,
    options: {
      data: {
        full_name: result.data.fullName ?? null,
      },
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    redirect(buildFeedbackUrl("/sign-up", { error: error.message }));
  }

  if (data.session) {
    redirect("/dashboard");
  }

  redirect(
    buildFeedbackUrl("/sign-in", {
      success: "Account created. Check your email if confirmation is enabled.",
    }),
  );
}

export async function signOutAction() {
  if (getSupabasePublicConfig()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  redirect("/");
}
