import type { OpportunityEvidence } from "@/domain/opportunities/types";
import type {
  SignalConfidence,
  SignalEvidence,
} from "@/features/audits/analyzer/signals";

type SignalLike<T> = {
  value: T;
  confidence: SignalConfidence;
  evidence: SignalEvidence[];
};

export function getBooleanSignal(
  signals: Record<string, unknown>,
  path: string[],
): SignalLike<boolean> | null {
  return getSignalValue(signals, path, (value): value is boolean => {
    return typeof value === "boolean";
  });
}

export function getNumberSignal(
  signals: Record<string, unknown>,
  path: string[],
): SignalLike<number> | null {
  return getSignalValue(signals, path, (value): value is number => {
    return typeof value === "number" && Number.isFinite(value);
  });
}

export function getHvacServicePagesSignal(
  signals: Record<string, unknown>,
): SignalLike<{ detected: boolean; services: string[] }> | null {
  return getSignalValue(signals, ["hvac", "hvacServicePages"], isHvacServicePagesValue);
}

export function createOpportunityEvidence<T>(
  signalKey: string,
  signal: SignalLike<T>,
  details: string,
): OpportunityEvidence {
  return {
    signal: signalKey,
    observed_value: signal.value,
    scope: "analyzed_page",
    source: "deterministic_analyzer",
    details,
    ...(signal.evidence.length > 0
      ? { analyzer_evidence: signal.evidence.slice(0, 5) }
      : {}),
  };
}

function getSignalValue<T>(
  signals: Record<string, unknown>,
  path: string[],
  isValue: (value: unknown) => value is T,
): SignalLike<T> | null {
  const signal = getRecordAtPath(signals, path);

  if (!signal || !isValue(signal.value) || !isSignalConfidence(signal.confidence)) {
    return null;
  }

  return {
    value: signal.value,
    confidence: signal.confidence,
    evidence: Array.isArray(signal.evidence)
      ? signal.evidence.filter(isSignalEvidence)
      : [],
  };
}

function getRecordAtPath(
  value: Record<string, unknown>,
  path: string[],
): Record<string, unknown> | null {
  let current: unknown = value;

  for (const segment of path) {
    if (!isRecord(current)) {
      return null;
    }

    current = current[segment];
  }

  return isRecord(current) ? current : null;
}

function isHvacServicePagesValue(
  value: unknown,
): value is { detected: boolean; services: string[] } {
  return (
    isRecord(value) &&
    typeof value.detected === "boolean" &&
    Array.isArray(value.services) &&
    value.services.every((service) => typeof service === "string")
  );
}

function isSignalEvidence(value: unknown): value is SignalEvidence {
  return (
    isRecord(value) &&
    typeof value.source === "string" &&
    typeof value.detail === "string" &&
    (value.snippet === undefined || typeof value.snippet === "string") &&
    (value.url === undefined || typeof value.url === "string") &&
    (value.count === undefined || typeof value.count === "number")
  );
}

function isSignalConfidence(value: unknown): value is SignalConfidence {
  return value === "high" || value === "medium" || value === "low";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
