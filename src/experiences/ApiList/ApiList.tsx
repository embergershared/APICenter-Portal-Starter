import React, { useCallback, useEffect, useMemo } from 'react';
import { Badge, Link, Spinner } from '@fluentui/react-components';
import { useRecoilValue } from 'recoil';
import { useNavigate } from 'react-router-dom';
import { useSearchFilters } from '@/hooks/useSearchFilters';
import { useApis } from '@/hooks/useApis';
import { useSearchQuery } from '@/hooks/useSearchQuery';
import { ApiCard, type ApiCardApi } from '@/components/ApiCard';
import { InfoTable } from '@/components/InfoTable';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { formatKindDisplay } from '@/utils/formatKind';
import { getLifecycleBadgeColor, formatLifecycleStage, getEnvironmentBadgeColor } from '@/utils/badgeSystem';
import { apiAdapter } from '@/experiences/ApiList/apiAdapter';
import { useMcpTransportTags } from '@/hooks/useMcpTransportTags';
import { useApiEnvironments } from '@/hooks/useApiEnvironments';
import { ENABLE_LIST_EVAL_BADGES } from '@/constants/featureFlags';
import { ContributeCard } from '@/experiences/ContributeCard';
import { ApiMetadata } from '@/types/api';
import { ActiveFilterData } from '@/types/apiFilters';
import { ApiEnvironment } from '@/types/apiEnvironment';
import { ENVIRONMENT_FILTER_MAX_ASSETS, ENVIRONMENT_FILTER_TYPE } from '@/config/apiFilters';
import { AppCapabilities } from '@/types/config';
import { Layouts } from '@/types/layouts';
import { apiListLayoutAtom } from '@/atoms/apiListLayoutAtom';
import { configAtom } from '@/atoms/configAtom';
import { LocationsService } from '@/services/LocationsService';
import EmptyStateMessage from '@/components/EmptyStateMessage';
import styles from './ApiList.module.scss';

function matchesEnvironmentFilter(environment: ApiEnvironment, filter: ActiveFilterData): boolean {
  if (filter.operator === 'contains') {
    const value = filter.value.toLowerCase();
    return [environment.name, environment.title].some((text) => text?.toLowerCase().includes(value));
  }
  return environment.name === filter.value;
}

