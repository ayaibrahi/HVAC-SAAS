import type { DeliverySnapshotPublicView } from "@/domain/proposals/types";
import { formatSnapshotMoney } from "@/features/proposals/pdf/format";
import { renderPublicAgencyLogo } from "./agency-logo";

export const proposalUnavailableTitle = "Proposal unavailable";

export const publicShareSecurityHeaders = {
  "Cache-Control": "private, no-store",
  "Content-Security-Policy":
    "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; img-src data:; font-src 'none'; script-src 'none'; connect-src 'none'; object-src 'none'; style-src 'unsafe-inline'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;

export function renderPublicProposalHtml(view: DeliverySnapshotPublicView) {
  return renderDocument({
    title: view.title,
    body: `
      <header class="header">
        ${renderPublicAgencyLogo(view.agency.logoDataUrl)}
        <p class="agency">${escapeHtml(view.agency.displayName)}</p>
        <h1>${escapeHtml(view.title)}</h1>
        <p class="prepared">Prepared for ${escapeHtml(view.prospect.displayName)}</p>
        ${view.prospect.websiteUrl ? `<p class="website">${escapeHtml(view.prospect.websiteUrl)}</p>` : ""}
      </header>

      ${renderSection("Summary", view.summary)}
      ${renderSection("Scope", view.scope)}

      <section>
        <h2>Services</h2>
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Details</th>
              <th class="numeric">Qty</th>
              <th class="numeric">Unit</th>
              <th class="numeric">Total</th>
            </tr>
          </thead>
          <tbody>
            ${view.lineItems.map((item) => renderLineItem(item, view.currency)).join("")}
          </tbody>
        </table>
      </section>

      <section class="pricing">
        <h2>Pricing</h2>
        <dl>
          <div><dt>Subtotal</dt><dd>${escapeHtml(formatSnapshotMoney(view.pricing.subtotal, view.currency))}</dd></div>
          ${
            view.pricing.discountAmount > 0
              ? `<div><dt>Discount</dt><dd>${escapeHtml(formatSnapshotMoney(view.pricing.discountAmount, view.currency))}</dd></div>`
              : ""
          }
          <div class="total"><dt>Total</dt><dd>${escapeHtml(formatSnapshotMoney(view.pricing.total, view.currency))}</dd></div>
        </dl>
      </section>

      ${renderSection("Next Step", view.nextStep)}
    `,
  });
}

export function renderProposalUnavailableHtml() {
  return renderDocument({
    title: proposalUnavailableTitle,
    body: `
      <div class="unavailable">
        <h1>${proposalUnavailableTitle}</h1>
        <p>This proposal link is unavailable.</p>
      </div>
    `,
  });
}

function renderDocument(input: { title: string; body: string }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow,noarchive">
    <title>${escapeHtml(input.title)}</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #172033;
        --muted: #5b6472;
        --line: #d8dee8;
        --surface: #f7f8fb;
      }

      * {
        box-sizing: border-box;
      }

      .agency-logo { display: block; width: 160px; height: 64px; object-fit: contain; object-position: left center; margin-bottom: 16px; }

      body {
        margin: 0;
        background: var(--surface);
        color: var(--ink);
        font-family: Arial, Helvetica, sans-serif;
        line-height: 1.5;
      }

      main {
        width: min(960px, calc(100% - 32px));
        margin: 32px auto;
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 32px;
      }

      .header {
        border-bottom: 1px solid var(--line);
        margin-bottom: 28px;
        padding-bottom: 24px;
      }

      .agency {
        color: var(--muted);
        font-size: 0.9rem;
        font-weight: 700;
        margin: 0 0 8px;
        text-transform: uppercase;
      }

      h1 {
        font-size: 2rem;
        line-height: 1.2;
        margin: 0;
      }

      h2 {
        font-size: 1rem;
        margin: 28px 0 8px;
      }

      p {
        margin: 0;
      }

      .prepared,
      .website,
      .body {
        color: var(--muted);
        white-space: pre-wrap;
      }

      .prepared {
        margin-top: 12px;
      }

      .website {
        margin-top: 4px;
      }

      table {
        border-collapse: collapse;
        margin-top: 12px;
        width: 100%;
      }

      th,
      td {
        border-bottom: 1px solid var(--line);
        padding: 12px 8px;
        text-align: left;
        vertical-align: top;
      }

      th {
        color: var(--muted);
        font-size: 0.8rem;
        text-transform: uppercase;
      }

      .numeric {
        text-align: right;
        white-space: nowrap;
      }

      .pricing dl {
        margin: 12px 0 0;
      }

      .pricing div {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        padding: 8px 0;
      }

      .pricing dt {
        color: var(--muted);
      }

      .pricing dd {
        margin: 0;
        font-weight: 700;
      }

      .pricing .total {
        border-top: 1px solid var(--line);
        margin-top: 6px;
        padding-top: 14px;
      }

      .unavailable {
        max-width: 560px;
        text-align: center;
      }

      @media (max-width: 720px) {
        main {
          border-left: 0;
          border-right: 0;
          border-radius: 0;
          margin: 0;
          min-height: 100vh;
          padding: 24px 16px;
          width: 100%;
        }

        table,
        thead,
        tbody,
        tr,
        th,
        td {
          display: block;
        }

        thead {
          display: none;
        }

        tr {
          border-bottom: 1px solid var(--line);
          padding: 10px 0;
        }

        td {
          border-bottom: 0;
          padding: 4px 0;
        }

        .numeric {
          text-align: left;
        }
      }
    </style>
  </head>
  <body>
    <main>
      ${input.body}
    </main>
  </body>
</html>`;
}

function renderSection(label: string, value: string) {
  if (!value.trim()) {
    return "";
  }

  return `<section><h2>${escapeHtml(label)}</h2><p class="body">${escapeHtml(value)}</p></section>`;
}

function renderLineItem(
  item: DeliverySnapshotPublicView["lineItems"][number],
  currency: DeliverySnapshotPublicView["currency"],
) {
  const detailParts = [item.serviceDescription, item.description].filter(
    (value): value is string => Boolean(value?.trim()),
  );

  return `
    <tr>
      <td><strong>${escapeHtml(item.serviceName)}</strong></td>
      <td>${escapeHtml(detailParts.join("\n"))}</td>
      <td class="numeric">${item.quantity}</td>
      <td class="numeric">${escapeHtml(formatSnapshotMoney(item.unitPrice, currency))}</td>
      <td class="numeric">${escapeHtml(formatSnapshotMoney(item.lineTotal, currency))}</td>
    </tr>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
