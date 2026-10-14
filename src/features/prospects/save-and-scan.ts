import { prospectIdSchema, type ProspectFormState } from "./workspace-model";
import {
  requestWorkspaceAction,
  type WorkspaceRequestResult,
} from "./workspace-request";

export type SaveAndScanState = ProspectFormState & {
  scanResult?: WorkspaceRequestResult;
  saveUncertain?: boolean;
};

// Invoked by an explicit form submission, never by mounting or refreshing a page.
export async function saveAndScanBusiness(
  create: (
    state: ProspectFormState,
    form: FormData,
  ) => Promise<ProspectFormState>,
  previous: SaveAndScanState,
  form: FormData,
): Promise<SaveAndScanState> {
  // A known or uncertain save must be inspected, not repeated via this form.
  if (previous.savedId || previous.saveUncertain) return previous;
  let saved: ProspectFormState;
  try {
    saved = await create({}, form);
  } catch {
    return { saveUncertain: true };
  }
  if (!saved.savedId) return saved;
  if (!prospectIdSchema.safeParse(saved.savedId).success)
    return { saveUncertain: true };
  const scanResult = await requestWorkspaceAction(
    `/api/prospects/${saved.savedId}/audits`,
    "POST",
  );
  return { savedId: saved.savedId, scanResult };
}
