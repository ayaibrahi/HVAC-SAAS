import "server-only";

const providerCodes = [
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
] as const;

const providerParams = [
  "model",
  "messages",
  "response_format",
  "response_format.type",
  "response_format.json_schema",
  "response_format.json_schema.name",
  "response_format.json_schema.schema",
  "response_format.json_schema.strict",
  "reasoning_effort",
  "max_completion_tokens",
  "stream",
  "type",
  "required",
  "additionalProperties",
  "properties",
  "items",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "response_format.json_schema.schema.properties.summary",
  "response_format.json_schema.schema.properties.summary.minLength",
  "response_format.json_schema.schema.properties.summary.maxLength",
  "response_format.json_schema.schema.properties.scope",
  "response_format.json_schema.schema.properties.scope.minLength",
  "response_format.json_schema.schema.properties.scope.maxLength",
  "response_format.json_schema.schema.properties.nextStep",
  "response_format.json_schema.schema.properties.nextStep.minLength",
  "response_format.json_schema.schema.properties.nextStep.maxLength",
] as const;

type RejectionReason =
  | "schema_string_bounds"
  | "schema_array_bounds"
  | "schema_required_fields"
  | "schema_additional_properties"
  | "schema_compilation_failed"
  | "schema_rejected"
  | "parameter_rejected"
  | "input_too_large"
  | "output_validation_failed"
  | "unknown";

const rejectionPatterns: ReadonlyArray<readonly [RejectionReason, RegExp]> = [
  [
    "output_validation_failed",
    /\b(?:generated json does not match|failed to generate (?:valid )?json|json validation failed)\b/i,
  ],
  [
    "input_too_large",
    /\b(?:context length exceeded|maximum context length|request (?:body |payload )?too large|too many (?:input )?tokens)\b/i,
  ],
  [
    "schema_string_bounds",
    /\b(?:minlength|maxlength)\b.{0,120}\b(?:unsupported|not supported|not allowed|must|cannot|exceeds?|invalid|limit|too large|too small)\b|\b(?:unsupported|invalid)\b.{0,80}\b(?:minlength|maxlength)\b/i,
  ],
  [
    "schema_array_bounds",
    /\b(?:minitems|maxitems)\b.{0,120}\b(?:unsupported|not supported|not allowed|must|cannot|exceeds?|invalid|limit)\b/i,
  ],
  [
    "schema_required_fields",
    /\b(?:required.{0,80}(?:missing|must|not supplied)|missing required (?:field|property)|all (?:fields|properties) must be required)\b/i,
  ],
  [
    "schema_additional_properties",
    /\badditionalproperties\b.{0,80}\b(?:must|false|required|not allowed)\b/i,
  ],
  [
    "schema_compilation_failed",
    /\b(?:failed to compile (?:json )?schema|schema compilation failed|schema (?:is )?too complex|grammar (?:is )?too large)\b/i,
  ],
  [
    "schema_rejected",
    /\b(?:invalid (?:json )?schema|schema is not supported)\b/i,
  ],
  [
    "parameter_rejected",
    /\b(?:unsupported (?:parameter|argument)|(?:parameter|argument) is not supported|unknown (?:parameter|argument)|unrecognized (?:parameter|argument))\b/i,
  ],
];

export function extractGroqErrorDiagnostics(value: unknown): {
  providerErrorCode: (typeof providerCodes)[number] | "unknown";
  providerErrorParam: (typeof providerParams)[number] | "unknown";
  rejectionReason: RejectionReason;
} {
  const error = isRecord(value) && isRecord(value.error) ? value.error : {};
  // Return literals from the lists, never a substring or normalized upstream value.
  const providerErrorCode =
    providerCodes.find((allowed) => allowed === error.code) ?? "unknown";
  const providerErrorParam =
    providerParams.find((allowed) => allowed === error.param) ?? "unknown";
  const message = error.message;

  let rejectionReason: RejectionReason = "unknown";
  if (
    providerErrorCode === "context_length_exceeded" ||
    providerErrorCode === "request_too_large"
  ) {
    rejectionReason = "input_too_large";
  } else if (providerErrorCode === "json_validate_failed") {
    rejectionReason = "output_validation_failed";
  } else if (typeof message === "string" && message.length <= 2048) {
    // Bounded pattern hints are not authoritative diagnoses. Never retain the message.
    rejectionReason =
      rejectionPatterns.find(([, pattern]) => pattern.test(message))?.[0] ??
      "unknown";
  }

  return { providerErrorCode, providerErrorParam, rejectionReason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
