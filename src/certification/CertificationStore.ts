import { CertificationReport } from './types';

/**
 * In-memory repository for certification run reports.
 */
export class CertificationStore {
  private reports = new Map<string, CertificationReport>();

  public save(report: CertificationReport): void {
    this.reports.set(report.runId, { ...report });
  }

  public get(runId: string): CertificationReport | null {
    const report = this.reports.get(runId);
    return report ? { ...report } : null;
  }

  public getAll(): CertificationReport[] {
    return Array.from(this.reports.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  public getLatestForDestination(destinationKey: string): CertificationReport | null {
    const matches = this.getAll().filter((r) => r.destinationKey === destinationKey);
    return matches[0] || null;
  }

  public clear(): void {
    this.reports.clear();
  }
}

export const certificationStore = new CertificationStore();
