import { defineConfig } from 'cypress';
import { loadEnvConfig } from '@next/env';
import { MongoClient } from 'mongodb';

// Load .env.test.local (and other Next.js env files) into process.env
// so the Cypress Node process has access to MONGODB_URI, etc.
loadEnvConfig(process.cwd());

export default defineConfig({
  env: {
    testPassword: process.env.CYPRESS_testPassword,
  },
  e2e: {
    allowCypressEnv: false,
    baseUrl: 'http://localhost:3000',
    setupNodeEvents(on) {
      on('task', {
        async resetTestDb() {
          const uri = process.env.MONGODB_URI;
          if (!uri) {
            throw new Error('[Cypress] MONGODB_URI is not set. Cannot reset DB.');
          }

          const client = new MongoClient(uri);
          try {
            await client.connect();
            const db = client.db();
            const collections = await db.collections();
            for (const col of collections) {
              await col.drop().catch((err: any) => {
                // NamespaceNotFound (26) means the collection was already gone — safe to ignore.
                if (err.code !== 26) throw err;
              });
            }
            console.log('[Cypress] ✅ Test database wiped via task.');
          } finally {
            await client.close();
          }
          return null; // Cypress tasks must return a serializable value
        },
      });

      // Wipe the test database after the entire Cypress run finishes.
      on('after:run', async () => {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
          console.error('[Cypress] ❌ MONGODB_URI is not set. Skipping post-run DB reset.');
          return;
        }

        const client = new MongoClient(uri);
        try {
          await client.connect();
          const db = client.db();
          const collections = await db.collections();
          for (const col of collections) {
            await col.drop().catch((err: any) => {
              if (err.code !== 26) throw err;
            });
          }
          console.log('[Cypress] ✅ Test database wiped after run.');
        } catch (err) {
          console.error('[Cypress] ❌ Failed to reset test database after run:', err);
        } finally {
          await client.close();
        }
      });
    },
  },
});
