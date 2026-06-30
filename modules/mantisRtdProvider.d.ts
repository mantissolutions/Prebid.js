/**
 * Type definitions for the Mantis RTD provider.
 * @module modules/mantisRtdProvider.types
 */

// ---------------------------------------------------------------------------
// Mantis API response shapes
// ---------------------------------------------------------------------------

/** A scored category entry from the Mantis API. */
export type MantisCategory = {
  /** Numeric relevance score in the range [0, 1]. */
  score: number;
  /** Human-readable category label (used by the mantis taxonomy). */
  label?: string;
  /** Taxonomy identifier (used by the IAB taxonomy). */
  id?: string;
};

/** Emotion breakdown returned by the Mantis API. */
export type MantisEmotion = {
  /** Intensity level string, e.g. "high", "medium", "low". */
  level: string;
};

/** Brand-safety rating entry per customer. */
export type MantisRating = {
  /** Customer identifier. */
  customer: string;
  /** Rating value, or "N/A" when no rating is available. */
  rating: string;
};

/** Shape of the raw JSON response from the Mantis contextual API. */
export type MantisApiResponse = {
  categories?: {
    /** Mantis-taxonomy category scores. */
    mantis?: MantisCategory[];
    /** IAB-taxonomy category scores. */
    iab?: MantisCategory[];
  };
  /** Emotion levels keyed by emotion name (e.g. "joy", "anger", "unknown"). */
  emotion?: Record<string, MantisEmotion>;
  /** Brand-safety ratings, one entry per customer. */
  ratings?: MantisRating[];
  /** Overall page sentiment string, e.g. "positive", "negative", "neutral". */
  sentiment?: string;
};

// ---------------------------------------------------------------------------
// Processed / internal data shapes
// ---------------------------------------------------------------------------

/**
 * The processed targeting values produced by {@link processMantisData}.
 * Each field is a comma-separated string of targeting tokens.
 */
export type MantisStandardTargeting = {
  /** Combined brand-safety, sentiment, emotion, and source tokens. */
  mantis: string;
  /** Mantis-taxonomy context labels above the score threshold. */
  mantis_context: string;
  /** IAB-taxonomy context IDs above the score threshold. */
  iab_context: string;
};

/** Wrapper returned by {@link processMantisData}. */
export type ProcessedMantisData = {
  standard: MantisStandardTargeting;
};

// ---------------------------------------------------------------------------
// oRTB2 segment shapes
// ---------------------------------------------------------------------------

/** A single oRTB2 segment object (id only). */
export type Ortb2Segment = {
  id: string;
};

/** A named oRTB2 segment group that maps to one Mantis targeting key. */
export type MantisSegmentGroup = {
  name: string;
  segment: Ortb2Segment[];
};

// ---------------------------------------------------------------------------
// oRTB2 structured data used to populate ortb2Fragments
// ---------------------------------------------------------------------------

/** Structured data object passed to {@link setOrtb2FromResponse}. */
export type MantisOrtb2StructuredData = {
  site?: {
    content?: {
      data?: MantisSegmentGroup[];
    };
  };
  user?: {
    data?: MantisSegmentGroup[];
  };
};

// ---------------------------------------------------------------------------
// Module configuration
// ---------------------------------------------------------------------------

/** Params block required in the publisher's on-page `realTimeData` config. */
export type MantisModuleParams = {
  /**
   * Base URL of the Mantis RTD API endpoint.
   * @example 'https://mantis.example.com'
   */
  endpoint: string;
  /**
   * Maximum milliseconds to wait for the Mantis API before continuing the auction.
   * Defaults to 1000 ms when omitted.
   */
  timeout?: number | string;
};

/** Full RTD module config object as provided by `setConfig`. */
export type MantisModuleConfig = {
  params: MantisModuleParams;
};

// ---------------------------------------------------------------------------
// Module declaration augmentation — registers params with the RTD spec system
// ---------------------------------------------------------------------------

declare module './rtdModule/spec' {
  interface ProviderConfig {
    mantis: {
      params?: MantisModuleParams;
    };
  }
}
