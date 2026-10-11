import { describe, expect, it, vi } from "vitest";
import { extractGroqErrorDiagnostics } from "@/lib/ai/groq-diagnostics";

vi.mock("server-only", () => ({}));

const unknownDiagnostics = {
  providerErrorCode: "unknown",
  providerErrorParam: "unknown",
  rejectionReason: "unknown",
};

describe("finite Groq diagnostic allowlists", () => {
  it.each([
    "invalid_api_key",
    "permission_denied",
    "model_not_found",
    "model_decommissioned",
    "invalid_request_error",
    "json_validate_failed",
    "tool_use_failed",
    "rate_limit_exceeded",
    "insufficient_quota",
    "context_length_exceeded",
    "request_too_large",
    "server_error",
  ])("accepts only the exact audited code %s", (code) => {
    const diagnostics = extractGroqErrorDiagnostics({ error: { code } });
    expect(diagnostics.providerErrorCode).toBe(code);
    expect(diagnostics.providerErrorParam).toBe("unknown");
    expect(
      extractGroqErrorDiagnostics({ error: { code: `${code}\nprivate-data` } }),
    ).toEqual(unknownDiagnostics);
  });

  it.each([
    "model",
    "messages",
    "response_format",
    "response_format.json_schema.schema",
    "response_format.json_schema.strict",
    "reasoning_effort",
    "max_completion_tokens",
    "stream",
    "required",
    "additionalProperties",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
    "response_format.json_schema.schema.properties.scope.maxLength",
  ])("accepts only the exact audited identifier %s", (param) => {
    expect(extractGroqErrorDiagnostics({ error: { param } })).toEqual({
      ...unknownDiagnostics,
      providerErrorParam: param,
    });
    expect(
      extractGroqErrorDiagnostics({
        error: { param: `${param}\nprivate-data` },
      }),
    ).toEqual(unknownDiagnostics);
  });

  it.each(
    [
      "new_provider_code",
      "constructor",
      "__proto__",
      "toString",
      "INVALID_REQUEST_ERROR",
      " maxLength ",
      "messages[0].content",
      "response_format.json_schema.schema.properties.customer-email@example.test",
      "Authorization: Bearer test-groq-key",
      "private customer name and notes",
      "x".repeat(5000),
      null,
      400,
      ["model"],
      { name: "maxLength" },
    ].map((value) => ({ value })),
  )("does not echo unknown or malicious code/param values %#", ({ value }) => {
    expect(
      extractGroqErrorDiagnostics({ error: { code: value, param: value } }),
    ).toEqual(unknownDiagnostics);
  });

  it.each(
    [undefined, null, [], "raw body", {}, { error: null }, { error: [] }].map(
      (value) => ({ value }),
    ),
  )("handles missing or malformed error envelopes %#", ({ value }) => {
    expect(extractGroqErrorDiagnostics(value)).toEqual(unknownDiagnostics);
  });
});

describe("bounded rejection reason hints", () => {
  it.each([
    ["maxLength must be at most 4096", "schema_string_bounds"],
    ["Unsupported maxLength constraint", "schema_string_bounds"],
    ["minLength is not supported", "schema_string_bounds"],
    ["maxItems exceeds the supported limit", "schema_array_bounds"],
    ["All properties must be required", "schema_required_fields"],
    ["additionalProperties must be false", "schema_additional_properties"],
    ["Failed to compile JSON schema", "schema_compilation_failed"],
    ["Grammar is too large", "schema_compilation_failed"],
    ["Invalid JSON schema", "schema_rejected"],
    ["Unsupported parameter", "parameter_rejected"],
    ["Request payload too large", "input_too_large"],
    ["Maximum context length exceeded", "input_too_large"],
    [
      "Generated JSON does not match the expected schema",
      "output_validation_failed",
    ],
  ])("maps a recognized pattern to a fixed category %#", (message, reason) => {
    expect(extractGroqErrorDiagnostics({ error: { message } })).toEqual({
      ...unknownDiagnostics,
      rejectionReason: reason,
    });
  });

  it("never retains raw message, failed_generation or extra fields", () => {
    const value = {
      error: {
        message:
          "maxLength must be smaller. Authorization: Bearer test-groq-key; private customer notes",
        param: "response_format.json_schema.schema.properties.scope.maxLength",
        code: "invalid_request_error",
        failed_generation: { customer: "private customer notes" },
        authorization: "Bearer test-groq-key",
      },
    };
    const before = structuredClone(value);
    expect(extractGroqErrorDiagnostics(value)).toEqual({
      providerErrorCode: "invalid_request_error",
      providerErrorParam:
        "response_format.json_schema.schema.properties.scope.maxLength",
      rejectionReason: "schema_string_bounds",
    });
    expect(value).toEqual(before);
  });

  it("does not scan messages beyond the explicit 2048-character bound", () => {
    const message = "maxLength must be smaller.".padEnd(2048, "x");
    expect(
      extractGroqErrorDiagnostics({ error: { message } }).rejectionReason,
    ).toBe("schema_string_bounds");
    expect(
      extractGroqErrorDiagnostics({ error: { message: `${message}x` } }),
    ).toEqual(unknownDiagnostics);
  });

  it.each(
    ["Unrecognized failure with customer data", 42, [], {}, null].map(
      (message) => ({ message }),
    ),
  )(
    "returns unknown for unrecognized or non-string messages %#",
    ({ message }) => {
      expect(extractGroqErrorDiagnostics({ error: { message } })).toEqual(
        unknownDiagnostics,
      );
    },
  );

  it.each([
    ["context_length_exceeded", "input_too_large"],
    ["request_too_large", "input_too_large"],
    ["json_validate_failed", "output_validation_failed"],
  ])(
    "uses a recognized code without needing the raw message %s",
    (code, reason) => {
      expect(extractGroqErrorDiagnostics({ error: { code } })).toEqual({
        providerErrorCode: code,
        providerErrorParam: "unknown",
        rejectionReason: reason,
      });
    },
  );
});
