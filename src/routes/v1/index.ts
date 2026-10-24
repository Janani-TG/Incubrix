import { Router } from 'express';
import { connectorRegistry, registerStandardConnectors } from '../../connectors';
import { destinationRulesRegistry, PostingRulesEngine, InMemoryPublicationHistoryStore, GuardedPublishService } from '../../rules';
import { InMemoryIdempotencyStore, IdempotencyManager, RetryPolicy, ReliablePublishService } from '../../reliability';
import { InMemoryJobStore, JobService, JobWorker } from '../../jobs';
import { ConnectorCertificationHarness, certificationStore, CertificationStore } from '../../certification';
import { ConnectorRegistry } from '../../connectors/ConnectorRegistry';
import { DestinationRulesRegistry } from '../../rules/DestinationRulesRegistry';

import { createDestinationsRouter } from './destinations';
import { createPublishRouter } from './publish';
import { createOperationsRouter } from './operations';
import { createJobsRouter } from './jobs';
import { createCertificationRouter } from './certification';
import { createTrackingRouter } from './tracking';
import { PublishRequest } from '../../connectors/types';

export interface ServiceContainer {
  connectorRegistry: ConnectorRegistry;
  rulesRegistry: DestinationRulesRegistry;
  historyStore: InMemoryPublicationHistoryStore;
  postingRulesEngine: PostingRulesEngine;
  guardedPublishService: GuardedPublishService;
  idempotencyStore: InMemoryIdempotencyStore;
  idempotencyManager: IdempotencyManager;
  retryPolicy: RetryPolicy;
  reliablePublishService: ReliablePublishService;
  jobStore: InMemoryJobStore;
  jobService: JobService;
  jobWorker: JobWorker;
  certificationHarness: ConnectorCertificationHarness;
  certificationStore: CertificationStore;
}

/**
 * Creates and initializes default service dependencies with standard connectors registered.
 */
export function createDefaultServiceContainer(): ServiceContainer {
  const connRegistry = connectorRegistry;
  registerStandardConnectors(connRegistry);

  const rulesReg = destinationRulesRegistry;
  const histStore = new InMemoryPublicationHistoryStore();
  const rulesEngine = new PostingRulesEngine(rulesReg, histStore);
  const guardedService = new GuardedPublishService(connRegistry, rulesEngine, histStore);

  const idempStore = new InMemoryIdempotencyStore();
  const idempManager = new IdempotencyManager(idempStore);
  const retPolicy = new RetryPolicy();
  const relService = new ReliablePublishService(guardedService, idempManager, retPolicy);

  const jStore = new InMemoryJobStore();
  const jService = new JobService(jStore);
  const jWorker = new JobWorker(jStore);

  // Register background job executor handler
  jWorker.registerHandler('publish', async (job) => {
    return relService.publish(job.data as PublishRequest, {
      idempotencyKey: job.idempotencyKey,
    });
  });

  const certHarness = new ConnectorCertificationHarness();
  const certStore = certificationStore;

  return {
    connectorRegistry: connRegistry,
    rulesRegistry: rulesReg,
    historyStore: histStore,
    postingRulesEngine: rulesEngine,
    guardedPublishService: guardedService,
    idempotencyStore: idempStore,
    idempotencyManager: idempManager,
    retryPolicy: retPolicy,
    reliablePublishService: relService,
    jobStore: jStore,
    jobService: jService,
    jobWorker: jWorker,
    certificationHarness: certHarness,
    certificationStore: certStore,
  };
}

export const defaultContainer = createDefaultServiceContainer();

/**
 * Factory for creating versioned /api/v1 router with injected or default services.
 */
export function createV1Router(container: ServiceContainer = defaultContainer): Router {
  const router = Router();

  // /api/v1/destinations
  router.use('/destinations', createDestinationsRouter(container.connectorRegistry, container.rulesRegistry, container.historyStore));

  // /api/v1/destinations/:destinationKey/publish
  router.use('/destinations', createPublishRouter(container.reliablePublishService, container.jobService, container.connectorRegistry));

  // /api/v1/destinations/:destinationKey/(verify|status|delete)
  router.use('/destinations', createOperationsRouter(container.connectorRegistry));

  // /api/v1/jobs
  router.use('/jobs', createJobsRouter(container.jobService));

  // /api/v1/certification
  router.use('/certification', createCertificationRouter(container.connectorRegistry, container.certificationHarness, container.certificationStore));

  // /api/v1/tracking
  router.use('/tracking', createTrackingRouter(container.rulesRegistry));

  return router;
}

export const v1Router = createV1Router(defaultContainer);
