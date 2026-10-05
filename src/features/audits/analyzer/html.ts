export type HtmlElement = {
  attrs: Record<string, string>;
  text: string;
  raw: string;
};

export type HtmlLink = {
  attrs: Record<string, string>;
  href: string | null;
  text: string;
};

export type ParsedHtmlDocument = {
  visibleText: string;
  title: string | null;
  metaTags: HtmlElement[];
  linkTags: HtmlElement[];
  anchors: HtmlLink[];
  buttons: HtmlElement[];
  inputs: HtmlElement[];
  forms: HtmlElement[];
  images: HtmlElement[];
  h1: HtmlElement[];
  h2: HtmlElement[];
  hasJsonLd: boolean;
};

export function parseHtmlDocument(html: string, baseUrl: string): ParsedHtmlDocument {
  const scripts = getPairedTags(html, "script");
  const visibleHtml = removeNonContentHtml(html);
  const anchors = getPairedTags(html, "a").map((element) => ({
    attrs: element.attrs,
    href: normalizeHref(element.attrs.href ?? null, baseUrl),
    text: element.text,
  }));

  return {
    visibleText: normalizeWhitespace(stripTags(visibleHtml)),
    title: getPairedTags(html, "title").at(0)?.text ?? null,
    metaTags: getOpeningTags(html, "meta"),
    linkTags: getOpeningTags(html, "link"),
    anchors,
    buttons: getPairedTags(html, "button"),
    inputs: getOpeningTags(html, "input"),
    forms: getPairedTags(html, "form"),
    images: getOpeningTags(html, "img"),
    h1: getPairedTags(html, "h1"),
    h2: getPairedTags(html, "h2"),
    hasJsonLd: scripts.some((script) =>
      (script.attrs.type ?? "").toLowerCase().includes("application/ld+json"),
    ),
  };
}

export function getMetaContent(document: ParsedHtmlDocument, name: string) {
  const normalizedName = name.toLowerCase();

  return (
    document.metaTags.find((tag) => {
      const tagName = tag.attrs.name ?? tag.attrs.property;
      return tagName?.toLowerCase() === normalizedName;
    })?.attrs.content ?? null
  );
}

export function getCanonicalUrl(document: ParsedHtmlDocument, baseUrl: string) {
  const canonical = document.linkTags.find((tag) =>
    (tag.attrs.rel ?? "")
      .toLowerCase()
      .split(/\s+/)
      .includes("canonical"),
  );

  if (!canonical?.attrs.href) {
    return null;
  }

  return normalizeHref(canonical.attrs.href, baseUrl);
}

export function stripTags(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " "));
}

export function normalizeWhitespace(value: string) {
  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
}

function getOpeningTags(html: string, tagName: string): HtmlElement[] {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>`, "gi");
  const elements: HtmlElement[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    elements.push({
      attrs: parseAttributes(match[1] ?? ""),
      text: "",
      raw: match[0],
    });
  }

  return elements;
}

function getPairedTags(html: string, tagName: string): HtmlElement[] {
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const elements: HtmlElement[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    elements.push({
      attrs: parseAttributes(match[1] ?? ""),
      text: normalizeWhitespace(stripTags(match[2] ?? "")),
      raw: match[0],
    });
  }

  return elements;
}

function parseAttributes(value: string) {
  const attrs: Record<string, string> = {};
  const pattern = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    const [, key, doubleQuoted, singleQuoted, unquoted] = match;
    attrs[key.toLowerCase()] = decodeHtmlEntities(
      doubleQuoted ?? singleQuoted ?? unquoted ?? "",
    );
  }

  return attrs;
}

function removeNonContentHtml(html: string) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
}

function normalizeHref(href: string | null, baseUrl: string) {
  if (!href) {
    return null;
  }

  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
  };

  return value
    .replace(/&#x([0-9a-f]+);/gi, (_entity, codepoint: string) =>
      String.fromCodePoint(Number.parseInt(codepoint, 16)),
    )
    .replace(/&#(\d+);/g, (_entity, codepoint: string) =>
      String.fromCodePoint(Number.parseInt(codepoint, 10)),
    )
    .replace(/&([a-z]+);/gi, (entity, name: string) => namedEntities[name.toLowerCase()] ?? entity);
}
