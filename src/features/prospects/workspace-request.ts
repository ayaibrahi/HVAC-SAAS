export type WorkspaceRequestResult =
  "done" | "session" | "limit" | "busy" | "error" | "unknown";

// Existing endpoints remain authoritative. Never display raw response bodies.
export async function requestWorkspaceAction(
  path: string,
  method: "POST" | "DELETE",
): Promise<WorkspaceRequestResult> {
  try {
    const response = await fetch(path, {
      method,
      credentials: "same-origin",
      redirect: "error",
    });
    await response.body?.cancel();
    if (response.ok) return "done";
    if (response.status === 401) return "session";
    if (response.status === 429) return "limit";
    if (response.status === 409) return "busy";
    return "error";
  } catch {
    return "unknown";
  }
}
