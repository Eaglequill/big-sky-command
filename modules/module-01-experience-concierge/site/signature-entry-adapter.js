// Big Sky Command™ — Experience Engine
// signature-entry-adapter.js
//
// TEMPORARY ADAPTER — pending migration into experience_sections.
//
// This file exists only because 05_experience_sections.sql has not yet
// been applied to production. It is NOT part of the reusable
// Experience Engine (app.js), and the Signature Entry component in
// app.js has no knowledge of what is inside this file — it only ever
// calls window.BigSkySignatureEntryAdapter.getConfig(record) and uses
// whatever comes back.
//
// TO REMOVE ONCE experience_sections IS LIVE: delete this file, delete
// the one <script> tag in index.html that loads it, and change
// getConfig()'s implementation to read from a real section instead of
// this lookup table. initSignatureEntry() in app.js does not change.
//
// SAFETY: keyed by experience_id. Any experience_id not listed below
// gets { enabled: false } — identical to "no intro configured," the
// same graceful no-op every experience without a Signature Entry
// already receives. This file is structurally incapable of affecting
// any experience other than the one(s) explicitly listed here.

(function () {
  "use strict";

  var CONFIG_BY_EXPERIENCE_ID = {
    "BS000001": {
      enabled: true,
      scenes: [
        {
          id: "scene-1",
          order: 0,
          text: "What will your next customer remember about your business?",
          revealMs: 900,
          holdMs: 3200,
          exitMs: 500
        },
        {
          id: "scene-2",
          order: 1,
          text: "The businesses people remember are the businesses they return to\u2026 and recommend.",
          revealMs: 900,
          holdMs: 3400,
          exitMs: 500
        },
        {
          id: "scene-3",
          order: 2,
          text: "Big Sky Solutions\u2122 help businesses create experiences customers remember.",
          revealMs: 900,
          holdMs: 2800,
          exitMs: 500
        }
      ],
      cta: {
        label: "Show Me How",
        action: "reveal-experience" // the only action the component supports today
      },
      visualAssets: {
        backgroundImageUrl: null,
        backgroundVideoUrl: null
      },
      skip: {
        allowSkip: true,
        skipAfterMs: 1500,
        skipLabel: "Skip"
      },
      safetyTimeoutMs: 25000
    }
  };

  function getConfig(record) {
    var key = record && record.experience_id;
    var config = key && CONFIG_BY_EXPERIENCE_ID[key];
    return config || { enabled: false };
  }

  window.BigSkySignatureEntryAdapter = {
    getConfig: getConfig
  };
})();
