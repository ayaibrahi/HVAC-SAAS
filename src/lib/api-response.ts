import { NextResponse } from "next/server";
import { getValidationErrorMessage } from "@/lib/action-feedback";
import { AppError, getPublicErrorMessage } from "@/lib/errors";
import type { ZodError } from "zod";

export function jsonError(error: unknown) {
  const status = error instanceof AppError ? error.statusCode : 500;

  return NextResponse.json(
    {
      error: getPublicErrorMessage(error),
    },
    { status },
  );
}

export function jsonValidationError(error: ZodError) {
  return NextResponse.json(
    {
      error: getValidationErrorMessage(error),
    },
    { status: 422 },
  );
}

export async function parseJsonBody(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new AppError("Request body must be valid JSON.", 400);
  }
}

export async function parseOptionalJsonBody(request: Request) {
  const text = await request.text();

  if (text.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError("Request body must be valid JSON.", 400);
  }
}
