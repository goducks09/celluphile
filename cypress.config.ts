import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    allowCypressEnv: false,
    baseUrl: 'http://localhost:3000',
    setupNodeEvents(on, config) {
      // Wipe the test database after the entire Cypress run finishes.
      // This runs in the Node.js process so we use fetch directly.
      on('after:run', async () => {
        const baseUrl = config.baseUrl ?? 'http://localhost:3000';
        const secret = process.env.TEST_RESET_SECRET;

        if (!secret) {
          console.error('[Cypress] ❌ TEST_RESET_SECRET is not set. Skipping post-run DB reset.');
          return;
        }

        try {
          const res = await fetch(`${baseUrl}/api/test/reset-db`, {
            method: 'POST',
            headers: { 'x-test-secret': secret },
          });

          if (res.ok) {
            console.log('[Cypress] ✅ Test database wiped after run.');
          } else {
            console.warn(`[Cypress] ⚠️  DB reset responded with status ${res.status}.`);
          }
        } catch (err) {
          console.error('[Cypress] ❌ Failed to reset test database after run:', err);
        }
      });
    },
  },
});

