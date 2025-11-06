export function isInAppBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // Zalo + một số in-app browser phổ biến
  return /Zalo|FBAN|FBAV|Instagram|Line|TikTok|Messenger/i.test(ua) || /\bwv\)/i.test(ua);
}