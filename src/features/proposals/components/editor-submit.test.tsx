import type { ReactElement, ReactNode, FormEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProposalEditForm, ProposalWorkflowButton } from "./content-fields";
import { getProposalCopy } from "@/lib/i18n/proposals";

const hooks = vi.hoisted(() => ({
  stateIndex: 0,
  refIndex: 0,
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  markDirty: vi.fn(),
  setSaving: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: hooks.refresh, replace: hooks.replace }),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useContext: () => ({
    dirty: true,
    saving: false,
    generating: false,
    markDirty: hooks.markDirty,
    setSaving: hooks.setSaving,
  }),
  useEffect: () => {},
  useState: (initial: unknown) => {
    const i = hooks.stateIndex++;
    if (!(i in hooks.states)) hooks.states[i] = initial;
    return [
      hooks.states[i],
      (value: unknown) => {
        hooks.states[i] = value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = hooks.refIndex++;
    return hooks.refs[i] ?? (hooks.refs[i] = { current: initial });
  },
}));
const NativeFormData = globalThis.FormData;
const constructor = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  hooks.stateIndex = 0;
  hooks.refIndex = 0;
  hooks.states = [];
  hooks.refs = [];
  vi.stubGlobal(
    "FormData",
    class {
      constructor(
        form: { fields: Record<string, string> },
        submitter: { name: string; value: string },
      ) {
        constructor(form, submitter);
        const result = new NativeFormData();
        for (const [key, value] of Object.entries(form.fields))
          result.set(key, value);
        if (submitter) result.set(submitter.name, submitter.value);
        return result;
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
function render(
  action: (form: FormData) => Promise<{
    saved?: true;
    error?: string;
    outcome?: "generate" | "prepare";
    reloadHref?: string;
    warning?: string;
  }>,
) {
  hooks.stateIndex = 0;
  hooks.refIndex = 0;
  return ProposalEditForm({
    action,
    className: "",
    copy: getProposalCopy("en"),
    successHref: "/proposal?success=saved",
    revision: "revision",
    children: "fields",
  });
}
function event(intent = "generate") {
  return {
    preventDefault: vi.fn(),
    currentTarget: {
      fields: {
        title: "Unsaved title",
        scope: "",
        "serviceId:one": "current-service",
        "unitPrice:one": "575",
      },
    },
    nativeEvent: { submitter: { name: "intent", value: intent } },
  } as unknown as FormEvent<HTMLFormElement>;
}
function nodes(
  value: ReactNode,
): ReactElement<{ role?: string; children?: ReactNode; tabIndex?: number }>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as ReactElement<{
    role?: string;
    children?: ReactNode;
    tabIndex?: number;
  }>;
  return [element, ...nodes(element.props.children)];
}
describe("one editor form interaction", () => {
  it("reloads persisted state after AI failure and blocks stale clicks until remount", async () => {
    const action = vi.fn(async () => ({
      error: "Draft saved; AI unavailable.",
      reloadHref: "/proposal?error=AI+unavailable",
    }));
    const submit = render(action).props.onSubmit!;
    await submit(event());
    expect(hooks.replace).toHaveBeenCalledWith(
      "/proposal?error=AI+unavailable",
    );
    expect(hooks.refresh).toHaveBeenCalledOnce();
    expect(hooks.setSaving).toHaveBeenLastCalledWith(true);
    await submit(event("prepare"));
    expect(action).toHaveBeenCalledOnce();
    // The updatedAt-keyed editor remounts with the server's current revision.
    hooks.states = [];
    hooks.refs = [];
    const saved = vi.fn(async () => ({ saved: true as const }));
    await render(saved).props.onSubmit!(event("save"));
    expect(saved).toHaveBeenCalledOnce();
  });
  it("retains unfinished Draft pricing feedback across the refresh", async () => {
    await render(async () => ({
      saved: true,
      warning: "Draft saved with unfinished pricing.",
    })).props.onSubmit!(event("save"));
    expect(hooks.replace.mock.calls[0][0]).toContain("unfinished+pricing");
  });
  it("submits the current fields and clicked intent once, even on rapid clicks", async () => {
    let finish!: (value: { saved: true; outcome: "generate" }) => void;
    const action = vi.fn((form: FormData) => {
      expect(form.get("intent")).toBe("generate");
      return new Promise<{ saved: true; outcome: "generate" }>((resolve) => {
        finish = resolve;
      });
    });
    const form = render(action);
    const submit = form.props.onSubmit!;
    const first = submit(event());
    await submit(event());
    expect(action).toHaveBeenCalledOnce();
    expect(action.mock.calls[0][0].get("intent")).toBe("generate");
    expect(action.mock.calls[0][0].get("unitPrice:one")).toBe("575");
    expect(hooks.setSaving).toHaveBeenCalledWith(true);
    finish({ saved: true, outcome: "generate" });
    await first;
    expect(hooks.replace).toHaveBeenCalledWith(
      "/proposal?success=saved#proposal-copy",
    );
    expect(hooks.setSaving).toHaveBeenLastCalledWith(false);
  });
  it("keeps fields mounted and displays a prominent focused-capable Ready error without navigating", async () => {
    const action = vi.fn(async () => ({
      error: "Add Summary and Scope to mark Ready.",
    }));
    await render(action).props.onSubmit!(event("prepare"));
    const alert = nodes(render(action)).find(
      (node) => node.props.role === "alert",
    );
    expect(alert?.props.tabIndex).toBe(-1);
    expect(JSON.stringify(alert)).toContain("Add Summary and Scope");
    expect(hooks.refresh).not.toHaveBeenCalled();
    expect(hooks.replace).not.toHaveBeenCalled();
  });
  it("does not block workflow buttons merely because selections are dirty", () => {
    const button = ProposalWorkflowButton({
      intent: "prepare",
      label: "Save as Ready",
      pendingLabel: "Saving",
    });
    expect(button.props.disabled).toBe(false);
    expect(button.props.form).toBe("proposal-editor");
    expect(button.props.value).toBe("prepare");
  });
});
