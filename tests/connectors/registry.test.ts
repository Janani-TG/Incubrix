import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectorRegistry } from '../../src/connectors/ConnectorRegistry';
import { MockConnector } from '../../src/connectors/MockConnector';
import { ConnectorError } from '../../src/connectors/errors';

describe('ConnectorRegistry', () => {
  let registry: ConnectorRegistry;

  beforeEach(() => {
    registry = new ConnectorRegistry();
  });

  it('should register and retrieve a connector by unique destination key', () => {
    const mock = new MockConnector({ destinationKey: 'mock-1', name: 'Mock One' });

    registry.register(mock);

    expect(registry.has('mock-1')).toBe(true);
    const retrieved = registry.get('mock-1');
    expect(retrieved).toBe(mock);
    expect(retrieved.destinationKey).toBe('mock-1');
    expect(retrieved.name).toBe('Mock One');
  });

  it('should reject duplicate registrations for the same destination key', () => {
    const first = new MockConnector({ destinationKey: 'destination-dup' });
    const second = new MockConnector({ destinationKey: 'destination-dup' });

    registry.register(first);

    expect(() => registry.register(second)).toThrow(ConnectorError);
    try {
      registry.register(second);
    } catch (err) {
      const connErr = err as ConnectorError;
      expect(connErr.code).toBe('DUPLICATE_CONNECTOR');
      expect(connErr.statusCode).toBe(409);
      expect(connErr.message).toContain('destination-dup');
    }
  });

  it('should throw CONNECTOR_NOT_FOUND error for unknown destination keys', () => {
    expect(() => registry.get('non-existent')).toThrow(ConnectorError);

    try {
      registry.get('non-existent');
    } catch (err) {
      const connErr = err as ConnectorError;
      expect(connErr.code).toBe('CONNECTOR_NOT_FOUND');
      expect(connErr.statusCode).toBe(404);
      expect(connErr.destinationKey).toBe('non-existent');
    }
  });

  it('should reject invalid or blank destination keys during registration', () => {
    const invalidConnector = new MockConnector({ destinationKey: '   ' });

    expect(() => registry.register(invalidConnector)).toThrow(ConnectorError);
    try {
      registry.register(invalidConnector);
    } catch (err) {
      const connErr = err as ConnectorError;
      expect(connErr.code).toBe('INVALID_REQUEST');
      expect(connErr.statusCode).toBe(400);
    }
  });

  it('should reject empty lookup keys', () => {
    expect(() => registry.get('')).toThrow(ConnectorError);
  });

  it('should list all registered connectors and keys', () => {
    const conn1 = new MockConnector({ destinationKey: 'dest-a' });
    const conn2 = new MockConnector({ destinationKey: 'dest-b' });

    registry.register(conn1);
    registry.register(conn2);

    expect(registry.getKeys()).toEqual(['dest-a', 'dest-b']);
    expect(registry.getAll()).toHaveLength(2);
  });

  it('should unregister a connector by key', () => {
    const conn = new MockConnector({ destinationKey: 'removable' });
    registry.register(conn);

    expect(registry.has('removable')).toBe(true);
    const removed = registry.unregister('removable');
    expect(removed).toBe(true);
    expect(registry.has('removable')).toBe(false);

    // Unregistering a non-existent key returns false
    expect(registry.unregister('removable')).toBe(false);
  });

  it('should clear all registered connectors', () => {
    registry.register(new MockConnector({ destinationKey: 'd1' }));
    registry.register(new MockConnector({ destinationKey: 'd2' }));
    expect(registry.getAll()).toHaveLength(2);

    registry.clear();
    expect(registry.getAll()).toHaveLength(0);
    expect(registry.has('d1')).toBe(false);
  });
});
