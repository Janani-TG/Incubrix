import fs from 'fs';
import path from 'path';
import { BaseConnector } from '../BaseConnector';
import {
  ConnectorCapabilities,
  DeleteRequest,
  DeleteResult,
  GetStatusRequest,
  GetStatusResult,
  PublishRequest,
  PublishResult,
  VerifyRequest,
  VerifyResult,
} from '../types';

export interface AssistedConnectorConfig {
  destinationKey?: string;
  name?: string;
  outputDirectory?: string;
}

/**
 * Assisted connector that prepares a "ready-to-post pack" for destinations where automated
 * publishing is restricted, disallowed by policy, or requires manual human review.
 */
export class AssistedConnector extends BaseConnector {
  public readonly destinationKey: string;
  public readonly name: string;
  public readonly capabilities: ConnectorCapabilities = {
    canPublish: true,
    canVerify: true,
    canGetStatus: true,
    canDelete: true,
    supportsSimulation: true,
  };

  private outputDirectory: string;

  constructor(config: AssistedConnectorConfig = {}) {
    super();
    this.destinationKey = config.destinationKey || 'assisted';
    this.name = config.name || 'Assisted Manual Publishing Packager';
    const baseDir = config.outputDirectory || process.env.ASSISTED_OUTPUT_DIR || path.join(process.cwd(), 'artifacts', 'assisted_packs');
    this.outputDirectory = path.resolve(baseDir);
  }

  /**
   * Sanitizes a pack identifier and resolves the directory, strictly preventing path traversal.
   */
  private resolvePackPath(packId: string): string {
    const cleanId = packId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const resolvedPath = path.resolve(this.outputDirectory, cleanId);

    // Guard against path traversal
    if (!resolvedPath.startsWith(this.outputDirectory)) {
      throw new Error(`Invalid pack ID '${packId}': path traversal outside output directory is prohibited.`);
    }

    return resolvedPath;
  }

  public getOutputDirectory(): string {
    return this.outputDirectory;
  }

  public async publish(request: PublishRequest): Promise<PublishResult> {
    const isSimulated = request.simulate === true;
    const prefix = isSimulated ? 'sim' : 'pack';
    const packId = `${prefix}-${this.destinationKey}-${Date.now()}`;

    if (isSimulated) {
      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: packId,
        status: 'simulated',
        isSimulated: true,
        timestamp: this.createTimestamp(),
        metadata: {
          packId,
          dryRun: true,
          mode: 'assisted_manual',
          status: 'simulated',
        },
      };
    }

