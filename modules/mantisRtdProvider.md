---
layout: page_v2
title: Mantis RTD Module
display_name: Mantis RTD Module
description: Enables publishers to enrich their ad auction requests with contextual intelligence sourced from the Mantis API into OpenRTB bid requests
page_type: module
module_type: rtd
module_code: mantisRtdProvider
vendor_specific: true
enable_download: true
sidebarType: 1
---

# Mantis RTD Module

```
Module Name: Mantis Rtd Provider
Module Type: Rtd Provider
Maintainer: Mantis Solutions, a subsidiary of Reach PLC
```
{:.no_toc}

* TOC
{:toc}

## Overview

The Mantis RTD provider module for Prebid.js enables publishers to enrich ad auction requests with contextual intelligence from the Mantis API. It runs client-side as part of the Prebid RTD framework and injects structured signals — brand safety ratings, sentiment, emotions, and content categories — into OpenRTB (`ortb2`) objects before bidding occurs, allowing demand partners to make more informed bidding decisions.

---

## Features

### Contextual enrichment

- Page categories (Mantis taxonomy and IAB taxonomy)
- Sentiment (`positive` / `negative` / `neutral` / `unknown`)
- Emotions (e.g. `joy-high`, `anger-low`)
- Brand safety ratings (e.g. `GREEN`, `AMBER`, `RED`)

### oRTB2-compliant output

Populates `site.content.data` and `user.data` with named segment groups.

### Fail-safe design

- Timeout controlled by `auctionDelay` — auction is never blocked
- Graceful degradation on any error or missing data

---

## Integration Guide

### Prerequisites

- A custom Prebid.js build that includes the `realTimeData` module and `mantisRtdProvider` module
- A Mantis API endpoint URL

### Required Configuration Fields

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `endpoint` | string | yes | Base URL of the Mantis API service |

The API request timeout is controlled by the top-level `auctionDelay` setting in the `realTimeData` config. Keep it as low as possible — higher values increase auction latency.

### Example Configuration

```js
pbjs.setConfig({
  realTimeData: {
    auctionDelay: 1000, // keep as low as possible for production
    dataProviders: [
      {
        name: 'mantis',
        waitForIt: true,
        params: {
          endpoint: 'https://publisher-mantis.example.com/api/demo'
        }
      }
    ]
  }
});
```

---

## Request & Response Reference

### Request Format

- **Method:** `GET`
- **URL structure:**

```
https://<endpoint>?cacheType=public&filter=fullRatings,input,findings,sentiment,emotion,categories&url=<host+pathname>
```

- **Example:**

```
GET https://mantis.example.com/api?cacheType=public&filter=fullRatings,input,findings,sentiment,emotion,categories&url=www.site.com/news/story
```

### Query Parameters

| Parameter | Type | Value | Description |
|-----------|------|-------|-------------|
| `cacheType` | string | `public` (fixed) | Indicates no authorization is required |
| `filter` | string | `fullRatings,input,findings,sentiment,emotion,categories` (fixed) | Data fields to fetch |
| `url` | string | host + pathname of current page | Query string, fragment, and credentials are stripped; value is not percent-encoded |

**URL parameter example:**

```
Original:  https://www.site.com/news/story?id=123#top
Sent:      www.site.com/news/story
```

### Expected Mantis Response

```json
{
  "ratings": [
    { "customer": "Default", "rating": "GREEN" },
    { "customer": "Facebook", "rating": "RED" }
  ],
  "sentiment": "positive",
  "emotion": {
    "joy": { "level": "high" },
    "anger": { "level": "low" }
  },
  "categories": {
    "mantis": [{ "label": "news", "score": 0.92 }],
    "iab": [{ "id": "IAB1", "score": 0.85 }]
  }
}
```

### Response Field Definitions

**`ratings`** — Brand safety / suitability per customer. `N/A` entries are skipped.

| Rating | Meaning |
|--------|---------|
| `GREEN` | Safe |
| `AMBER` | Moderate |
| `RED` | Unsafe |

**`sentiment`** — Overall tone of the page. Values: `positive`, `neutral`, `negative`.

**`emotion`** — Emotion levels keyed by emotion name (e.g. `joy`, `anger`). The special key `unknown` maps to the token `emotions-unknown`.

**`categories.mantis`** — Mantis-taxonomy categories. Only entries with `score > 0.6` are included; the `label` field is used as the segment id.

**`categories.iab`** — IAB-taxonomy categories. Only entries with `score > 0.6` are included; the `id` field is used as the segment id.

### Response to oRTB2 Mapping

The `mantis` group encodes all brand-safety, sentiment, emotion, and source tokens as a **single comma-separated string** in one segment `id`. The `mantis_context` and `iab_context` groups each produce one segment object per category that passes the score threshold.

**Input:**

```json
{
  "ratings": [{ "customer": "Default", "rating": "GREEN" }],
  "sentiment": "positive",
  "emotion": { "joy": { "level": "high" } },
  "categories": {
    "mantis": [{ "label": "sports", "score": 0.9 }],
    "iab": [{ "id": "IAB17", "score": 0.8 }]
  }
}
```

**Output (`ortb2Fragments.global`):**

```js
{
  site: {
    content: {
      data: [
        { name: 'mantis',         segment: [{ id: 'Default-GREEN,sentiment-positive,joy-high,prebid-rtdmodule' }] },
        { name: 'mantis_context', segment: [{ id: 'sports' }] },
        { name: 'iab_context',    segment: [{ id: 'IAB17' }] }
      ]
    }
  },
  user: {
    data: [ /* same as site.content.data */ ]
  }
}
```

---

## Behavior & Failure Modes

All errors fail gracefully with no retries — the auction is never blocked.

| Scenario | Behavior |
|----------|----------|
| Valid config, response within `auctionDelay` | Segments injected into `ortb2Fragments.global` |
| Missing `endpoint` param | No request made; auction continues immediately |
| Non-2xx response (e.g. 404, 500) | Error logged; no segments added; auction continues |
| Response exceeds `auctionDelay` | Module stops waiting; auction continues without data |
| Network error (DNS failure, unreachable) | Error logged; no segments added; auction continues |
| Late response (arrives after timeout) | Response discarded; auction already proceeding |
| Empty or below-threshold API data | No segments injected; auction continues normally |

---

## Debugging

Filter console logs by `mantisRtdProvider:` to see init, timeout, and error messages. Check the network tab for the GET request to the configured `endpoint`.
