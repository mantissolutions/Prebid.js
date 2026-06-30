/**
 * This module adds the Mantis provider to the real time data module.
 * The {@link module:modules/realTimeData} module is required.
 * The module will fetch contextual data from the Mantis API
 * and populate ortb2 site and user data before the auction.
 * @module modules/mantisRtdProvider
 * @requires module:modules/realTimeData
 */

import { submodule } from '../src/hook.js';
import { ajax } from '../src/ajax.js';
import { mergeDeep, logMessage, logError, logWarn, logInfo } from '../src/utils.js';
import type { RTDProviderConfig, RtdProviderSpec } from './rtdModule/spec.ts';
import type {
  MantisApiResponse,
  MantisCategory,
  MantisModuleConfig,
  MantisModuleParams,
  MantisOrtb2StructuredData,
  MantisSegmentGroup,
  ProcessedMantisData,
} from './mantisRtdProvider.types.ts';

// Re-export types so consumers can import from a single entry point if needed.
export type {
  MantisApiResponse,
  MantisCategory,
  MantisModuleConfig,
  MantisModuleParams,
  MantisOrtb2StructuredData,
  MantisSegmentGroup,
  ProcessedMantisData,
} from './mantisRtdProvider.types.ts';

const SUBMODULE_NAME = 'mantis' as const;
const LOG_PREFIX = 'mantisRtdProvider:';
const BASIC_MANTIS_KEYS: ReadonlyArray<keyof ProcessedMantisData['standard']> = [
  'mantis',
  'mantis_context',
  'iab_context',
];

/**
 * Build an array of oRTB2 segment objects from processed Mantis targeting data.
 * One segment group is returned for each key in {@link BASIC_MANTIS_KEYS}.
 * @param targetingData - Output of {@link processMantisData}.
 */
export const getMantisKeysSegmentData = (
  targetingData: ProcessedMantisData | null | undefined
): MantisSegmentGroup[] => {
  if (!targetingData || !targetingData.standard) {
    logWarn(`${LOG_PREFIX} Empty mantis data received for standard targeting`);
    return [];
  }
  const segments: MantisSegmentGroup[] = [];
  for (const mantisKey of BASIC_MANTIS_KEYS) {
    const keySegments = (targetingData.standard[mantisKey] || '')
      .split(',')
      .map((val: string) => val?.trim())
      .filter(Boolean)
      .map((id: string) => ({ id }));
    segments.push({
      name: mantisKey,
      segment: [...new Map(keySegments.map((s: { id: string }) => [s.id, s])).values()],
    });
  }
  return segments;
};

/**
 * Strip query string and fragment from a URL, returning host + pathname only.
 * Returns an empty string and logs a warning if the URL is invalid.
 */
export const cleanUrl = (url: string): string => {
  try {
    const parsedUrl = new URL(url);
    // parsedUrl.host gives hostname:port (if port is specified)
    return parsedUrl.host + parsedUrl.pathname;
  } catch (error: unknown) {
    logWarn(`${LOG_PREFIX} Invalid url: ${(error as Error)?.message}`);
    return '';
  }
};

/**
 * Build the Mantis RTD API request URL.
 * @param endpoint - Base URL of the Mantis RTD API.
 * @note The page URL is cleaned by {@link cleanUrl} before being appended as a query
 * parameter. cleanUrl strips the query string, fragment, and credentials, leaving only
 * host + pathname. The remaining characters (letters, digits, hyphens, dots, and forward
 * slashes) do not require percent-encoding because they cannot be mistaken for query string
 * delimiters (&, =) and are handled correctly by the Mantis API. encodeURIComponent is
 * therefore intentionally omitted.
 */
export function buildApiUrl(endpoint: string): string {
  const url = cleanUrl(window.location.href);
  if (!url) {
    return '';
  }
  const params = [
    'cacheType=public',
    'filter=fullRatings,input,findings,sentiment,emotion,categories',
    `url=${url}`,
  ];
  return `${endpoint}?${params.join('&')}`;
}

