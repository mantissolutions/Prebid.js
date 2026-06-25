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

This repository contains a Mantis Real-Time Data (RTD) provider module for Prebid.js.
The module enables publishers to enrich their ad auction requests with contextual intelligence sourced from the Mantis API. It runs client-side as part of the Prebid RTD framework and injects structured signals (such as brand safety ratings, sentiment, emotions, and content categories) into OpenRTB (ortb2) objects.

These signals allow demand partners (DSPs / bidders) to make more informed bidding decisions based on the context of the page.

---

## Problem This Module Solves


Modern advertising increasingly depends on contextual targeting due to -

    - Reduced availability of third-party cookies
    - Increased privacy regulations
    - Demand for brand safety and suitability controls

Without contextual signals -

    - Advertisers lack visibility into page content
    - Brand safety risks increase

This module solves that by -

    - Fetching real-time contextual analysis of the page from Mantis
    - Translating that into OpenRTB-compliant segments
    - Injecting it into the Prebid auction before bidding occurs

This enables -

    - Brand-safe advertising
    - Sentiment-aware targeting
    - Category-based targeting
    - Better monetization for publishers

---

## Features

### Prebid RTD integration

    - Fully compatible with realTimeData module

### Contextual enrichment

    - Page categories
    - Sentiment (positive / negative / unknown)
    - Emotions (e.g., joy-high, anger-low)
    - Brand safety ratings (GREEN / AMBER / RED)

### ORTB2-compliant output

    - Populates -

        - site.content.data
        - user.data

### Segment normalization

    - Deduplication
    - Consistent formatting
    - Safe defaults for missing data

### Client-side execution

    - No additional infrastructure needed
    - Fully runs in browser

### Fail-safe design

    - Timeout handling
    - Graceful degradation
    - Auction never blocks

---

## Mantis RTD Integration Guide

**Overview**

This guide explains how to integrate the Mantis Real-Time Data (RTD) module into a web page using Prebid.js.

Before integration:

    - A custom Prebid.js build including -

        - realTimeData module
        - mantisRtdProvider module
        - Bid adapters of your choice
        - Any other module/submodule if needed

    - Mantis API endpoint

        - endpoint

**Required Configuration Fields**


The module requires the following parameters -

- endpoint

    - Type: string
    - Description: Base URL of the Mantis API service
    - Example

    ``` https://api.example.com/mantis-publisher/article/classification ```

## Example Configuration

    ``` 
        pbjs.setConfig({
            realTimeData: {
                auctionDelay: 1000, // 'auctionDelay' should be as low as possible since higher values can negatively impact page performance and increase latency.
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

## Request Behavior

When an auction starts (pbjs.requestBids()) -

**Step-by-step flow**

    1. Prebid detects RTD providers
    2. Mantis module is invoked
    3. The module -
        - Builds API request URL
        - Sends a GET request
    4. The request includes -
        - Cleaned page URL

**Key Behaviors**

    - Request is executed before auction
    - Auction waits only up to auctionDelay
    - If request fails → auction continues normally
    - No blocking or hard dependency

**ORTB2 Output Shape**

    ```
        ortb2Fragments.global = {
            site: {
                content: {
                    data: [
                        {
                            name: "mantis",
                            segment: [
                                { id: "BrandA-GREEN" },
                                { id: "sentiment-positive" },
                                { id: "joy-high" }
                            ]
                        },
                        {
                            name: "mantis_context",
                            segment: [{ id: "sports" }]
                        },
                        {
                            name: "iab_context",
                            segment: [{ id: "IAB17" }]
                        }
                    ]
                }
            },
            user: {
                data: [ /* same structure */ ]
            }
        }
    ```
## Timeout & Fallback Behavior

    - If API response exceeds auctionDelay -

        ```
            → RTD module stops waiting
            → Auction proceeds without Mantis data
        ```

    - If API fails -

        ```
            → No data is injected
            → No impact on auction
        ```

## Debugging Tips

To debug integration:

**Check -**

    - Network tab → Mantis API request
    - Console logs -
        - "mantisRtdProvider"

---

## Request & Response Documentation

**Request Format**

- HTTP Method

``` GET ```

- Request URL Structure

```
    https://<mantis-endpoint>?cacheType=public&filter=fullRatings,input,findings,sentiment,emotion,categories
    &url=<encoded-page-url>
