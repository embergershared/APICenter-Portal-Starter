import { useQueries, useQuery } from '@tanstack/react-query';
import { useRecoilValue } from 'recoil';
import { isAuthenticatedAtom } from '@/atoms/isAuthenticatedAtom';
import { useApiService } from '@/hooks/useApiService';
import { QueryKeys } from '@/constants/QueryKeys';
import { ApiEnvironment } from '@/types/apiEnvironment';

/** Deployments may reference an environment by bare name or by full resource path. */
function getEnvironmentName(environmentId: string): string {
  return environmentId.split('/').filter(Boolean).pop() ?? environmentId;
}

/** All environments of the API Center, shared by the Environment column and filter. */
export function useEnvironments(enabled = true) {
  const ApiService = useApiService();
  const isAuthenticated = useRecoilValue(isAuthenticatedAtom);

  return useQuery({
    queryKey: [QueryKeys.ApiEnvironments],
    queryFn: () => ApiService.getEnvironments(),
    staleTime: Infinity,
    enabled: Boolean(isAuthenticated && enabled),
  });
}

/**
 * For a list of API names, fetches each API's deployments in parallel and resolves
 * them against the environment list. Returns a map of name → environments
 * (recommended deployment first); a missing entry means the data is still loading.
 */
export function useApiEnvironments(apiNames: string[], enabled = true): Record<string, ApiEnvironment[] | undefined> {
  const ApiService = useApiService();
  const isAuthenticated = useRecoilValue(isAuthenticatedAtom);
  const isEnabled = Boolean(isAuthenticated && enabled);

  const environmentsQuery = useEnvironments(enabled);

  // Same key and data shape as useMcpTransportTags so the cache is shared.
  const deploymentQueries = useQueries({
    queries: apiNames.map((name) => ({
      queryKey: [QueryKeys.ApiDeployments, name],
      queryFn: async () => {
        const deployments = await ApiService.getDeployments(name);
        return { name, deployments };
      },
      staleTime: Infinity,
      enabled: isEnabled,
    })),
  });

  const result: Record<string, ApiEnvironment[] | undefined> = {};
  if (environmentsQuery.isError) {
    return Object.fromEntries(apiNames.map((name) => [name, []]));
  }
  if (!environmentsQuery.data) {
    return result;
  }

  const environmentsByName = new Map(environmentsQuery.data.map((env) => [env.name, env]));

  for (let i = 0; i < apiNames.length; i++) {
    const query = deploymentQueries[i];
    if (query?.isError) {
      result[apiNames[i]] = [];
      continue;
    }
    const deployments = query?.data?.deployments;
    if (!deployments) {
      continue;
    }

    const sorted = [...deployments].sort((a, b) => Number(!!b.recommended) - Number(!!a.recommended));
    const environments: ApiEnvironment[] = [];
    for (const deployment of sorted) {
      if (!deployment.environmentId) continue;
      const environment = environmentsByName.get(getEnvironmentName(deployment.environmentId));
      if (environment && !environments.includes(environment)) {
        environments.push(environment);
      }
    }
    result[apiNames[i]] = environments;
  }

  return result;
}
