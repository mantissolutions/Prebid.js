# Overview

This repository contains a Mantis Real-Time Data (RTD) provider module for Prebid.js.
The module enables publishers to enrich their ad auction requests with contextual intelligence sourced from the Mantis API. It runs client-side as part of the Prebid RTD framework and injects structured signals (such as brand safety ratings, sentiment, emotions, and content categories) into OpenRTB (ortb2) objects.

These signals allow demand partners (DSPs / bidders) to make more informed bidding decisions based on the context of the page.

---

## Problem This Module Solves

### Modern advertising increasingly depends on contextual targeting due to:

    - Reduced availability of third-party cookies
    - Increased privacy regulations
    - Demand for brand safety and suitability controls

### Without contextual signals:

    - Advertisers lack visibility into page content
    - Brand safety risks increase

### This module solves that by:

    - Fetching real-time contextual analysis of the page from Mantis
    - Translating that into OpenRTB-compliant segments
    - Injecting it into the Prebid auction before bidding occurs

### This enables:

    - Brand-safe advertising
    - Sentiment-aware targeting
    - Category-based targeting
    - Better monetization for publishers

---

## Why Auth-Only Behavior Exists

The Mantis API requires authentication (username + password) for all requests.

This design choice exists to:

### 1. Protect Proprietary Data

Mantis provides:

    - Brand safety scores
    - Content classification models
    - Contextual intelligence

These are paid and proprietary services, so access must be restricted.

### 2. Prevent Abuse

Without authentication:

    - API endpoints could be scraped
    - Rate limits could be bypassed
    - System load could become unpredictable


### 3. Ensure Customer Isolation

Each publisher:

    - Has its own account
    - May have different configurations, thresholds, or models

Authentication ensures:

    - Data isolation
    - Correct attribution of requests
    - Manageable usage tracking

---

## Features

### - Prebid RTD integration

    - Fully compatible with realTimeData module

### - Contextual enrichment

    - Page categories
    - Sentiment (positive / negative / unknown)
    - Emotions (e.g., joy-high, anger-low)
    - Brand safety ratings (GREEN / AMBER / RED)

### - ORTB2-compliant output

    - Populates:

        - site.content.data
        - user.data
        - ext.data

### - Segment normalization

    - Deduplication
    - Consistent formatting
    - Safe defaults for missing data

### - Client-side execution

    - No additional infrastructure needed
    - Fully runs in browser

### - Fail-safe design

    - Timeout handling
    - Graceful degradation
    - Auction never blocks

### - UUID support

    - Optional user identification for enhanced analysis

---

## Non-goals

This module intentionally does not:

    - Provide server-side integration (Prebid Server)
    - Store or persist long-term user data
    - Perform content analysis itself
        - All intelligence is provided by the Mantis API
    - Guarantee bidder usage of signals
        - DSPs decide how to use the data
    - Replace brand safety vendors or full DMP/CDP systems
    - Act as a standalone library (must be bundled into Prebid.js)

---

## Repository Structure

Prebid.js/
│
├── modules/
│   └── mantisRtdProvider.js                    # Main RTD module (core logic)
│   └── mantisRtdProvider.md                    # This page
└── test/
│   └── spec/
│       └── modules/
│           └── mantisRtdProvider_spec.js       # Unit tests

---

## Mantis RTD Integration Guide

## Overview

This guide explains how to integrate the Mantis Real-Time Data (RTD) module into a web page using Prebid.js.

The module enriches the Prebid auction by:

    - Calling the Mantis API
    - Retrieving contextual intelligence (brand safety, sentiment, categories)
    - Injecting the results into the OpenRTB (ortb2) object before bidding

### 1. Prerequisites

Before integration:

    - A custom Prebid.js build including:

        - realTimeData module
        - mantisRtdProvider module

    - Valid Mantis API credentials

        - endpoint
        - username
        - password

### 2. Required Configuration Fields

The module requires the following parameters:

### endpoint

    - Type: string
    - Description: Base URL of the Mantis API service
    - Example

    ``` https://publisher-mantis.example.com ```

### username

    - Type: string
    - Description: Username for HTTP Basic Authentication

### password

    - Type: string
    - Description: Password for HTTP Basic Authentication

### timeout

    - Type: number (milliseconds)
    - Default: 1000
    - Description: Maximum time the module waits for Mantis response before auction proceeds

### 3. Example Configuration

    ``` 
        pbjs.setConfig({
            realTimeData: {
                auctionDelay: 1000,
                dataProviders: [
                {
                    name: 'mantis',
                    waitForIt: true,
                    params: {
                    endpoint: 'https://publisher-mantis.example.com',
                    username: 'example-user',
                    password: 'example-pass',
                    timeout: 1000
                    }
                }
                ]
            }
        });
    ```

