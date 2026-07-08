// basePath is prod-only (see next.config.ts) and plain <a> hrefs inside core
// components don't get Next's automatic basePath prefix — so pages must pass
// fully-prefixed paths down.
export const BASE_PATH = process.env.NODE_ENV === "production" ? "/admin" : ""

export const ROADMAPS_PATH = `${BASE_PATH}/roadmaps`
