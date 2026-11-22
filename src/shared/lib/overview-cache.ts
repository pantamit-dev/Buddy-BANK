// In-memory client cache for instant tab navigation (30s TTL)
export const overviewCache: Record<
  string,
  { data: any; recentDeposits: any[]; timestamp: number }
> = {};

export const CACHE_TTL_MS = 30_000;

export function invalidateOverviewCache(groupId?: string) {
  if (groupId) {
    delete overviewCache[groupId];
  } else {
    for (const key of Object.keys(overviewCache)) {
      delete overviewCache[key];
    }
  }
}
