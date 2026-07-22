// Big Sky Command™ — Experience Engine
// the-vision-adapter.js
//
// TEMPORARY ADAPTER — pending migration into experience_sections.
// Same pattern as signature-entry-adapter.js and the-turn-adapter.js —
// see either file's header comment for the full reasoning.
//
// IMPORTANT DISTINCTION from identity-engine.js: this file configures
// question wording and timing ONLY. It contains zero interpretation
// logic — classifying a promise answer into an Identity Signature is
// entirely identity-engine.js's job, and this file has no knowledge of
// how that works, matching Act III itself.
//
// TO REMOVE ONCE experience_sections IS LIVE: delete this file, delete
// its <script> tag in index.html, change getConfig() to read from real
// section rows instead. initTheVision() in app.js does not change.

(function () {
  "use strict";

  var CONFIG_BY_EXPERIENCE_ID = {
    "BS000001": {
      enabled: true,
      // Same staged-reveal shape as Acts I-II's scenes.
      scenes: [
        {
          text: "You already asked yourself what they'd remember.",
          revealMs: 900,
          holdMs: 2800,
          exitMs: 500
        },
        {
          text: "Now tell us what you want them to.",
          revealMs: 900,
          holdMs: 2600,
          exitMs: 500
        }
      ],
      nameStep: {
        prompt: "What's your business called?",
        placeholder: "Your business name",
        skip: { allowSkip: true, skipAfterMs: 2000, skipLabel: "Skip" }
      },
      promiseStep: {
        prompt: "What do you want customers to remember about your business?",
        placeholder: "In your own words",
        skip: { allowSkip: true, skipAfterMs: 2500, skipLabel: "Skip" }
      }
    }
  };

  function getConfig(record) {
    var key = record && record.experience_id;
    var config = key && CONFIG_BY_EXPERIENCE_ID[key];
    return config || { enabled: false };
  }

  window.BigSkyTheVisionAdapter = {
    getConfig: getConfig
  };
})();
