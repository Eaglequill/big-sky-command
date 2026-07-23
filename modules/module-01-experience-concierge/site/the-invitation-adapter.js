// Big Sky Command™ — Experience Engine
// the-invitation-adapter.js
//
// TEMPORARY ADAPTER — pending migration into experience_sections.
// Same pattern as the other three adapters. IMPORTANT DISTINCTION: the
// six tone lines below are content, keyed by signatureId, but the
// LOOKUP mechanism (which one to actually use) lives entirely in
// identity-engine.js's selectExpression() — this file has no
// interpretation logic of its own, matching Act III's own boundary.
//
// toneLines are currently RESERVED, not consumed anywhere in the
// approved Act IV sequence (The Manifest). Kept intact for a future
// Command Launch preview or QR Presentation feature — see
// docs/03_DECISIONS.md.
//
// calendarEmbeddable is a judgment call about ONE specific URL, not
// something code can safely auto-detect (a blocked iframe fails
// silently, no reliable signal) — set once by whoever configures the
// experience.
//
// TO REMOVE ONCE experience_sections IS LIVE: delete this file, delete
// its <script> tag in index.html, change getConfig() to read from real
// section rows instead. initTheInvitation() in app.js does not change.

(function () {
  "use strict";

  var CONFIG_BY_EXPERIENCE_ID = {
    "BS000001": {
      enabled: true,

      // Full-circle beats — used only when promiseText exists.
      fullCircleScenes: [
        { text: "Imagine this\u2026", revealMs: 900, holdMs: 1600, exitMs: 500 },
        { text: "Earlier, you told us\u2026", revealMs: 900, holdMs: 1800, exitMs: 500 }
        // The literal promise text itself is revealed by app.js directly
        // after these two lines — not configured here, since it's the
        // visitor's own words, not adapter content.
      ],
      turnScenes: [
        { text: "That's not just what you want customers to remember.", revealMs: 900, holdMs: 2600, exitMs: 500 },
        { text: "That's the business you're choosing to become.", revealMs: 900, holdMs: 2800, exitMs: 500 }
      ],
      closingLine: {
        text: "We'll help you build it.",
        revealMs: 900,
        holdMs: 2200,
        exitMs: 500
      },

      // Fallback when promiseText is null (skipped in Act III) — no
      // quote to reveal, so no full-circle structure either.
      fallbackNoPromise: {
        scenes: [
          { text: "Picture the business you're becoming.", revealMs: 900, holdMs: 2400, exitMs: 500 }
        ],
        closingLine: {
          text: "We'll help you build it.",
          revealMs: 900,
          holdMs: 2200,
          exitMs: 500
        }
      },

      // Consumed via window.BigSkyIdentityEngine.selectExpression() —
      // this file only supplies the map, never picks from it.
      toneLines: {
        trusted_hand: "Let's make sure it's done right.",
        personal_touch: "Let's make it feel personal, from the start.",
        craftsperson: "Let's get every detail right.",
        guide: "Let's give them something to trust.",
        storyteller: "Let's give your story somewhere to begin.",
        default: "Let's bring it to life."
      },

      cta: {
        label: "Let's Build Your Experience",
        supportingText: "the first step of Command Launch\u2122"
      },

      curtainMarkerText: "Command Launch\u2122 begins.",

      // THE MANIFEST — an honest, structured inventory of what Command
      // actually has and doesn't have yet, shown directly to the
      // visitor. Not a progress bar, not simulated work — every status
      // here is literally true the instant it's shown, never a
      // representation of background activity.
      manifest: {
        introLine: "Here is what Command now knows\u2014and what comes next.",
        introHoldMs: 2600,
        items: [
          { label: "Experience Identity", status: "Captured" },
          { label: "Customer Promise", status: "Captured" },
          { label: "Big Sky Scan\u2122", status: "Ready to configure" },
          { label: "Lead Capture", status: "Ready to configure" },
          { label: "Brand Profile", status: "Awaiting Command Launch\u2122" },
          { label: "Website Experience", status: "Awaiting Command Launch\u2122" },
          { label: "QR Experience", status: "Awaiting Command Launch\u2122" },
          { label: "AI Concierge", status: "Awaiting Command Launch\u2122" },
          { label: "CRM Configuration", status: "Awaiting Command Launch\u2122" },
          { label: "Automation Blueprint", status: "Awaiting Command Launch\u2122" }
        ],
        itemStaggerMs: 380,
        closingLine: "The rest is built through Command Launch\u2122.",
        closingHoldMs: 2400
      },

      // Calendar/booking panel — see the runtime truth table approved
      // earlier tonight. Corrected: no placeholder email. Verified
      // fallback is a real, working phone number.
      calendarEmbeddable: true,
      calendarEmbedHeading: "Choose a Time",
      calendarEmbedCopy: "When would you like to begin?",
      calendarLinkHeading: "Choose a Time",
      calendarLinkCopy: "Choose a time that works for you",
      calendarLinkButtonLabel: "Open Scheduling",
      formFallbackHeading: "Request a Conversation",
      formFallbackCopy: "Tell us how to reach you, and we'll follow up personally.",
      contactHeading: "Call Big Sky",
      contactCopy: "Speak with us directly.",
      contactPhone: "406-500-6407",
      contactButtonLabel: "Call 406-500-6407",

      footerSignature: "Powered by Big Sky Command\u2122"
    }
  };

  function getConfig(record) {
    var key = record && record.experience_id;
    var config = key && CONFIG_BY_EXPERIENCE_ID[key];
    return config || { enabled: false };
  }

  window.BigSkyTheInvitationAdapter = {
    getConfig: getConfig
  };
})();
