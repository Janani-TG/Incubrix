import { DestinationRulesConfig } from './types';
import { validateDestinationRulesConfig } from './validation';

/**
 * Registry holding explicit destination posting rules configurations.
 */
export class DestinationRulesRegistry {
  private configs = new Map<string, DestinationRulesConfig>();

  /**
   * Register or update posting rules for a specific destination.
   * Validates the configuration before storing.
   */
  public register(config: DestinationRulesConfig): void {
    validateDestinationRulesConfig(config);
    this.configs.set(config.destinationKey.trim(), { ...config });
  }

  /**
   * Retrieve posting rules for a destination.
   * Returns undefined if no rules are explicitly configured.
   */
  public get(destinationKey: string): DestinationRulesConfig | undefined {
    if (!destinationKey || typeof destinationKey !== 'string') {
      return undefined;
    }
    return this.configs.get(destinationKey.trim());
  }

  /**
   * Check if rules exist for a destination.
   */
  public has(destinationKey: string): boolean {
    if (!destinationKey || typeof destinationKey !== 'string') {
      return false;
    }
    return this.configs.has(destinationKey.trim());
  }

  /**
   * Remove rules for a destination.
   */
  public unregister(destinationKey: string): boolean {
    if (!destinationKey || typeof destinationKey !== 'string') {
      return false;
    }
    return this.configs.delete(destinationKey.trim());
  }

  /**
   * Clear all registered rule configurations.
   */
  public clear(): void {
    this.configs.clear();
  }

  /**
   * Get all registered configurations.
   */
  public getAll(): DestinationRulesConfig[] {
    return Array.from(this.configs.values());
  }
}

export const destinationRulesRegistry = new DestinationRulesRegistry();
