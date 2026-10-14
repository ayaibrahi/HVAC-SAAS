"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prospectInputSchema } from "@/lib/validation/prospects";
import { AppError } from "@/lib/errors";
import { createProspect, updateProspect } from "./data";
import { findMatchingProspect, getEditableProspect } from "./workspace-data";
import {
  prospectHref,
  prospectIdSchema,
  type ProspectField,
  type ProspectFormState,
} from "./workspace-model";

export async function saveWorkspaceProspect(
  id: string | null,
  _state: ProspectFormState,
  form: FormData,
): Promise<ProspectFormState> {
  const result = await persistProspect(id, form);
  if (!result.savedId) return result;
  revalidatePath("/dashboard/prospects");
  revalidatePath("/dashboard");
  redirect(prospectHref(result.savedId));
}

// Returns only the owned saved ID; the existing audit endpoint authorizes the scan separately.
export async function createBusinessForScan(
  _state: ProspectFormState,
  form: FormData,
): Promise<ProspectFormState> {
  const result = await persistProspect(null, form);
  if (result.savedId) {
    revalidatePath("/dashboard/prospects");
    revalidatePath("/dashboard");
  }
  return result;
}

async function persistProspect(
  id: string | null,
  form: FormData,
): Promise<ProspectFormState> {
  const fields: ProspectField[] = [
    "businessName",
    "websiteUrl",
    "contactName",
    "contactEmail",
    "notes",
  ];
  const input = Object.fromEntries(
    fields.map((field) => [field, form.get(field) ?? ""]),
  );
  const parsed = prospectInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      error: "invalid",
      fields: fields.filter((field) =>
        parsed.error.issues.some((issue) => issue.path[0] === field),
      ),
    };
  if (id !== null && !prospectIdSchema.safeParse(id).success)
    return { error: "save" };
  let savedId: string;
  try {
    if (id) {
      if (!(await getEditableProspect(id))) return { error: "save" };
      savedId = (await updateProspect(id, parsed.data)).id;
    } else {
      const duplicate = await findMatchingProspect(parsed.data.websiteUrl);
      // Advisory only: this is not a uniqueness guarantee or a replacement for a DB constraint.
      if (duplicate && form.get("allowDuplicate") !== "yes")
        return { duplicate };
      savedId = (await createProspect(parsed.data)).id;
    }
  } catch (error) {
    return {
      error:
        error instanceof AppError && error.statusCode === 401
          ? "session"
          : error instanceof AppError && error.statusCode === 403
            ? "agency"
            : "save",
    };
  }
  return { savedId };
}
