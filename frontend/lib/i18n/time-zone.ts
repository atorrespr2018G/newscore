// Pin a single editorial time zone so server and client format dates
// identically. Without a fixed zone the server falls back to UTC while the
// browser uses local time, which triggers React hydration mismatches.
//
// The value uses the NEXT_PUBLIC_ prefix so the exact same string is inlined
// for both server and client bundles.
const DEFAULT_TIME_ZONE = 'America/New_York'

/** Editorial time zone applied to every server- and client-rendered date. */
export const EDITORIAL_TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE ?? DEFAULT_TIME_ZONE
