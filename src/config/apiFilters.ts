import { FilterMetadata, FilterType } from '@/types/apiFilters';

/**
 * Environments are not a property of the API resource, so this filter can't be sent to the
 * data plane as OData. ApiList applies it client-side using each API's deployments.
 */
export const ENVIRONMENT_FILTER_TYPE = 'environment';

/** Upper bound on assets loaded to apply the environment filter client-side. */
export const ENVIRONMENT_FILTER_MAX_ASSETS = 500;

export const ApiFilterParameters: Record<FilterType, FilterMetadata> = {
  kind: {
    label: 'Asset type',
    options: [
      { value: 'api', label: 'APIs' },
      { value: 'rest', label: 'REST' },
      { value: 'mcp', label: 'MCP' },
      { value: 'agent', label: 'Agent' },
      { value: 'model', label: 'Model' },
      { value: 'skill', label: 'Skill' },
      { value: 'a2a', label: 'A2A' },
      { value: 'plugin', label: 'Plugin' },
      { value: 'graphql', label: 'GraphQL' },
      { value: 'grpc', label: 'gRPC' },
      { value: 'soap', label: 'SOAP' },
      { value: 'webhook', label: 'Webhook' },
      { value: 'websocket', label: 'WebSocket' },
      { value: 'odata', label: 'OData' },
    ],
  },
  lifecycleStage: {
    label: 'Lifecycle',
    options: [
      { value: 'design', label: 'Design' },
      { value: 'development', label: 'Development' },
      { value: 'testing', label: 'Testing' },
      { value: 'preview', label: 'Preview' },
      { value: 'production', label: 'Production' },
      { value: 'deprecated', label: 'Deprecated' },
      { value: 'retired', label: 'Retired' },
    ],
  },
};
