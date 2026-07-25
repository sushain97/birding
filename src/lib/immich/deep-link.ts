const IMMICH_ANDROID_PACKAGE = "app.alextran.immich";

function isAndroid(): boolean {
  return (
    typeof navigator !== "undefined" && /android/i.test(navigator.userAgent)
  );
}

export function immichAssetHref(assetId: string, webUrl: string): string {
  if (!isAndroid()) return webUrl;
  return (
    `intent://asset?id=${assetId}#Intent;scheme=immich;` +
    `package=${IMMICH_ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(webUrl)};end`
  );
}
