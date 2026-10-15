export type AnalyzerErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_PROTOCOL"
  | "URL_CREDENTIALS_NOT_ALLOWED"
  | "UNSAFE_PORT"
  | "UNSAFE_HOSTNAME"
  | "DNS_LOOKUP_FAILED"
  | "UNSAFE_IP_ADDRESS"
  | "FETCH_FAILED"
  | "FETCH_TIMEOUT"
  | "TOO_MANY_REDIRECTS"
  | "UNSAFE_REDIRECT"
  | "INVALID_REDIRECT"
  | "RESPONSE_TOO_LARGE"
  | "CONTENT_NOT_VERIFIABLE"
  | "UNSUPPORTED_CONTENT_TYPE";

export class AnalyzerError extends Error {
  readonly code: AnalyzerErrorCode;
  readonly publicMessage: string;
  readonly statusCode: number;

  constructor(
    code: AnalyzerErrorCode,
    publicMessage: string,
    statusCode = 400,
  ) {
    super(publicMessage);
    this.name = "AnalyzerError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.statusCode = statusCode;
  }
}

export function normalizeAnalyzerError(error: unknown) {
  if (error instanceof AnalyzerError) {
    return error;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new AnalyzerError(
      "FETCH_TIMEOUT",
      "The website did not respond before the audit timeout.",
      504,
    );
  }

  return new AnalyzerError(
    "FETCH_FAILED",
    "We could not fetch the submitted website safely.",
    502,
  );
}
