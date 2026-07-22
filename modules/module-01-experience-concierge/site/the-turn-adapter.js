// Big Sky Command™ — Experience Engine
// the-turn-adapter.js
//
// TEMPORARY ADAPTER — pending migration into experience_sections.
// Mirrors signature-entry-adapter.js exactly in structure and intent —
// see that file's header comment for the full reasoning, which applies
// here unchanged. This file is NOT part of the reusable Experience
// Engine (app.js); initTheTurn() only ever calls
// window.BigSkyTheTurnAdapter.getConfig(record) and has no knowledge of
// what's behind that call.
//
// TO REMOVE ONCE experience_sections IS LIVE: delete this file, delete
// its <script> tag in index.html, change getConfig() to read from real
// section rows instead. initTheTurn() in app.js does not change.
//
// SAFETY: keyed by experience_id, same as the Signature Entry adapter.
// Any experience_id not listed gets { enabled: false } — identical to
// "no Act II configured."

(function () {
  "use strict";

  var CONFIG_BY_EXPERIENCE_ID = {
    "BS000001": {
      enabled: true,
      // Same staged-reveal shape as Signature Entry's scenes — reusing
      // the identical mechanism, not a new one.
      scenes: [
        {
          text: "That feeling you just had?",
          revealMs: 900,
          holdMs: 2200,
          exitMs: 500
        },
        {
          text: "That's the experience your customers could have.",
          revealMs: 900,
          holdMs: 3200,
          exitMs: 500
        },
        {
          // The bridge line — the specific job here is pivoting the
          // visitor from their own felt experience ("me") to imagining
          // it for their customers ("my customers"), not just softening
          // the jump into the cards generally. Reuses "your customers"
          // verbatim from the prior line rather than switching to a new
          // subject, so the pivot stays one continuous thought.
          text: "Now imagine your customers, feeling that too.",
          revealMs: 900,
          holdMs: 2400,
          exitMs: 500
        }
      ],
      // Pulled directly from the QR Philosophy's own established
      // examples (docs/01 §4) — not new copy invented for this moment.
      cards: [
        { id: "hvac", text: "See what your repair could cost." },
        { id: "realtor", text: "Walk through this home before you walk inside." },
        { id: "photographer", text: "See the wedding gallery." },
        { id: "vacation_rental", text: "Everything you need for your stay." },
        { id: "winery", text: "Taste the story behind every bottle." }
      ],
      // Graceful fallback — never force a choice with no escape. If
      // used, Act III's "carried forward" beat falls back to generic
      // phrasing instead of an industry-specific one.
      continueFallback: {
        label: "Continue",
        appearAfterMs: 4000
      }
    }
  };

  function getConfig(record) {
    var key = record && record.experience_id;
    var config = key && CONFIG_BY_EXPERIENCE_ID[key];
    return config || { enabled: false };
  }

  window.BigSkyTheTurnAdapter = {
    getConfig: getConfig
  };
})();
