import { test as base } from '@playwright/test';

/** Profil « 3G lente » (Chrome DevTools). */
export const SLOW_3G = {
  offline: false,
  latency: 400,
  downloadThroughput: (500 * 1024) / 8,
  uploadThroughput: (500 * 1024) / 8,
};

export const test = base.extend<{ slow3g: void }>({
  slow3g: async ({ page }, provide) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', SLOW_3G);
    await provide();
  },
});

export { expect } from '@playwright/test';
