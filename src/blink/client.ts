import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: import.meta.env.VITE_BLINK_PROJECT_ID || 'safeguard-rms-app-pwh5iwpb',
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY || 'blnk_pk_eVCwzPuh9Dme8vXTTLVDjLSCw6DSNgdY',
  authRequired: false,
  auth: { mode: 'managed' },
})
