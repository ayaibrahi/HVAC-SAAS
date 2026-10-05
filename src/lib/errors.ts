export class AppError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

export function getPublicErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  if (error instanceof AppError) {
    return error.message;
  }

  return fallback;
}

export function toSearchParam(value: string) {
  return encodeURIComponent(value);
}
