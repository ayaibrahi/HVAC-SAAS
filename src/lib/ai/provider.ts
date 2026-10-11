import "server-only";

import { z } from "zod";
import { callGroqStructuredJson, getGroqConfig } from "@/lib/ai/groq-chat";
import {
  callOpenAiStructuredJson,
  getConfiguredOpenAiModel,
} from "@/lib/ai/openai-responses";
import type { StructuredJsonRequest } from "@/lib/ai/types";
import { AppError } from "@/lib/errors";

export function createStructuredJsonProvider() {
  const selection = z
    .enum(["openai", "groq"])
    .safeParse(process.env.AI_PROVIDER);

  if (!selection.success) {
    throw new AppError(
      "Select a valid server AI_PROVIDER: openai or groq.",
      500,
    );
  }

  if (selection.data === "openai") {
    return {
      provider: "openai" as const,
      model: getConfiguredOpenAiModel(),
      generate: callOpenAiStructuredJson,
    };
  }

  const config = getGroqConfig();

  return {
    provider: "groq" as const,
    model: config.model,
    generate: (input: StructuredJsonRequest) =>
      callGroqStructuredJson(input, config),
  };
}