### 4. Request Behavior

When an auction starts (pbjs.requestBids()):

### Step-by-step flow

    1. Prebid detects RTD providers
    2. Mantis module is invoked
    3. The module:
        - Builds API request URL
        - Sends a GET request with Basic Auth header
    4. The request includes:
        - Cleaned page URL
        - Optional UUID (if available)

### Example Request

    ```
        GET https://publisher-mantis.example.com?filter=fullRatings,input,findings,sentiment,emotion,categories&url=example.com/article
        Authorization: Basic base64(username:password)
    ```

### Key Behaviors

    - Request is executed before auction
    - Auction waits only up to timeout
    - If request fails → auction continues normally
    - No blocking or hard dependency

### 5. Expected Endpoint Format

The endpoint should support:

    - GET requests
    - Basic Authentication
    - Query parameters:
        - filter
        - url
        - optional uuid

### Expected structure:

    ``` https://<mantis-endpoint>?filter=...&url=<host+path>&uuid=<optional> ```

### 6. Expected Response Structure

    ```
        {
            "ratings": [
                { "customer": "BrandA", "rating": "GREEN" },
                { "customer": "BrandB", "rating": "RED" }
            ],
            "sentiment": "positive",
            "emotion": {
                "joy": { "level": "high" },
                "anger": { "level": "low" }
            },
            "categories": {
                "mantis": [
                    { "label": "sports", "score": 0.9 }
                ],
                "iab": [
                    { "id": "IAB17", "score": 0.85 }
                ]
            }
        }
    ```

### 7. Data Processing (What the module generates)

    ```
        mantis = "BrandA-GREEN,sentiment-positive,joy-high,client-side"
        mantis_context = "sports"
        iab_context = "IAB17"
    ```

### 8. ORTB2 Output Shape

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
            },
            ext: {
                data: [ /* same structure */ ]
            }
        }
    ```
### 9. Timeout & Fallback Behavior

    - If API response exceeds timeout:

        ```
            → RTD module stops waiting
            → Auction proceeds without Mantis data
        ```

    - If API fails:

        ```
            → No data is injected
            → No impact on auction
        ```

### 10. Debugging Tips

To debug integration:

### Check:

    - Network tab → Mantis API request
    - Console logs:
        - "mantisRtdProvider:"
    - ORTB data:
        - pbjs.getConfig('ortb2')

---

## Request & Response Documentation

### 1. Request Format

### HTTP Method

``` GET ```

### Request URL Structure

```
    https://publisher-mantis.example.com
    ?filter=fullRatings,input,findings,sentiment,emotion,categories
    &url=<encoded-page-url>
    [&uuid=<optional-uuid>]
```

### Example Request

```
    GET https://publisher-mantis.example.com
    ?filter=fullRatings,input,findings,sentiment,emotion,categories
    &url=https%3A%2F%2Fwww.site.com%2Fnews%2Fstory

    Authorization: Basic <base64(username:password)>
```

### Header

``` Authorization: Basic <base64(username:password)> ```

### Query Parameters

### filter

    - Type: string
    - Description: Defines which data fields to fetch from Mantis
    - Value (fixed):
        ``` fullRatings,input,findings,sentiment,emotion,categories ```

### url

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

### uuid (optional)

    - Type: string
    - Source:
        - window.mantis_uuid
        - or localStorage["mantis:uuid"]
    - Description: User identifier for enhanced contextual analysis

### 3. Expected Mantis Response

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

### 4. Response Field Definitions

### ratings

    ``` { "customer": "Default", "rating": "GREEN" } ```

    - Represents brand safety / suitability
    - Values:
        - GREEN → Safe
        - AMBER → Moderate
        - RED → Unsafe

### sentiment

    ``` "positive" ```

    - Overall tone of the page
    - Values:
        - positive
        - neutral
        - negative

### emotion

    ``` "joy": { "level": "high" } ```

### categories

### Mantis taxonomy

    ``` { "label": "news", "score": 0.92 } ```

### IAB taxonomy

    ``` { "id": "IAB1", "score": 0.85 } ```

### 5. Mapping to Prebid (ORTB2)

The module transforms the response into Prebid ORTB2 format.

### Input

```
    {
    "ratings": [
        { "customer": "Default", "rating": "GREEN" },
        { "customer": "Facebook", "rating": "RED" }
    ]
    }
