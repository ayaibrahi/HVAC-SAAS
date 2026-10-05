export type ProposalPdfDownload = {
  filename: string;
  bytes: Uint8Array;
};

export function createProposalPdfResponse(download: ProposalPdfDownload) {
  const body = new ArrayBuffer(download.bytes.byteLength);

  new Uint8Array(body).set(download.bytes);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${download.filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
