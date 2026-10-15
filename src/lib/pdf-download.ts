// Client download budget is independent of the authenticated, snapshot-only server route.
export const pdfDownloadTimeoutMs = 45_000;
const maxPdfBytes = 5 * 1024 * 1024;

export async function requestPdfDownload(
  href: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  if (!href.startsWith("/") || href.startsWith("//") || /[\\\r\n]/.test(href))
    throw new Error("Invalid download path");
  const response = await fetcher(href, {
    signal,
    credentials: "same-origin",
    redirect: "error",
    headers: { accept: "application/pdf" },
  });
  if (
    !response.ok ||
    !response.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/pdf") ||
    !response.body
  )
    throw new Error("PDF unavailable");
  if (Number(response.headers.get("content-length")) > maxPdfBytes)
    throw new Error("PDF too large");
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (signal.aborted) throw new Error("Download interrupted");
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxPdfBytes) throw new Error("PDF too large");
      chunks.push(new Uint8Array(chunk.value));
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const blob = new Blob(chunks, { type: "application/pdf" });
  if (!(await blob.slice(0, 5).text()).startsWith("%PDF-"))
    throw new Error("Invalid PDF");
  const suppliedName = response.headers
    .get("content-disposition")
    ?.match(/filename="([^"]+)"/i)?.[1];
  const filename =
    suppliedName && /^[a-zA-Z0-9._-]{1,180}\.pdf$/.test(suppliedName)
      ? suppliedName
      : "proposal.pdf";
  return { blob, filename };
}
