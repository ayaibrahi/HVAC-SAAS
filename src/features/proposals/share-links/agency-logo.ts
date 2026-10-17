// Only the server's verified, bounded PNG projection is accepted; never a URL.
export function renderPublicAgencyLogo(dataUrl: string | null | undefined) {
  if (
    !dataUrl ||
    dataUrl.length > 1_398_128 ||
    !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/u.test(dataUrl)
  )
    return "";
  return `<img class="agency-logo" src="${dataUrl}" alt="Agency logo" width="160" height="64">`;
}