    try {
      const packDir = this.resolvePackPath(packId);
      fs.mkdirSync(packDir, { recursive: true });

      const manifest = {
        packId,
        destinationKey: this.destinationKey,
        preparedAt: this.createTimestamp(),
        status: 'draft', // Clearly marked draft, never claiming completed publishing
        content: {
          title: request.content.title,
          summary: request.content.summary,
          canonicalUrl: request.content.canonicalUrl,
          tags: request.content.tags,
        },
        metadata: request.metadata,
        checklist: [
          'Review content formatting and tags.',
          'Open target destination web interface.',
          'Copy-paste title, body, and summary from content.md.',
          'Verify author attribution and canonical URL.',
          'Submit publication manually.',
        ],
      };

      const instructions = [
        `======================================================`,
        `READY-TO-POST PACK: ${request.content.title}`,
        `Destination: ${this.destinationKey}`,
        `Prepared: ${manifest.preparedAt}`,
        `Status: DRAFT (Pending Manual Submission)`,
        `======================================================`,
        ``,
        `INSTRUCTIONS:`,
        `1. Review content in 'content.md'.`,
        `2. Log into the destination platform manually.`,
        `3. Paste content and apply requested tags: ${(request.content.tags || []).join(', ') || 'none'}.`,
        `4. Set canonical URL: ${request.content.canonicalUrl || 'none'}.`,
        `5. Confirm publication and record published link.`,
      ].join('\n');

      const manifestPath = path.join(packDir, 'manifest.json');
      const contentPath = path.join(packDir, 'content.md');
      const instructionsPath = path.join(packDir, 'instructions.txt');

      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
      fs.writeFileSync(contentPath, request.content.body, 'utf-8');
      fs.writeFileSync(instructionsPath, instructions, 'utf-8');

      // Verify pack files are written successfully before reporting success
      if (
        !fs.existsSync(manifestPath) ||
        !fs.existsSync(contentPath) ||
        !fs.existsSync(instructionsPath)
      ) {
        throw new Error('Pack files were not successfully written to disk.');
      }

      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: packId,
        externalUrl: `file://${packDir.replace(/\\/g, '/')}/manifest.json`,
        status: 'draft', // Explicitly status 'draft', not 'published'
        isSimulated: false,
        timestamp: this.createTimestamp(),
        metadata: {
          packId,
          packDirectory: packDir,
          isAssistedPack: true,
          status: 'draft',
        },
      };
    } catch (err: unknown) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        status: 'failed',
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: {
          code: 'PACK_GENERATION_FAILED',
          message: (err as Error).message,
        },
      };
    }
  }

  public async verify(request: VerifyRequest): Promise<VerifyResult> {
    if (request.simulate === true) {
      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        verified: true,
        status: 'simulated',
        externalUrl: `file://${this.outputDirectory.replace(/\\/g, '/')}/simulated/${request.externalId}/manifest.json`,
        timestamp: this.createTimestamp(),
        details: { isSimulated: true },
      };
    }

    try {
      const packDir = this.resolvePackPath(request.externalId);
      const manifestPath = path.join(packDir, 'manifest.json');

      if (!fs.existsSync(manifestPath)) {
        return {
          success: false,
          destinationKey: this.destinationKey,
          externalId: request.externalId,
          verified: false,
          status: 'unknown',
          timestamp: this.createTimestamp(),
          error: {
            code: 'NOT_FOUND',
            message: `Assisted pack '${request.externalId}' does not exist on disk.`,
          },
        };
      }

      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        verified: true,
        status: 'draft',
        externalUrl: `file://${packDir.replace(/\\/g, '/')}/manifest.json`,
        timestamp: this.createTimestamp(),
        details: { packDirectory: packDir },
      };
    } catch (err: unknown) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        verified: false,
        status: 'unknown',
        timestamp: this.createTimestamp(),
        error: {
          code: 'VERIFY_FAILED',
          message: (err as Error).message,
        },
      };
    }
  }

  public async getStatus(request: GetStatusRequest): Promise<GetStatusResult> {
    if (request.simulate === true) {
      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        status: 'simulated',
        timestamp: this.createTimestamp(),
        details: { isSimulated: true },
      };
    }

    const verified = await this.verify({
      destinationKey: this.destinationKey,
      externalId: request.externalId,
      simulate: request.simulate,
    });

    return {
      success: verified.success,
      destinationKey: this.destinationKey,
      externalId: request.externalId,
      status: verified.status,
      timestamp: this.createTimestamp(),
      error: verified.error,
      details: verified.details,
    };
  }

  public async delete(request: DeleteRequest): Promise<DeleteResult> {
    if (request.simulate === true) {
      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        deleted: true,
        isSimulated: true,
        timestamp: this.createTimestamp(),
      };
    }

    try {
      const packDir = this.resolvePackPath(request.externalId);
      if (!fs.existsSync(packDir)) {
        return {
          success: false,
          destinationKey: this.destinationKey,
          externalId: request.externalId,
          deleted: false,
          isSimulated: false,
          timestamp: this.createTimestamp(),
          error: {
            code: 'NOT_FOUND',
            message: `Pack '${request.externalId}' not found.`,
          },
        };
      }

      fs.rmSync(packDir, { recursive: true, force: true });

      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        deleted: true,
        isSimulated: false,
        timestamp: this.createTimestamp(),
      };
    } catch (err: unknown) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        deleted: false,
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: {
          code: 'DELETE_FAILED',
          message: (err as Error).message,
        },
      };
    }
  }
}