/**
 * Process a raw Mantis API response into a structured targeting object.
 */
export const processMantisData = (mantisData: MantisApiResponse = {}): ProcessedMantisData => {
  const { categories, emotion = {}, ratings = [], sentiment = '' } = mantisData;

  // Process emotions
  const mantisEmotions = Object.entries(emotion)
    .map(([k, { level }]) => (k === 'unknown' ? 'emotions-unknown' : `${k}-${level}`))
    .join(',');
  // Ensure mantisEmotions includes "emotions-unknown" if there are no emotions
  const finalMantisEmotions = mantisEmotions || 'emotions-unknown';

  // Process the sentiment into the format "sentiment-sentimentValue"
  const mantisSentiment = sentiment ? `sentiment-${sentiment}` : 'sentiment-unknown';

  // Process the ratings into a comma-separated string, skipping invalid ratings
  const mantisRatings = ratings
    .filter(({ rating }) => rating !== 'N/A')
    .map(({ customer, rating }) => `${customer}-${rating}`)
    .join(',');
  // Ensure mantisRatings is "unknown" if there are no valid ratings
  const finalMantisRatings = mantisRatings || 'unknown';

  // Define the mantis_source value
  const mantisSource = 'prebid-rtdmodule';

  // Combine finalMantisRatings, mantisSentiment, and finalMantisEmotions into a single string
  const mantis = [finalMantisRatings, mantisSentiment, finalMantisEmotions, mantisSource]
    .filter(Boolean)
    .join(',');

  type SubsetDef = {
    subset: 'mantis_context' | 'iab_context';
    source: MantisCategory[];
    key: keyof MantisCategory;
    filter: number;
    mapTo: keyof MantisCategory;
  };

  type SubsetAcc = Record<'mantis_context' | 'iab_context', string>;

  // Define the subsets for granular targeting
  const subsets: SubsetAcc = (
    [
      {
        subset: 'mantis_context',
        source: (categories?.mantis) || [],
        key: 'score',
        filter: 0.6,
        mapTo: 'label',
      },
      {
        subset: 'iab_context',
        source: (categories?.iab) || [],
        key: 'score',
        filter: 0.6,
        mapTo: 'id',
      },
    ] as SubsetDef[]
  ).reduce<SubsetAcc>(
    (acc, { subset, source, key, filter, mapTo }) => {
      const filtered = source.filter((entry) => (entry[key] as number) > filter);
      acc[subset] =
        filtered.length > 0
          ? filtered.map((entry) => entry[mapTo] as string).join(',')
          : 'unknown';
      return acc;
    },
    { mantis_context: '', iab_context: '' }
  );

  const standardData = {
    mantis,
    mantis_context: subsets.mantis_context,
    iab_context: subsets.iab_context,
  };

  return { standard: standardData };
};

/**
 * Merge ortb2StructuredData into the global ortb2 fragments.
 * Returns `true` when data was successfully merged, `false` otherwise.
 */
export function setOrtb2FromResponse(
  reqBidsConfigObj: { ortb2Fragments: { global: object } },
  ortb2StructuredData: MantisOrtb2StructuredData | null | undefined
): boolean {
  const ortb2 = reqBidsConfigObj.ortb2Fragments.global;

  if (!ortb2StructuredData || typeof ortb2StructuredData !== 'object') {
    return false;
  }

  if (ortb2StructuredData.site) {
    mergeDeep(ortb2, { site: ortb2StructuredData.site });
    logMessage(`${LOG_PREFIX} merged site data`, ortb2StructuredData.site);
  }

  if (ortb2StructuredData.user) {
    mergeDeep(ortb2, { user: ortb2StructuredData.user });
    logMessage(`${LOG_PREFIX} merged user data`, ortb2StructuredData.user);
  }

  return true;
}

/**
 * Fetch RTD data from the Mantis API and populate ortb2 fragments.
 */
