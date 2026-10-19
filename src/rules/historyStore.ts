/**
 * Recorded publication metadata for frequency limit auditing and enforcement.
 */
export interface PublicationRecord {
  destinationKey: string;
  publishedAt: Date;
  externalId?: string;
  isSimulated?: boolean;
}

/**
 * Abstraction for recording and querying past successful publications.
 */
export interface PublicationHistoryStore {
  recordPublication(record: PublicationRecord): Promise<void> | void;
  getPublicationsSince(
    destinationKey: string,
    since: Date
  ): Promise<PublicationRecord[]> | PublicationRecord[];
  getLastPublication(
    destinationKey: string
  ): Promise<PublicationRecord | null> | PublicationRecord | null;
  clear(destinationKey?: string): Promise<void> | void;
}

/**
 * In-memory publication history store suitable for testing and local operation.
 */
export class InMemoryPublicationHistoryStore implements PublicationHistoryStore {
  private records: PublicationRecord[] = [];

  public recordPublication(record: PublicationRecord): void {
    this.records.push({
      ...record,
      publishedAt: new Date(record.publishedAt),
    });
  }

  public getPublicationsSince(
    destinationKey: string,
    since: Date
  ): PublicationRecord[] {
    const sinceMs = since.getTime();
    return this.records.filter(
      (r) => r.destinationKey === destinationKey && r.publishedAt.getTime() >= sinceMs
    );
  }

  public getLastPublication(destinationKey: string): PublicationRecord | null {
    const matching = this.records
      .filter((r) => r.destinationKey === destinationKey)
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

    return matching[0] ?? null;
  }

  public clear(destinationKey?: string): void {
    if (destinationKey) {
      this.records = this.records.filter((r) => r.destinationKey !== destinationKey);
    } else {
      this.records = [];
    }
  }
}
