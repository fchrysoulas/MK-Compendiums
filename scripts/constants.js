export const MODULE_ID = "mk-compendiums";

export function getModuleVersion() {
  return globalThis.game?.modules?.get?.(MODULE_ID)?.version
    ?? globalThis.game?.data?.modules?.find?.(module => module?.id === MODULE_ID)?.version
    ?? "unknown";
}

export const EXPORT_SCHEMA = "mk-compendiums.v1";
export const DEFAULT_BATCH_SIZE = 100;
export const DEFAULT_INDEX_CONCURRENCY = 4;