export function getBidRequestData(
  reqBidsConfigObj: { ortb2Fragments: { global: object } },
  onDone: () => void,
  moduleConfig: RTDProviderConfig<'mantis'>
): void {
  const params = (moduleConfig as unknown as MantisModuleConfig).params;
  const { endpoint } = params;
  const timeout = Number(params.timeout) || 1000;

  if (!endpoint) {
    logWarn(`${LOG_PREFIX} missing required param: endpoint`);
    onDone();
    return;
  }

  const url = buildApiUrl(endpoint);

  if (!url) {
    logError(`${LOG_PREFIX} invalid mantis api endpoint provided, skipping...`);
    onDone();
    return;
  }

  let isDone = false;
  let mantisApiTimeout: ReturnType<typeof setTimeout>;

  const completeRequest = (): void => {
    if (!isDone) {
      isDone = true;
      clearTimeout(mantisApiTimeout);
      onDone();
    }
  };

  mantisApiTimeout = setTimeout(function () {
    logWarn(`${LOG_PREFIX} Mantis API timeout reached, completing bid request.`);
    completeRequest();
  }, timeout);

  const onSuccess = function (responseText: string): void {
    if (isDone) {
      logWarn(`${LOG_PREFIX} response arrived after timeout, discarding.`);
      return;
    }
    try {
      const data: MantisApiResponse = JSON.parse(responseText);
      const processedData = processMantisData(data);
      const mantisSegments = getMantisKeysSegmentData(processedData);
      if (!mantisSegments || !Array.isArray(mantisSegments) || !mantisSegments.length) {
        logInfo(`${LOG_PREFIX} empty mantis data received`);
        completeRequest();
        return;
      }
      const ortb2StructuredData: MantisOrtb2StructuredData = {
        site: {
          content: {
            data: mantisSegments,
          },
        },
        user: {
          data: mantisSegments,
        },
      };
      const hasSetOrtb2Data = setOrtb2FromResponse(reqBidsConfigObj, ortb2StructuredData);
      if (!hasSetOrtb2Data) {
        logError(`${LOG_PREFIX} error occurred while setting data in ortb2Fragments.global`);
      }
      completeRequest();
    } catch (e: unknown) {
      logError(`${LOG_PREFIX} failed to process data from Mantis API`, (e as Error)?.message);
      completeRequest();
    }
  };

  const onError = function (statusText: string, xhr: XMLHttpRequest): void {
    if (isDone) { return; }
    logError(`${LOG_PREFIX} Mantis API request error - ${xhr?.status}, ${statusText}`);
    completeRequest();
  };

  ajax(url, { success: onSuccess, error: onError }, null, { method: 'GET' });
}

/**
 * Module init — validate required config params.
 * @example
 * window.pbjs.setConfig({
 *   realTimeData: {
 *     auctionDelay: 5000, // Should be as low as possible for production
 *     dataProviders: [
 *       {
 *         name: 'mantis',
 *         waitForIt: true,
 *         params: {
 *           endpoint: 'https://mantis.example.com',
 *           timeout: 1000,
 *         }
 *       }
 *     ]
 *   }
 * });
 */
function init(moduleConfig: RTDProviderConfig<'mantis'>): boolean {
  const params = (moduleConfig as unknown as MantisModuleConfig).params;

  if (!params || typeof params !== 'object') {
    logError(`${LOG_PREFIX} Missing Or invalid mantis config`);
    return false;
  }

  const { endpoint } = params;
  if (!endpoint) {
    logError(`${LOG_PREFIX} Missing required parameters in mantis config`);
    return false;
  }

  logMessage(`${LOG_PREFIX} Mantis RTD module initialized`);
  return true;
}

type MantisRtdProviderSpec = RtdProviderSpec<'mantis'>;

export const mantisDataModule: MantisRtdProviderSpec = {
  name: SUBMODULE_NAME,
  init,
  getBidRequestData,
};

submodule('realTimeData', mantisDataModule);
