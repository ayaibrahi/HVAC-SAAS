"use client";

import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { Upload, Trash2 } from "lucide-react";
import { useInterface } from "@/components/ui-preferences";
import { brandingCopy } from "../copy";
import type { BrandingState } from "../service";

export function LogoSettings({
  agencyName,
  initial,
}: {
  agencyName: string;
  initial: BrandingState;
}) {
  const { locale } = useInterface();
  const copy = brandingCopy[locale];
  const [assetId, setAssetId] = useState(initial.activeAssetId);
  const [pending, setPending] = useState(false);
  const [failedImage, setFailedImage] = useState(false);
  const [notice, setNotice] = useState<"saved" | "removed" | "failed" | null>(
    null,
  );
  const message = notice ? copy[notice] : "";
  const error = notice === "failed";
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  async function save(remove: boolean) {
    if (busy.current || !initial.available) return;
    const file = input.current?.files?.[0];
    if (
      !remove &&
      (!file ||
        file.size > 1_048_576 ||
        !["image/png", "image/jpeg"].includes(file.type))
    ) {
      setNotice("failed");
      return;
    }
    busy.current = true;
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch("/api/agency-branding", {
        method: remove ? "DELETE" : "PUT",
        credentials: "same-origin",
        ...(file && !remove
          ? { headers: { "Content-Type": file.type }, body: file }
          : {}),
      });
      if (!response.ok) throw new Error("Branding unavailable");
      const result: unknown = await response.json();
      if (
        !result ||
        typeof result !== "object" ||
        !("assetId" in result) ||
        !(
          result.assetId === null ||
          (typeof result.assetId === "string" &&
            /^[a-f0-9-]{36}$/u.test(result.assetId))
        )
      )
        throw new Error("Invalid response");
      setAssetId(result.assetId);
      setFailedImage(false);
      setNotice(remove ? "removed" : "saved");
      if (input.current) input.current.value = "";
    } catch {
      setNotice("failed");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(false);
  }

  return (
    <section
      className="border-t border-border pt-6"
      aria-labelledby="agency-logo-heading"
    >
      <h2 id="agency-logo-heading" className="text-lg font-semibold text-ink">
        {copy.title}
      </h2>
      <div className="mt-4 flex min-h-20 items-center gap-4">
        {assetId && !failedImage ? (
          <Image
            key={assetId}
            src={`/api/agency-branding?v=${assetId}`}
            alt={agencyName}
            width={160}
            height={64}
            unoptimized
            className="h-16 w-40 rounded border border-border object-contain p-2"
            style={{ backgroundColor: "#fff" }}
            onError={() => setFailedImage(true)}
          />
        ) : (
          <p className="max-w-full break-words font-semibold text-ink">
            {agencyName}
          </p>
        )}
      </div>
      {!initial.available ? (
        <p className="mt-3 text-sm text-muted">{copy.unavailable}</p>
      ) : null}
      <form
        onSubmit={submit}
        className="mt-4 flex flex-wrap items-end gap-3"
        aria-busy={pending}
      >
        <label className="w-full min-w-0 space-y-2 text-sm text-ink sm:w-auto sm:flex-1">
          <span>{copy.file} · 1 MB</span>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg"
            required
            disabled={pending || !initial.available}
            className="block w-full min-w-0 rounded-md border border-border p-2"
            aria-label={copy.file}
          />
        </label>
        <button
          type="submit"
          disabled={pending || !initial.available}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Upload size={16} aria-hidden="true" />
          {pending ? copy.pending : assetId ? copy.replace : copy.upload}
        </button>
        {assetId ? (
          <button
            type="button"
            onClick={() => void save(true)}
            disabled={pending || !initial.available}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-ink disabled:opacity-50"
          >
            <Trash2 size={16} aria-hidden="true" />
            {copy.remove}
          </button>
        ) : null}
      </form>
      <p
        role={error ? "alert" : "status"}
        aria-live="polite"
        className={`mt-3 min-h-5 text-sm ${error ? "text-red-700" : "text-muted"}`}
      >
        {message}
      </p>
    </section>
  );
}
