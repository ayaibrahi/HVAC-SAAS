import { AnalyzerError } from "./errors";

export type HtmlElement = {
  attrs: Record<string, string>;
  text: string;
  raw: string;
};

export type HtmlLink = {
  attrs: Record<string, string>;
  href: string | null;
  text: string;
  localTargetFound: boolean | null;
  sameOrigin: boolean;
};

export type ParsedHtmlDocument = {
  visibleText: string;
  mainText: string;
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
  incompleteMarkup: boolean;
};

export function parseHtmlDocument(
  html: string,
  baseUrl: string,
): ParsedHtmlDocument {
  const parsed = readStaticHtml(html);
  const pageUrl = new URL(baseUrl);
  const elements = (name: string) =>
    parsed.elements.filter((element) => element.name === name);
  const anchors = elements("a").map((element) => {
    const href = normalizeHref(element.attrs.href ?? null, baseUrl);
    const target = href ? new URL(href) : null;
    const sameDocument =
      target?.origin === pageUrl.origin &&
      target?.pathname === pageUrl.pathname &&
      target?.search === pageUrl.search;
    return {
      attrs: element.attrs,
      href,
      text: normalizeWhitespace(
        [element.text, element.attrs["aria-label"], element.attrs.title]
          .filter(Boolean)
          .join(" "),
      ),
      localTargetFound:
        sameDocument && element.attrs.href?.includes("#")
          ? parsed.ids.has(decodeFragment(target?.hash.slice(1) ?? ""))
          : null,
      sameOrigin: target?.origin === pageUrl.origin,
    };
  });

  return {
    visibleText: parsed.text,
    mainText: parsed.mainText,
    title: parsed.title,
    metaTags: elements("meta"),
    linkTags: elements("link"),
    anchors,
    buttons: elements("button"),
    inputs: elements("input"),
    forms: elements("form"),
    images: elements("img"),
    h1: elements("h1"),
    h2: elements("h2"),
    hasJsonLd: parsed.hasJsonLd,
    incompleteMarkup: parsed.incompleteMarkup,
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
    (tag.attrs.rel ?? "").toLowerCase().split(/\s+/).includes("canonical"),
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

const voidTags = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
const capturedTags = new Set([
  "a",
  "button",
  "input",
  "form",
  "img",
  "h1",
  "h2",
  "meta",
  "link",
]);
const textBoundaries = new Set([
  "a",
  "button",
  "br",
  "div",
  "p",
  "section",
  "article",
  "header",
  "nav",
  "footer",
  "main",
  "body",
  "form",
  "h1",
  "h2",
  "h3",
  "li",
  "td",
]);
type Capture = {
  name: string;
  attrs: Record<string, string>;
  textStart: number;
  textEnd: number;
  markupStart: number;
  markupEnd: number;
};
type Frame = {
  name: string;
  hidden: boolean;
  visibilityHidden: boolean;
  structuralNonContent: boolean;
  nonContent: boolean;
  chrome: boolean;
  capture?: Capture;
};

// Tokenize quoted attributes and HTML whitespace, not paired-tag regex matches.
// This is static extraction, not HTML5 layout/tree repair. Shared text offsets and
// bounded nesting avoid recursive traversal and repeated subtree materialization.
function readStaticHtml(html: string) {
  const frames: Frame[] = [];
  const captures: Capture[] = [];
  const text: string[] = [],
    mainText: string[] = [];
  const markup: string[] = [];
  const ids = new Set<string>();
  let markupLength = 0;
  let textLength = 0,
    position = 0,
    tokens = 0;
  let title: string | null = null,
    hasJsonLd = false,
    incompleteMarkup = false;
  const append = (value: string) => {
    const frame = frames.at(-1);
    if (frame?.nonContent) return;
    text.push(value);
    textLength += value.length;
    if (!frame?.chrome) mainText.push(value);
    markup.push(value);
    markupLength += value.length;
  };
  const closeFrom = (index: number) => {
    for (let i = frames.length - 1; i >= index; i -= 1) {
      const capture = frames[i].capture;
      if (capture) {
        capture.textEnd = textLength;
        capture.markupEnd = markupLength;
      }
    }
    frames.length = index;
  };
  while (position < html.length) {
    if (++tokens > 50_000 || frames.length > 128) {
      throw new AnalyzerError(
        "CONTENT_NOT_VERIFIABLE",
        "This page's markup could not be inspected reliably. No website recommendations were made.",
        422,
      );
    }
    const next = html.indexOf("<", position);
    if (next < 0) {
      append(html.slice(position));
      break;
    }
    append(html.slice(position, next));
    if (html.startsWith("<!--", next)) {
      const end = html.indexOf("-->", next + 4);
      if (end < 0) {
        incompleteMarkup = true;
        break;
      }
      position = end + 3;
      continue;
    }
    if (html.startsWith("<!", next) || html.startsWith("<?", next)) {
      const end = findTagEnd(html, next + 2);
      if (end < 0) {
        incompleteMarkup = true;
        break;
      }
      position = end + 1;
      continue;
    }
    const tag = /^<(\/)?([a-z][a-z0-9:-]*)(?=[\t\n\f\r />])/i.exec(
      html.slice(next),
    );
    if (!tag) {
      append(" ");
      position = next + 1;
      continue;
    }
    const end = findTagEnd(html, next + tag[0].length);
    if (end < 0) {
      incompleteMarkup = true;
      break;
    }
    const name = tag[2].toLowerCase();
    position = end + 1;
    if (tag[1]) {
      let index = frames.length - 1;
      while (index >= 0 && frames[index].name !== name) index -= 1;
      if (index >= 0) closeFrom(index);
      if (textBoundaries.has(name)) append(" ");
      continue;
    }
    // An anchor/control must never absorb the next adjacent or nested same-kind
    // control when markup is malformed or an optional end was omitted.
    if (capturedTags.has(name)) {
      const index = frames.findIndex((frame) => frame.name === name);
      if (index >= 0) {
        incompleteMarkup = true;
        closeFrom(index);
      }
    }
    const attrs = parseAttributes(html.slice(next + tag[0].length, end));
    const parent = frames.at(-1);
    const styles = staticStyleDeclarations(attrs.style ?? "");
    const hidden = Boolean(
      parent?.hidden ||
      isExplicitlyHidden(name, attrs, styles) ||
      name === "template" ||
      name === "noscript",
    );
    const visibility = styles.get("visibility")?.value;
    const visibilityHidden =
      visibility === "visible"
        ? false
        : ["hidden", "collapse"].includes(visibility ?? "") ||
          Boolean(parent?.visibilityHidden);
    const structuralNonContent = Boolean(
      parent?.structuralNonContent || name === "head",
    );
    const nonContent = hidden || visibilityHidden || structuralNonContent;
    const chrome = Boolean(
      parent?.chrome || ["header", "nav", "footer"].includes(name),
    );
    // Raw-text elements cannot introduce fake tags; RCDATA title/textarea is not
    // interpreted as controls either. Nothing is executed or fetched here.
    if (
      [
        "script",
        "style",
        "title",
        "textarea",
        "iframe",
        "xmp",
        "noembed",
      ].includes(name)
    ) {
      const closing = new RegExp(`</${name}[\\t\\n\\f\\r ]*>`, "gi");
      closing.lastIndex = position;
      const match = closing.exec(html);
      if (!match) {
        incompleteMarkup = true;
        break;
      }
      if (!hidden && name === "title" && title === null)
        title = normalizeWhitespace(html.slice(position, match.index));
      if (
        !hidden &&
        name === "script" &&
        (attrs.type ?? "").toLowerCase() === "application/ld+json"
      )
        hasJsonLd = true;
      position = match.index + match[0].length;
      continue;
    }
    if (textBoundaries.has(name)) append(" ");
    const captureAllowed =
      name === "meta" || name === "link" ? !hidden : !nonContent;
    const capture: Capture | undefined =
      capturedTags.has(name) && captureAllowed
        ? {
            name,
            attrs,
            textStart: textLength,
            textEnd: textLength,
            markupStart: markupLength,
            markupEnd: markupLength,
          }
        : undefined;
    if (capture) captures.push(capture);
    if (!nonContent) {
      if (attrs.id) ids.add(attrs.id);
      const opening = html.slice(next, position);
      markup.push(opening);
      markupLength += opening.length;
      if (capture && voidTags.has(name)) capture.markupEnd = markupLength;
    }
    if (!voidTags.has(name))
      frames.push({
        name,
        hidden,
        visibilityHidden,
        structuralNonContent,
        nonContent,
        chrome,
        capture,
      });
  }
  if (frames.some((frame) => frame.name === "body" || frame.name === "html"))
    incompleteMarkup = true;
  closeFrom(0);
  const allText = text.join("");
  const allMarkup = markup.join("");
  return {
    text: normalizeWhitespace(allText),
    mainText: normalizeWhitespace(mainText.join("")),
    title,
    hasJsonLd,
    incompleteMarkup,
    ids,
    elements: captures.map((capture) => ({
      name: capture.name,
      attrs: capture.attrs,
      text: normalizeWhitespace(
        allText.slice(capture.textStart, capture.textEnd),
      ),
      raw: allMarkup.slice(capture.markupStart, capture.markupEnd),
    })),
  };
}

function decodeFragment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function findTagEnd(html: string, start: number) {
  let quote = "";
  for (let i = start; i < html.length; i += 1) {
    const character = html[i];
    if (quote) {
      if (character === quote) quote = "";
    } else if (character === '"' || character === "'") quote = character;
    else if (character === ">") return i;
  }
  return -1;
}

type StaticStyle = { value: string; important: boolean };
function isExplicitlyHidden(
  name: string,
  attrs: Record<string, string>,
  styles: Map<string, StaticStyle>,
) {
  if (
    Object.hasOwn(attrs, "hidden") ||
    Object.hasOwn(attrs, "inert") ||
    attrs["aria-hidden"]?.trim().toLowerCase() === "true" ||
    (name === "input" && attrs.type?.toLowerCase() === "hidden")
  )
    return true;
  return (
    styles.get("display")?.value === "none" ||
    styles.get("content-visibility")?.value === "hidden" ||
    /^0(?:\.0+)?$/.test(styles.get("opacity")?.value ?? "")
  );
}

function staticStyleDeclarations(style: string) {
  const result = new Map<string, StaticStyle>();
  // Inline declarations only: quotes, comments and parentheses cannot introduce
  // false property boundaries. No selectors, external CSS, variables or JS run.
  let declaration = "",
    quote = "",
    parentheses = 0;
  const commit = () => {
    const colon = declaration.indexOf(":");
    const property = declaration.slice(0, colon).trim().toLowerCase();
    if (
      colon < 0 ||
      !["display", "visibility", "content-visibility", "opacity"].includes(
        property,
      )
    )
      return;
    const raw = declaration
      .slice(colon + 1)
      .trim()
      .toLowerCase();
    const important = /!\s*important\s*$/.test(raw);
    const value = raw.replace(/!\s*important\s*$/, "").trim();
    const previous = result.get(property);
    if (!previous?.important || important)
      result.set(property, { value, important });
  };
  for (let i = 0; i <= style.length; i += 1) {
    const character = style[i] ?? ";";
    if (quote) {
      declaration += character;
      if (character === "\\" && i + 1 < style.length) declaration += style[++i];
      else if (character === quote) quote = "";
    } else if (style.startsWith("/*", i)) {
      const end = style.indexOf("*/", i + 2);
      if (end < 0) break;
      declaration += " ";
      i = end + 1;
    } else if (character === '"' || character === "'") {
      quote = character;
      declaration += character;
    } else if (character === ";" && parentheses === 0) {
      commit();
      declaration = "";
    } else {
      if (character === "(") parentheses += 1;
      if (character === ")") parentheses = Math.max(0, parentheses - 1);
      declaration += character;
    }
  }
  return result;
}

function parseAttributes(value: string) {
  const attrs: Record<string, string> = Object.create(null);
  const pattern =
    /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    const [, key, doubleQuoted, singleQuoted, unquoted] = match;
    if (Object.hasOwn(attrs, key.toLowerCase())) continue;
    attrs[key.toLowerCase()] = decodeHtmlEntities(
      doubleQuoted ?? singleQuoted ?? unquoted ?? "",
    );
  }

  return attrs;
}

function normalizeHref(href: string | null, baseUrl: string) {
  if (!href) {
    return null;
  }

  try {
    const url = new URL(href, baseUrl);
    return ["http:", "https:", "tel:", "mailto:"].includes(url.protocol)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    colon: ":",
    gt: ">",
    lt: "<",
    nbsp: " ",
    newline: "\n",
    quot: '"',
    tab: "\t",
  };

  return value
    .replace(/&#x([0-9a-f]+);/gi, (_entity, codepoint: string) =>
      safeCodePoint(Number.parseInt(codepoint, 16)),
    )
    .replace(/&#(\d+);/g, (_entity, codepoint: string) =>
      safeCodePoint(Number.parseInt(codepoint, 10)),
    )
    .replace(
      /&([a-z]+);/gi,
      (entity, name: string) => namedEntities[name.toLowerCase()] ?? entity,
    );
}

function safeCodePoint(value: number) {
  return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
    ? String.fromCodePoint(value)
    : "\ufffd";
}