export const ApiList: React.FC = () => {
  const layout = useRecoilValue(apiListLayoutAtom);
  const config = useRecoilValue(configAtom);
  const searchFilters = useSearchFilters();
  const searchQuery = useSearchQuery();
  const navigate = useNavigate();
  // Enrich active filters with schema info (e.g. multi-value/array properties) so the
  // service can build the correct OData query. This is derived per-render and kept out
  // of the atom to avoid interfering with filter equality checks (isActive/remove).
  // Environment filters are applied client-side below, so they're excluded from the OData query.
  const enrichedFilters = useMemo(
    () =>
      searchFilters.activeFilters
        .filter((filter) => filter.type !== ENVIRONMENT_FILTER_TYPE)
        .map((filter) => ({
          ...filter,
          isMultiValue: searchFilters.metadata[filter.type]?.isMultiValue,
        })),
    [searchFilters.activeFilters, searchFilters.metadata]
  );
  const environmentFilters = useMemo(
    () => searchFilters.activeFilters.filter((filter) => filter.type === ENVIRONMENT_FILTER_TYPE),
    [searchFilters.activeFilters]
  );
  const isEnvironmentFiltering = environmentFilters.length > 0;
  const apis = useApis({
    search: searchQuery.search,
    filters: enrichedFilters,
    isSemanticSearch: searchQuery.isSemanticSearch,
  });

  // const mockAgent: ApiMetadata = useMemo(() => ({
  //   name: 'apim-sre-agent',
  //   title: 'APIM SRE Agent',
  //   kind: 'agent',
  //   summary: 'An SRE agent to assist Azure API Management engineering team with service live site.',
  //   lifecycleStage: 'production',
  // }), []);

  const adaptedApiList = useMemo(() => {
    const adapted = apis.data?.map(apiAdapter) ?? [];
    return adapted;
  }, [apis.data]);

  const apiNames = useMemo(() => adaptedApiList.map((a) => a.name), [adaptedApiList]);
  // Environments are only shown in the table layout, so skip the per-API deployment calls
  // for cards unless the environment filter needs them.
  const apiEnvironments = useApiEnvironments(apiNames, layout !== Layouts.CARDS || isEnvironmentFiltering);

  const loadedCount = apis.data?.length ?? 0;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = apis;

  // The environment filter can only be applied to loaded assets, so load every page (up to a cap).
  useEffect(() => {
    if (isEnvironmentFiltering && hasNextPage && !isFetchingNextPage && loadedCount < ENVIRONMENT_FILTER_MAX_ASSETS) {
      void fetchNextPage();
    }
  }, [isEnvironmentFiltering, hasNextPage, isFetchingNextPage, loadedCount, fetchNextPage]);

  const isCollectingEnvironments =
    isEnvironmentFiltering &&
    ((hasNextPage && loadedCount < ENVIRONMENT_FILTER_MAX_ASSETS) ||
      isFetchingNextPage ||
      apiNames.some((name) => !apiEnvironments[name]));

  const visibleApiList = useMemo(() => {
    if (!isEnvironmentFiltering) {
      return adaptedApiList;
    }
    return adaptedApiList.filter((api) =>
      apiEnvironments[api.name]?.some((env) =>
        environmentFilters.some((filter) => matchesEnvironmentFilter(env, filter))
      )
    );
  }, [adaptedApiList, apiEnvironments, environmentFilters, isEnvironmentFiltering]);

  const mcpNames = useMemo(
    () => visibleApiList.filter((a) => a.type?.toLowerCase() === 'mcp').map((a) => a.name),
    [visibleApiList]
  );
  const mcpTransportTags = useMcpTransportTags(mcpNames);

  const getApiUrl = useCallback(
    (api: ApiCardApi) => {
      const kind = (api as ApiCardApi & { type?: string }).type?.toLowerCase();
      if (kind === 'agent') return LocationsService.getAgentInfoUrl(api.name);
      if (kind === 'skill') return LocationsService.getSkillInfoUrl(api.name);
      if (kind === 'plugin') return LocationsService.getPluginInfoUrl(api.name);
      if (kind === 'mcp') return LocationsService.getMcpServerUrl(api.name);
      if (kind === 'model' || kind === 'languagemodel') return LocationsService.getModelDetailUrl(api.name);
      return LocationsService.getApiDetailUrl(api.name);
    },
    []
  );

  const apiClickHandler = useCallback(
    (api: ApiCardApi) => {
      return (e: React.MouseEvent) => {
        const url = getApiUrl(api);
        if (e.ctrlKey || e.metaKey || e.button !== 0) {
          window.open(url, '_blank');
          return;
        }
        navigate(url);
      };
    },
    [navigate, getApiUrl]
  );

  const handleLoadMore = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      apis.fetchNextPage();
    },
    [apis]
  );

  function renderLoadMore() {
    if (!apis.hasNextPage) {
      return null;
    }

    if (isEnvironmentFiltering && !apis.isFetchingNextPage) {
      return (
        <div className={styles.loadMore}>
          The environment filter was applied to the first {loadedCount} assets only.&nbsp;
          <Link onClick={handleLoadMore}>Load more</Link>
        </div>
      );
    }

    if (apis.isFetchingNextPage) {
      return (
        <div className={styles.loadMore}>
          <Spinner size="tiny" />
        </div>
      );
    }

    return (
      <div className={styles.loadMore}>
        <Link onClick={handleLoadMore}>Load more</Link>
      </div>
    );
  }

  if (apis.isLoading || isCollectingEnvironments) {
    return <Spinner size="small" />;
  }

  const showContributeCard = config.capabilities?.includes(AppCapabilities.CONTRIBUTIONS)
    && !!config.contributions?.gitRepositoryUrl;

  if (!visibleApiList.length) {
    return (
      <>
        <EmptyStateMessage>Can't find any search results. Try a different search term.</EmptyStateMessage>
        {renderLoadMore()}
      </>
    );
  }

  if (layout === Layouts.CARDS) {
    return (
      <>
        <div className={styles.cards}>
          {showContributeCard && (
            <ContributeCard url={config.contributions!.gitRepositoryUrl} />
          )}
          {visibleApiList.map((api) => (
            <ApiCard
              key={api.name}
              api={api}
              onClick={apiClickHandler(api)}
              showType
              transportTags={mcpTransportTags[api.name]}
            />
          ))}
        </div>
        {renderLoadMore()}
      </>
    );
  }

  return (
    <>
      <InfoTable
        columnLabels={[
          'Name',
          'Summary',
          ...(ENABLE_LIST_EVAL_BADGES ? ['Score'] : []),
          'Lifecycle stage',
          'Environment',
          'Type',
        ]}
      >
        {visibleApiList.map((api) => (
          <InfoTable.Row key={api.name}>
            <InfoTable.Cell>
              <Link href={getApiUrl(api)} onClick={(e) => { e.preventDefault(); navigate(getApiUrl(api)); }}>{api.title}</Link>
            </InfoTable.Cell>
            <InfoTable.Cell>
              <MarkdownRenderer markdown={api.description} maxLength={120} />
            </InfoTable.Cell>
            {ENABLE_LIST_EVAL_BADGES && (
              <InfoTable.Cell>
                {api.evalScore != null && api.evalMaxScore != null && api.evalMaxScore > 0 && (
                  <Badge
                    appearance="filled"
                    color={api.evalScore / api.evalMaxScore >= 0.8 ? 'success' : api.evalScore / api.evalMaxScore >= 0.6 ? 'warning' : 'danger'}
                    shape="circular"
                  >
                    {(api.evalScore / api.evalMaxScore * 5).toFixed(1)}/5
                  </Badge>
                )}
              </InfoTable.Cell>
            )}
            <InfoTable.Cell>
              {!!api.lifecycleStage && (
                <Badge appearance="tint" color={getLifecycleBadgeColor(api.lifecycleStage)} shape="circular">
                  {formatLifecycleStage(api.lifecycleStage)}
                </Badge>
              )}
            </InfoTable.Cell>
            <InfoTable.Cell>
              {apiEnvironments[api.name] ? (
                <div className={styles.environments}>
                  {apiEnvironments[api.name]!.map((env) => (
                    <Badge
                      key={env.name}
                      appearance="tint"
                      color={getEnvironmentBadgeColor(env.kind)}
                      shape="circular"
                      title={env.description || env.kind}
                    >
                      {env.title || env.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <Spinner size="extra-tiny" />
              )}
            </InfoTable.Cell>
            <InfoTable.Cell>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Badge appearance="filled" color="brand" shape="circular">
                  {['skill', 'a2a', 'mcp', 'plugin', 'agent', 'model', 'languagemodel'].includes(api.type?.toLowerCase() ?? '') ? formatKindDisplay(api.type!) : 'API'}
                </Badge>
                {!!api.type && !['skill', 'a2a', 'mcp', 'plugin', 'agent', 'model', 'languagemodel'].includes(api.type.toLowerCase()) && (
                  <Badge appearance="tint" color="brand" shape="circular">
                    {formatKindDisplay(api.type)}
                  </Badge>
                )}
                {mcpTransportTags[api.name]?.map((tag) => (
                  <Badge key={tag} appearance="tint" color="brand" shape="circular">{tag}</Badge>
                ))}
              </div>
            </InfoTable.Cell>
          </InfoTable.Row>
        ))}
      </InfoTable>
      {renderLoadMore()}
    </>
  );
};

export default React.memo(ApiList);
