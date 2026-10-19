import { describe, it, expect, beforeAll } from 'vitest';
import { GhostConnector } from '../../src/connectors/implementations/GhostConnector';
import { LemmyConnector } from '../../src/connectors/implementations/LemmyConnector';
import { FetchHttpClient } from '../../src/connectors/http/FetchHttpClient';

/**
 * Local Service Integration Test Suite for Ghost CMS and Lemmy.
 *
 * Requirements:
 * - Genuine integration tests run ONLY when local containers are reachable and configured.
 * - Never report mocked tests as live integration tests.
 * - If local services are offline, tests are cleanly skipped with clear diagnostics.
 */
describe('Local Service Live Integration Suite (Ghost & Lemmy)', () => {
  const ghostUrl = process.env.GHOST_API_URL || 'http://localhost:2368';
  const ghostAdminKey = process.env.GHOST_ADMIN_API_KEY;

  const lemmyUrl = process.env.LEMMY_INSTANCE_URL || 'http://localhost:8536';
  const lemmyAuthToken = process.env.LEMMY_AUTH_TOKEN;
  const lemmyCommunityId = process.env.LEMMY_COMMUNITY_ID ? Number(process.env.LEMMY_COMMUNITY_ID) : undefined;

  let isGhostReachable = false;
  let isLemmyReachable = false;

  const httpClient = new FetchHttpClient(2000); // 2s timeout for connectivity probing

  beforeAll(async () => {
    // Probe Ghost local readiness
    try {
      const ghostPing = await httpClient.request(`${ghostUrl}/ghost/api/admin/site/`, {
        method: 'GET',
      });
      if (ghostPing.status === 200 || ghostPing.status === 401 || ghostPing.status === 403) {
        isGhostReachable = true;
      }
    } catch {
      isGhostReachable = false;
    }

    // Probe Lemmy local readiness
    try {
      const lemmyPing = await httpClient.request(`${lemmyUrl}/api/v3/site`, {
        method: 'GET',
      });
      if (lemmyPing.status === 200) {
        isLemmyReachable = true;
      }
    } catch {
      isLemmyReachable = false;
    }
  });

  describe('Ghost CMS Local Integration', () => {
    it('should report clear configuration status without claiming live certification when credentials missing', async () => {
      const unconfiguredGhost = new GhostConnector({
        apiUrl: ghostUrl,
        adminApiKey: undefined,
      });

      const res = await unconfiguredGhost.publish({
        destinationKey: 'ghost',
        content: { title: 'Test', body: '<p>Test</p>' },
      });

      expect(res.success).toBe(false);
      expect(res.isSimulated).toBe(false);
      expect(res.error?.code).toBe('AUTH_CONFIG_MISSING');
      expect(res.error?.message).toContain('GHOST_ADMIN_API_KEY');
    });

    it('should execute genuine live publication, verification, and deletion when Ghost container is running and configured', async () => {
      if (!isGhostReachable || !ghostAdminKey) {
        console.log(
          `[LOCAL INTEGRATION NOTICE] Ghost live tests skipped: reachable=${isGhostReachable}, keyConfigured=${Boolean(
            ghostAdminKey
          )}. Start docker compose and configure GHOST_ADMIN_API_KEY to execute.`
        );
        return;
      }

      const liveGhost = new GhostConnector({
        apiUrl: ghostUrl,
        adminApiKey: ghostAdminKey,
      });

      // 1. Genuine Publish to live local Ghost
      const pubRes = await liveGhost.publish({
        destinationKey: 'ghost',
        content: {
          title: `[Integration Test] Ghost Live Post ${Date.now()}`,
          body: '<p>Automated integration test post on local Ghost instance.</p>',
          summary: 'Integration test summary',
          tags: ['test', 'integration'],
        },
      });

      expect(pubRes.success).toBe(true);
      expect(pubRes.isSimulated).toBe(false);
      expect(pubRes.externalId).toBeDefined();

      const externalId = pubRes.externalId!;

      // 2. Genuine Verify from live local Ghost
      const verifyRes = await liveGhost.verify({
        destinationKey: 'ghost',
        externalId,
      });

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.verified).toBe(true);
      expect(verifyRes.status).toBe('published');

      // 3. Genuine Delete (permanent cleanup) from live local Ghost
      const delRes = await liveGhost.delete({
        destinationKey: 'ghost',
        externalId,
      });

      expect(delRes.success).toBe(true);
      expect(delRes.deleted).toBe(true);
      expect(delRes.isSimulated).toBe(false);

      // 4. Confirm deletion
      const postDeleteVerify = await liveGhost.verify({
        destinationKey: 'ghost',
        externalId,
      });

      expect(postDeleteVerify.verified).toBe(false);
    });
  });

  describe('Lemmy Federated Link Aggregator Local Integration', () => {
    it('should report clear configuration status without claiming live certification when credentials missing', async () => {
      const unconfiguredLemmy = new LemmyConnector({
        instanceUrl: lemmyUrl,
        authToken: undefined,
      });

      const res = await unconfiguredLemmy.publish({
        destinationKey: 'lemmy',
        content: { title: 'Test', body: 'Test' },
      });

      expect(res.success).toBe(false);
      expect(res.isSimulated).toBe(false);
      expect(res.error?.code).toBe('AUTH_CONFIG_MISSING');
      expect(res.error?.message).toContain('LEMMY_AUTH_TOKEN');
    });

    it('should execute genuine live publication, verification, and deletion when Lemmy container is running and configured', async () => {
      if (!isLemmyReachable || !lemmyAuthToken || !lemmyCommunityId) {
        console.log(
          `[LOCAL INTEGRATION NOTICE] Lemmy live tests skipped: reachable=${isLemmyReachable}, tokenConfigured=${Boolean(
            lemmyAuthToken
          )}, communityConfigured=${Boolean(lemmyCommunityId)}. Start docker compose and configure credentials to execute.`
        );
        return;
      }

      const liveLemmy = new LemmyConnector({
        instanceUrl: lemmyUrl,
        authToken: lemmyAuthToken,
        communityId: lemmyCommunityId,
      });

      // 1. Genuine Publish to live local Lemmy
      const pubRes = await liveLemmy.publish({
        destinationKey: 'lemmy',
        content: {
          title: `[Integration Test] Lemmy Live Post ${Date.now()}`,
          body: 'Automated integration test post on local Lemmy instance.',
        },
      });

      expect(pubRes.success).toBe(true);
      expect(pubRes.isSimulated).toBe(false);
      expect(pubRes.externalId).toBeDefined();

      const externalId = pubRes.externalId!;

      // 2. Genuine Verify
      const verifyRes = await liveLemmy.verify({
        destinationKey: 'lemmy',
        externalId,
      });

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.verified).toBe(true);

      // 3. Genuine Delete (soft-delete / tombstone in ActivityPub)
      const delRes = await liveLemmy.delete({
        destinationKey: 'lemmy',
        externalId,
      });

      expect(delRes.success).toBe(true);
      expect(delRes.deleted).toBe(true);
      expect(delRes.isSimulated).toBe(false);

      // 4. Query status confirming soft-deleted state
      const statusRes = await liveLemmy.getStatus({
        destinationKey: 'lemmy',
        externalId,
      });

      expect(statusRes.status).toBe('deleted');
    });
  });
});
