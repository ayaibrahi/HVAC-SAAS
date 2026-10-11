export type StructuredJsonRequest = {
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  maxOutputTokens: number;
  signal?: AbortSignal;
};