```

- Example Request

```
    GET https://<mantis-endpoint>?cacheType=public&filter=fullRatings,input,findings,sentiment,emotion,categories
    &url=https%3A%2F%2Fwww.site.com%2Fnews%2Fstory
```

## Query Parameters

**- cacheType**

    - Type: string
    - Description: Defines authorization is not required
    - Value (fixed): public

**- filter**

    - Type: string
    - Description: Defines which data fields to fetch from Mantis
    - Value (fixed):
        ``` fullRatings,input,findings,sentiment,emotion,categories ```

**- url**

    - Type: string (URL-encoded)
    - Description: Current page URL (hostname + path only)

    Example transformation:

    ``` 
        Original:
        https://www.site.com/news/story?id=123

        Sent:
        www.site.com/news/story
        → URL-encoded → https%3A%2F%2Fwww.site.com%2Fnews%2Fstory
    ```

## Expected Mantis Response

    ```
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
                "mantis": [
                    { "label": "news", "score": 0.92 }
                ],
                "iab": [
                    { "id": "IAB1", "score": 0.85 }
                ]
            }
        }
    ```

## Response Field Definitions

**- ratings**

    ``` { "customer": "Default", "rating": "GREEN" } ```

    - Represents brand safety / suitability
    - Values:
        - GREEN → Safe
        - AMBER → Moderate
        - RED → Unsafe

**- sentiment**

    ``` "positive" ```

    - Overall tone of the page
    - Values:
        - positive
        - neutral
        - negative

**- emotion**

    ``` "joy": { "level": "high" } ```

**- categories**

Mantis taxonomy

    ``` { "label": "news", "score": 0.92 } ```

IAB taxonomy

    ``` { "id": "IAB1", "score": 0.85 } ```

Mapping to Prebid (ORTB2)

The module transforms the response into Prebid ORTB2 format.

Input

```
    {
        "ratings": [
            { "customer": "Default", "rating": "GREEN" },
            { "customer": "Facebook", "rating": "RED" }
        ]
    }
```

Output (Prebid ORTB2)

```
    ortb2.user.data = [
        {
            name: 'mantis',
            segment: [
                { id: 'Default-GREEN' },
                { id: 'Facebook-RED' }
            ]
        }
    ];
```

---

## Behavior & Failure Modes

This section describes how the Mantis RTD module behaves during normal operation and under various failure conditions.

The goal is to make behavior predictable, debuggable, and safe -

    - The auction must never be blocked
    - Errors must fail gracefully
    - No retries or hidden fallbacks are used

**Normal Behavior**

    When properly configured -

    1. Module is invoked before auction
    2. API request is sent to the configured endpoint
    3. Response is received within timeout
    4. Response is processed into segments
    5. Segments are injected into -
        - ortb2.site.content.data
        - ortb2.user.data

**Missing Endpoint**

    - No request is made
    - Module exits early
    - onDone() is called immediately

**Invalid Endpoint (404 Not Found)**

    - Request is sent
    - Server returns 404 Not Found
    - Response is not processed
    - No retry is attempted
    - No segments are added

**Timeout Behavior**

    If no response is received within timeout -
      - Request is effectively abandoned
      - onDone() is triggered

**Network Error / Request Failure**

    Examples - 

        - DNS failure
        - Connection timeout
        - Server unreachable

    Behavior - 

        - Error is logged
        - No retry is attempted
        - No segments are added
        - Auction proceeds normally

## Fallback Behavior

**No Public Fallback**

    - There is no fallback API
    - No cached results are used
    - No alternative providers are invoked

**Build & Run**

    - Refer README.md file in root directory