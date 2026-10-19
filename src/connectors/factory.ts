import { ConnectorRegistry } from './ConnectorRegistry';
import { MockConnector } from './MockConnector';
import { DevtoConnector } from './implementations/DevtoConnector';
import { GhostConnector } from './implementations/GhostConnector';
import { DiscourseConnector } from './implementations/DiscourseConnector';
import { LemmyConnector } from './implementations/LemmyConnector';
import { WebhookConnector } from './implementations/WebhookConnector';
import { AssistedConnector } from './implementations/AssistedConnector';

/**
 * Registers all six standard platform connectors plus the deterministic mock connector.
 */
export function registerStandardConnectors(registry: ConnectorRegistry): void {
  if (!registry.has('mock')) {
    registry.register(new MockConnector());
  }
  if (!registry.has('devto')) {
    registry.register(new DevtoConnector());
  }
  if (!registry.has('ghost')) {
    registry.register(new GhostConnector());
  }
  if (!registry.has('discourse')) {
    registry.register(new DiscourseConnector());
  }
  if (!registry.has('lemmy')) {
    registry.register(new LemmyConnector());
  }
  if (!registry.has('webhook')) {
    registry.register(new WebhookConnector());
  }
  if (!registry.has('assisted')) {
    registry.register(new AssistedConnector());
  }
}
