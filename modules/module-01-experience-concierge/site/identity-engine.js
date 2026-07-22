// Big Sky Command™ — Identity Engine
// identity-engine.js
//
// PERMANENT, UNIVERSAL infrastructure — this is NOT a temporary
// per-experience adapter like signature-entry-adapter.js or
// the-turn-adapter.js. Every future Big Sky experience calls the same
// interpretPromise() interface; only this file's internal
// implementation is expected to evolve over time. See
// docs/15_IDENTITY_ENGINE_FOUNDATION.md.
//
// THE CONTRACT — the only thing any caller may ever depend on:
//
//   window.BigSkyIdentityEngine.interpretPromise(promiseText, context)
//     → Promise resolving to:
//         {
//           signatureId: "trusted_hand" | "personal_touch" |
//                        "craftsperson" | "guide" | "storyteller" |
//                        null,
//           confidence: "high" | "low" | null
//         }
//
// A null signatureId is a normal, valid outcome — no confident match —
// never an error. Callers must treat it as "fall back to generic
// framing," not as something to retry or report.
//
// Returns a Promise even though today's implementation resolves
// instantly and synchronously under the hood. This is deliberate: a
// future AI-backed implementation will need to make a real network
// call, and making the interface async now means that swap requires
// zero changes to any caller — not Act III, not anything built later.
//
// `context` is accepted and currently ignored — reserved for whatever
// a future implementation might use (industry, audience, prior
// behavior). Adding real use of it is then a change to this file
// alone.

(function () {
  "use strict";

  // The five canonical Identity Signatures (docs/15). Keyword lists are
  // a deliberately small, hand-authored approximation — not real
  // understanding. See docs/15 "Deterministic Version 1 vs. AI
  // Concierge evolution" for why that's the responsible choice today,
  // not a placeholder to be embarrassed about.
  var SIGNATURE_KEYWORDS = {
    trusted_hand: ["trust", "reliable", "reliability", "honest", "honesty", "count on", "dependable", "show up", "showed up"],
    personal_touch: ["care", "caring", "personal", "family", "warm", "warmth", "know us", "know them", "relationship"],
    craftsperson: ["quality", "detail", "details", "right", "craft", "pride", "precise", "precision", "well made"],
    guide: ["confidence", "confident", "expert", "expertise", "know what", "trust us to", "guidance", "clear"],
    storyteller: ["story", "tradition", "legacy", "heritage", "history", "generations", "roots"]
  };

  function scoreText(text) {
    var lower = String(text || "").toLowerCase();
    var scores = {};
    Object.keys(SIGNATURE_KEYWORDS).forEach(function (id) {
      scores[id] = SIGNATURE_KEYWORDS[id].filter(function (kw) {
        return lower.indexOf(kw) !== -1;
      }).length;
    });
    return scores;
  }

  function pickSignature(scores) {
    var ids = Object.keys(scores);
    var best = null, bestScore = 0, tie = false;
    ids.forEach(function (id) {
      if (scores[id] > bestScore) {
        best = id;
        bestScore = scores[id];
        tie = false;
      } else if (scores[id] === bestScore && bestScore > 0) {
        tie = true;
      }
    });
    if (!best || bestScore === 0 || tie) {
      return { signatureId: null, confidence: null };
    }
    return { signatureId: best, confidence: bestScore >= 2 ? "high" : "low" };
  }

  function interpretPromise(promiseText, context) {
    void context; // reserved, unused in V1 — see file header
    var result = pickSignature(scoreText(promiseText));
    return Promise.resolve(result);
  }

  window.BigSkyIdentityEngine = {
    interpretPromise: interpretPromise
  };
})();