```

### Output (Prebid ORTB2)

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

The goal is to make behavior predictable, debuggable, and safe:

    - The auction must never be blocked
    - Errors must fail gracefully
    - No retries or hidden fallbacks are used

### 1. Normal Behavior

    When properly configured:

    1. Module is invoked before auction
    2. API request is sent to the configured endpoint
    3. Response is received within timeout
    4. Response is processed into segments
    5. Segments are injected into:
        - ortb2.site.content.data
        - ortb2.user.data

### 2. Credential Handling

### Request Requires Valid Credentials

    - The module requires:

        - endpoint
        - username
        - password

### Missing Credentials

### Behavior:

    - No request is made
    - Module exits early
    - onDone() is called immediately

### Invalid Credentials (401 Unauthorized)

### Behavior:

    - Request is sent
    - Server returns 401 Unauthorized
    - Response is not processed
    - No retry is attempted
    - No segments are added

### 3. Timeout Behavior

### Timeout Reached

### Behavior:

    - If no response is received within timeout::

        - Request is effectively abandoned
        - onDone() is triggered

### 4. Network & Request Failures

### Network Error / Request Failure

    Examples:

        - DNS failure
        - Connection timeout
        - Server unreachable

    Behavior:

        - Error is logged
        - No retry is attempted
        - No segments are added
        - Auction proceeds normally

### 5. Response Handling

### Valid Response

    - Parsed as JSON
    - Processed into segments
    - Injected into ORTB2

### Invalid JSON Response
    Examples:

    - Malformed JSON
    - Non-JSON response

    Behavior:

    - Parsing fails
    - Error is caught (try/catch)
    - No segments are added
    - Auction continues

### Unexpected Payload Structure

    Examples:

        - Missing fields (ratings, categories)
        - Incorrect formats

    Behavior:

        - Partial or empty data generated
        - Invalid fields ignored
        - Safe defaults applied (unknown)
        - May result in no segments

### 6. Empty or No Data Scenarios

### Empty Response or No Segments

    Examples:

        - No ratings
        - Categories below threshold
        - All values filtered out

    Behavior:

        - No segments are created
        - ORTB2 is not modified
        - Auction continues

### 7. Retry Behavior

### No Retries

    - The module does not retry failed requests
    - Applies to:
        - Network failures
        - 4xx responses
        - 5xx responses
        - Timeouts

### 8. Fallback Behavior

### No Public Fallback

    - There is no fallback API
    - No cached results are used
    - No alternative providers are invoked

## Testing & Local Development

### 1. Prerequisites

    Before getting started, ensure you have:

    - Node.js (recommended: LTS version)
    - npm (comes with Node.js)

### 2. Install Dependencies

    Run the following command from the root of the repository:
        - git clone https://github.com/prebid/Prebid.js.git
        - cd Prebid.js
        - npm ci

    This will:

        - Install all required dependencies
        - Set up dev tooling (linting, testing, etc.)

### 3. Running Tests

    Execute all unit tests:

        - Update the scripts with ``` "test:mantis": "gulp test --file=test/spec/modules/mantisRtdProvider_spec.js" ``` in package.json
        - npm run test:mantis

### What this does:

    - Runs all test suites
    - Verifies:
        - Data processing logic
        - Segment generation
        - Error handling
    - Ensures no regressions

### 4. Local Validation Before Release

    - Before submitting changes or preparing a release, validate the following:

### Functional Validation

    - Update the scripts with ``` "test:mantis": "gulp test --file=test/spec/modules/mantisRtdProvider_spec.js" ``` in package.json
    - npm run test:mantis

### Manual Logic Review

    Verify:

    - API request generation (URL + params)
    - Data processing logic (ratings, sentiment, categories)
    - ORTB2 output structure

### Example Validation

    Check that README examples still match:

    - API request format
    - Response structure
    - ORTB2 output

### Documentation Updates

    - README is updated (if behavior changed)
    - Examples reflect current logic
    - Config instructions remain accurate

### 5. Build & Run

    - Refer README.md file in root directory

## Contribution Workflow

    Follow this standard workflow for all changes:

    1. Create a new branch:
        - git checkout -b <type>/<ticket-id>-<short-description>

        Types:
            - feature | fix | refactor

        Example:
            - git checkout -b feature/ABC-123-add-mapping-logic


    2. Commit message format:
        - git commit -m "<type>:<ticket-id>-<short-description>"

        Example:
            - git commit -m "feat:ABC-123-add-mapping-logic"


    3. Filename convention:
        - Use camelCase

        Example:
            - mantisRtdProvider.js


    4. Test filename convention:
        - <filename>_spec

        Example:
            - mantisRtdProvider_spec.js


    5. Logging:
        - Use Prebid logging utilities

            - logMessage();
            - logWarn();
            - logError();
            - logInfo();