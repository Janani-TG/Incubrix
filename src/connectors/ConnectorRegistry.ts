import { Connector } from './types';
import { ConnectorError } from './errors';

/**
 * Registry responsible for registering, retrieving, and managing destination connectors.
 */
export class ConnectorRegistry {
  private connectors = new Map<string, Connector>();

  /**
   * Register a new connector. Rejects duplicate destination keys and invalid connectors.
   */
  public register(connector: Connector): void {
    if (!connector || !connector.destinationKey || typeof connector.destinationKey !== 'string') {
      throw ConnectorError.invalidRequest(
        'Connector must provide a valid non-empty destinationKey.'
      );
    }

    const key = connector.destinationKey.trim();
    if (!key) {
      throw ConnectorError.invalidRequest(
        'destinationKey cannot be empty or blank.'
      );
    }

    if (this.connectors.has(key)) {
      throw ConnectorError.duplicate(key);
    }

    this.connectors.set(key, connector);
  }

  /**
   * Retrieve a connector by unique destination key.
   * Throws ConnectorError with code CONNECTOR_NOT_FOUND if not registered.
   */
  public get(destinationKey: string): Connector {
    if (!destinationKey || typeof destinationKey !== 'string') {
      throw ConnectorError.invalidRequest(
        'A valid destinationKey string is required to lookup connector.'
      );
    }

    const key = destinationKey.trim();
    const connector = this.connectors.get(key);

    if (!connector) {
      throw ConnectorError.notFound(key);
    }

    return connector;
  }

  /**
   * Check if a connector is registered for the specified destination key.
   */
  public has(destinationKey: string): boolean {
    if (!destinationKey || typeof destinationKey !== 'string') {
      return false;
    }
    return this.connectors.has(destinationKey.trim());
  }

  /**
   * Return all currently registered connectors.
   */
  public getAll(): Connector[] {
    return Array.from(this.connectors.values());
  }

  /**
   * Return all registered destination keys.
   */
  public getKeys(): string[] {
    return Array.from(this.connectors.keys());
  }

  /**
   * Unregister a connector by destination key.
   * Returns true if a connector was removed, false otherwise.
   */
  public unregister(destinationKey: string): boolean {
    if (!destinationKey || typeof destinationKey !== 'string') {
      return false;
    }
    return this.connectors.delete(destinationKey.trim());
  }

  /**
   * Clear all registered connectors (useful for tests and resets).
   */
  public clear(): void {
    this.connectors.clear();
  }
}

/**
 * Default shared singleton connector registry.
 */
export const connectorRegistry = new ConnectorRegistry();
