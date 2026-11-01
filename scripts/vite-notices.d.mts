import type { Plugin } from 'vite'

/** Writes THIRD-PARTY-NOTICES.txt into the build output, listing the licences of all bundled npm packages. */
export function thirdPartyNotices(options: { title: string }): Plugin
