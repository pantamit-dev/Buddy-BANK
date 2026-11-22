export interface BankInfo {
  id: string;
  name: string;
  shortName: string;
  thaiName: string;
  scheme: string;
  universalLink?: string;
  androidPackage?: string;
  iosAppStoreId?: string;
  brandColor: string;
  textColor: string;
  iconBg: string;
}

/**
 * Registry of supported Thai Banking Apps with their URL schemes and fallback metadata.
 */
export const THAI_BANKS: BankInfo[] = [
  {
    id: "kbank",
    name: "K PLUS",
    shortName: "KBANK",
    thaiName: "กสิกรไทย",
    scheme: "kplus://",
    androidPackage: "com.kasikorn.retail.mbanking.wap",
    iosAppStoreId: "361170631",
    brandColor: "#137f44",
    textColor: "#ffffff",
    iconBg: "bg-emerald-600",
  },
  {
    id: "scb",
    name: "SCB EASY",
    shortName: "SCB",
    thaiName: "ไทยพาณิชย์",
    scheme: "scbeasy://",
    androidPackage: "com.scb.phone",
    iosAppStoreId: "568388484",
    brandColor: "#4e2a84",
    textColor: "#ffffff",
    iconBg: "bg-purple-800",
  },
  {
    id: "ktb",
    name: "Krungthai NEXT",
    shortName: "KTB",
    thaiName: "กรุงไทย",
    scheme: "ktbnext://",
    androidPackage: "ktbcs.netbank",
    iosAppStoreId: "436753378",
    brandColor: "#00a5e5",
    textColor: "#ffffff",
    iconBg: "bg-sky-500",
  },
  {
    id: "bbl",
    name: "Bualuang mBanking",
    shortName: "BBL",
    thaiName: "กรุงเทพ",
    scheme: "bualuangmbanking://",
    androidPackage: "com.bbl.mLife",
    iosAppStoreId: "420364956",
    brandColor: "#1e3a8a",
    textColor: "#ffffff",
    iconBg: "bg-blue-900",
  },
  {
    id: "ttb",
    name: "ttb touch",
    shortName: "TTB",
    thaiName: "ทีทีบี",
    scheme: "ttbtouch://",
    androidPackage: "com.ttbbank.oneapp",
    iosAppStoreId: "587425789",
    brandColor: "#002d62",
    textColor: "#ffffff",
    iconBg: "bg-indigo-950",
  },
  {
    id: "gsb",
    name: "MyMo by GSB",
    shortName: "GSB",
    thaiName: "ออมสิน",
    scheme: "mymo://",
    androidPackage: "com.myais.mymo",
    iosAppStoreId: "987941018",
    brandColor: "#eb1985",
    textColor: "#ffffff",
    iconBg: "bg-pink-600",
  },
  {
    id: "bay",
    name: "KMA krungsri",
    shortName: "BAY",
    thaiName: "กรุงศรี",
    scheme: "kma://",
    androidPackage: "com.krungsri.kma",
    iosAppStoreId: "576489463",
    brandColor: "#ffc20e",
    textColor: "#1f2937",
    iconBg: "bg-amber-400",
  },
  {
    id: "truemoney",
    name: "TrueMoney",
    shortName: "TMN",
    thaiName: "ทรูมันนี่",
    scheme: "truemoney://",
    androidPackage: "th.co.truemoney.wallet",
    iosAppStoreId: "663885752",
    brandColor: "#ff6f00",
    textColor: "#ffffff",
    iconBg: "bg-orange-600",
  },
];

/**
 * Triggers the bank application via deep link on mobile.
 * Also handles fallback if the app isn't installed.
 */
export function openBankApp(bank: BankInfo): boolean {
  if (typeof window === "undefined") return false;

  // Attempt opening via custom scheme
  try {
    window.location.href = bank.scheme;
    return true;
  } catch (err) {
    console.warn(`[BankDeepLink] Failed to trigger ${bank.scheme}:`, err);
    return false;
  }
}
