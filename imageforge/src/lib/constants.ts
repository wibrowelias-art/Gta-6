/** Shared, client-safe constants (no zod, no server imports). */
export const ALL_ASPECT_RATIOS = ["1:1", "4:3", "3:4", "3:2", "2:3", "16:9", "9:16"] as const;
export type AspectRatioValue = (typeof ALL_ASPECT_RATIOS)[number];
