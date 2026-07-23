// Big Sky Command™ — Experience Engine
// app.js
//
// This file is the ONE reusable engine. It contains no business-specific
// text, colors, images, or embeds. Everything rendered comes from the
// experience record matched by the URL — this file never knows or cares
// whether that record came from Supabase or a local file. See
// data-provider.js for that decision.
//
// Flow:
//   1. Read an identifier from the URL: either an Experience ID from
//      /e/{EXPERIENCE_ID} (original, still primary/required), or, if
//      that's absent, a slug from /experience/{slug} (new, additive).
//   2. Ask the data provider for an active record matching whichever
//      identifier was found.
//   3. Populate the template in index.html with that record's data.
//   4. Run the Signature Entry sequence if one is configured for this
//      experience (see initSignatureEntry below), then reveal the page.
//   5. If neither identifier is present, or no active record matches,
//      show the fallback message instead.
//
// Journey this template renders, in fixed order (see index.html):
//   Signature Entry (reusable, config-driven) → Hero → Welcome Video →
//   Lead Capture → AI Concierge (reserved) → Thank You
// Video and Lead Capture always render — either the real content, or a
// designed placeholder state — so every future client's experience shows
// the full journey from day one, and swapping in real assets later never
// requires touching this file or the markup.

(function () {
  "use strict";

  var els = {
    loading: document.getElementById("state-loading"),
    notFound: document.getElementById("state-notfound"),
    loadFailed: document.getElementById("state-loadfailed"),
    experience: document.getElementById("experience"),

    loadFailedRetry: document.getElementById("state-loadfailed-retry"),
    loadFailedReturn: document.getElementById("state-loadfailed-return"),

    signatureEntry: document.getElementById("exp-signature-entry"),
    signatureEntryText: document.getElementById("exp-signature-entry-text"),
    signatureEntryCta: document.getElementById("exp-signature-entry-cta"),
    signatureEntrySkip: document.getElementById("exp-signature-entry-skip"),

    theTurn: document.getElementById("exp-the-turn"),
    theTurnText: document.getElementById("exp-the-turn-text"),
    theTurnCards: document.getElementById("exp-the-turn-cards"),
    theTurnContinue: document.getElementById("exp-the-turn-continue"),

    theVision: document.getElementById("exp-the-vision"),
    theVisionText: document.getElementById("exp-the-vision-text"),
    theVisionNameStep: document.getElementById("exp-the-vision-name-step"),
    theVisionNameInput: document.getElementById("exp-the-vision-name-input"),
    theVisionNameSubmit: document.getElementById("exp-the-vision-name-submit"),
    theVisionNameSkip: document.getElementById("exp-the-vision-name-skip"),
    theVisionPromiseStep: document.getElementById("exp-the-vision-promise-step"),
    theVisionPromiseInput: document.getElementById("exp-the-vision-promise-input"),
    theVisionPromiseSubmit: document.getElementById("exp-the-vision-promise-submit"),
    theVisionPromiseSkip: document.getElementById("exp-the-vision-promise-skip"),
    theVisionReveal: document.getElementById("exp-the-vision-reveal"),
    theVisionRevealName: document.getElementById("exp-the-vision-reveal-name"),
    theVisionRevealPromise: document.getElementById("exp-the-vision-reveal-promise"),

    theInvitation: document.getElementById("exp-the-invitation"),
    theInvitationText: document.getElementById("exp-the-invitation-text"),
    theInvitationPromiseReveal: document.getElementById("exp-the-invitation-promise-reveal"),
    theInvitationCtaBlock: document.getElementById("exp-the-invitation-cta-block"),
    theInvitationCta: document.getElementById("exp-the-invitation-cta"),
    theInvitationCtaSupport: document.getElementById("exp-the-invitation-cta-support"),
    theInvitationCurtain: document.getElementById("exp-the-invitation-curtain"),
    theInvitationCurtainMarker: document.getElementById("exp-the-invitation-curtain-marker"),
    theInvitationManifest: document.getElementById("exp-the-invitation-manifest"),
    theInvitationPanel: document.getElementById("exp-the-invitation-panel"),
    theInvitationPanelHeading: document.getElementById("exp-the-invitation-panel-heading"),
    theInvitationPanelCopy: document.getElementById("exp-the-invitation-panel-copy"),
    theInvitationCalendarEmbed: document.getElementById("exp-the-invitation-calendar-embed"),
    theInvitationCalendarLink: document.getElementById("exp-the-invitation-calendar-link"),
    theInvitationFormEmbed: document.getElementById("exp-the-invitation-form-embed"),
    theInvitationContactLink: document.getElementById("exp-the-invitation-contact-link"),
    theInvitationFooterText: document.getElementById("exp-the-invitation-footer-text"),

    headline: document.getElementById("exp-headline"),
    subheadline: document.getElementById("exp-subheadline"),
    eyebrow: document.getElementById("exp-eyebrow"),

    videoLogo: document.getElementById("exp-video-logo"),
    video: document.getElementById("exp-video"),
    videoPlaceholder: document.getElementById("exp-video-placeholder"),
    videoPlaceholderText: document.getElementById("exp-video-placeholder-text"),

    dynamicSections: document.getElementById("exp-dynamic-sections"),

    cta: document.getElementById("exp-cta"),
    formEmbed: document.getElementById("exp-form-embed"),
    formPlaceholder: document.getElementById("exp-form-placeholder"),

    aiCopy: document.getElementById("exp-ai-copy"),

    thankYou: document.getElementById("exp-thankyou")
  };

  // "loadfailed" is distinct from "notfound": notfound means the request
  // succeeded and there's genuinely no such experience (or an active
  // record) — an ordinary, expected result, never treated as a failure.
  // loadfailed means the request itself didn't complete — a timeout, a
  // rejected promise, or an unexpected exception. See startExperienceLoad().
  //
  // showState() is the ONLY place any top-level visual state is ever
  // toggled — no component manages its own `hidden` attribute directly.
  // This is a direct, deliberate lesson from the Act I containment bug:
  // an element nested inside another hidden container, or hidden
  // outside this function, can become invisible in a way nothing else
  // in the codebase can reason about or fix. Every new state added to
  // this template must be registered here.
  function showState(name) {
    els.loading.hidden = name !== "loading";
    els.notFound.hidden = name !== "notfound";
    if (els.loadFailed) els.loadFailed.hidden = name !== "loadfailed";
    if (els.signatureEntry) els.signatureEntry.hidden = name !== "signatureentry";
    if (els.theTurn) els.theTurn.hidden = name !== "theturn";
    if (els.theVision) els.theVision.hidden = name !== "thevision";
    if (els.theInvitation) els.theInvitation.hidden = name !== "theinvitation";
    els.experience.hidden = name !== "experience";
  }

  // Races a promise against a timeout. If the timeout wins, the returned
  // promise rejects — which propagates up through loadExperience() and is
  // caught by startExperienceLoad()'s top-level boundary below. Applied
  // only to the primary experience fetch (see loadExperience) — the QR
  // scan-resolution path is untouched, per its own existing design.
  function withTimeout(promise, ms, label) {
    var timeoutId;
    var timeoutPromise = new Promise(function (resolve, reject) {
      timeoutId = window.setTimeout(function () {
        reject(new Error("Big Sky Command: " + (label || "request") + " timed out after " + ms + "ms."));
      }, ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(function () {
      window.clearTimeout(timeoutId);
    });
  }

  var LOAD_TIMEOUT_MS = 7000;



  // A value counts as "provided" only if it's non-empty and isn't one of
  // our own labeled placeholder strings — so an unfilled placeholder
  // safely falls back to a designed empty state instead of displaying
  // "PLACEHOLDER — ...".
  function isUsable(value) {
    if (!value) return false;
    var trimmed = String(value).trim();
    if (trimmed === "") return false;
    if (/^PLACEHOLDER\b/i.test(trimmed)) return false;
    if (/^<!--\s*PLACEHOLDER\b/i.test(trimmed)) return false;
    return true;
  }

  // Extracts the Experience ID from a path like "/e/BS000001" (with or
  // without a trailing slash, and regardless of hosting subpath).
  // UNCHANGED from the original — this remains the primary, required
  // route and is checked first in loadExperience() below.
  function getExperienceIdFromUrl() {
    var path = window.location.pathname;
    var match = path.match(/\/e\/([^/]+)\/?$/i);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
    // Fallback for static hosts without path-rewrite support configured yet:
    // https://example.com/?e=BS000001
    var params = new URLSearchParams(window.location.search);
    var fromQuery = params.get("e");
    return fromQuery ? fromQuery.trim() : null;
  }

  // NEW — additive. Extracts a slug from "/experience/{slug}". Only
  // consulted when getExperienceIdFromUrl() above finds nothing, so this
  // never interferes with an existing /e/{id} link.
  function getExperienceSlugFromUrl() {
    var path = window.location.pathname;
    var match = path.match(/\/experience\/([^/]+)\/?$/i);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
    return null;
  }

  // Injects raw HTML (e.g. a GHL form embed) and makes sure any <script>
  // tags inside it actually execute — innerHTML alone will not run them.
  function injectEmbedHtml(container, html) {
    container.innerHTML = html;
    var scripts = container.querySelectorAll("script");
    scripts.forEach(function (oldScript) {
      var newScript = document.createElement("script");
      Array.prototype.forEach.call(oldScript.attributes, function (attr) {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.text = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }

  function applyBrandColors(record) {
    var root = document.documentElement;
    if (isUsable(record.primary_color)) {
      root.style.setProperty("--exp-primary", record.primary_color.trim());
    }
    if (isUsable(record.secondary_color)) {
      root.style.setProperty("--exp-secondary", record.secondary_color.trim());
    }
  }

  // NEW — additive. Applies an optional hero background image on top of
  // the existing .exp-hero-atmosphere element. Requires no HTML or CSS
  // changes: if hero_image_url isn't set on the record, this is a no-op
  // and the hero looks exactly as it does today for every existing
  // client.
  function applyHeroImage(record) {
    var atmosphere = document.querySelector(".exp-hero-atmosphere");
    if (!atmosphere || !isUsable(record.hero_image_url)) return;
    atmosphere.style.backgroundImage = 'url("' + record.hero_image_url + '")';
    atmosphere.style.backgroundSize = "cover";
    atmosphere.style.backgroundPosition = "center";
  }

  // Reveals sections as they scroll into view. Purely additive — CSS
  // already collapses the transition to near-zero under
  // prefers-reduced-motion, so this stays correct either way.
  function initScrollReveal() {
    var targets = document.querySelectorAll("[data-reveal]");
    if (!("IntersectionObserver" in window) || !targets.length) {
      targets.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
    );
    targets.forEach(function (el) { observer.observe(el); });
  }

  // =====================================================================
  // Signature Entry — reusable opening-sequence component. Renders a
  // paced sequence of scenes defined entirely by configuration; this
  // function contains no business-specific text, colors, or copy of any
  // kind. See signature-entry-adapter.js for where today's
  // configuration actually comes from (a temporary, isolated adapter,
  // pending migration into experience_sections) — this function only
  // ever calls window.BigSkySignatureEntryAdapter.getConfig(record) and
  // has no knowledge of what is behind that call. An experience with no
  // configuration (the default for every client, including every future
  // one, until a Signature Entry is explicitly set up for it) is a
  // complete, silent no-op — next() fires immediately, no flash, no
  // placeholder, no broken state, the same guarantee the video-based
  // reserved slot this replaces used to make.
  // =====================================================================
  // Module-level (not per-invocation) so a retry can always find and
  // cancel a prior attempt's pending scene timers before starting fresh
  // — see clearSignatureEntryTimers() and startExperienceLoad().
  var signatureEntryTimers = [];
  var signatureEntryCtaHandler = null;
  var signatureEntrySkipHandler = null;

  function clearSignatureEntryTimers() {
    signatureEntryTimers.forEach(function (t) { window.clearTimeout(t); });
    signatureEntryTimers = [];
  }

  function initSignatureEntry(record, next) {
    var config = (window.BigSkySignatureEntryAdapter &&
      window.BigSkySignatureEntryAdapter.getConfig(record)) || { enabled: false };

    if (!config.enabled || !config.scenes || !config.scenes.length) {
      next();
      return;
    }

    var el = els.signatureEntry;
    var textEl = els.signatureEntryText;
    var ctaEl = els.signatureEntryCta;
    var skipEl = els.signatureEntrySkip;

    // Markup missing for some reason — never trap the visitor waiting
    // on elements that don't exist.
    if (!el || !textEl || !ctaEl) {
      next();
      return;
    }

    // Defensive cleanup: cancel any timers left over from a prior
    // invocation (e.g. a retry after a failure that happened after
    // this function had already started running once).
    clearSignatureEntryTimers();

    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var scenes = config.scenes.slice().sort(function (a, b) {
      return (a.order || 0) - (b.order || 0);
    });
    var settled = false;

    // Full skip — used by the safety timeout and, in a future version,
    // could be wired to a "skip everything" action. Today only the
    // safety net calls this directly; the skip button calls showCta()
    // instead, so the CTA tap itself is never bypassed (see below).
    function finish() {
      if (settled) return;
      settled = true;
      clearSignatureEntryTimers();
      next(); // the caller's showState("experience") now also hides this element — see showState()
    }

    function showCta() {
      clearSignatureEntryTimers();
      textEl.hidden = true;
      if (skipEl) skipEl.hidden = true;
      ctaEl.textContent = (config.cta && config.cta.label) || "Continue";
      ctaEl.hidden = false;
      ctaEl.classList.remove("exp-signature-entry-cta-rise", "exp-signature-entry-cta-open");
      void ctaEl.offsetWidth; // reflow so the reveal animation reliably plays
      ctaEl.classList.add("exp-signature-entry-cta-rise");

      // Staged second beat: the horizon line opens beneath the words
      // once they've settled, not simultaneously — the invitation is
      // spoken first, then the way opens. Reduced-motion aware, same
      // treatment as every other timed beat in this sequence.
      var lineDelayMs = reducedMotion ? 0 : 900;
      signatureEntryTimers.push(window.setTimeout(function () {
        ctaEl.classList.add("exp-signature-entry-cta-open");
      }, lineDelayMs));
    }

    function playScene(index) {
      if (index >= scenes.length) {
        // A beat of true silence — nothing visible at all — before the
        // CTA rises. This is staging, not a delay: the pause is what
        // makes the button feel like an invitation arriving rather than
        // a UI element simply appearing. Skipped under reduced motion,
        // same treatment as the scene exit transitions — this is
        // decorative pacing, not reading time. The skip button
        // deliberately bypasses this entirely (calls showCta directly)
        // since skipping is the visitor explicitly asking to move
        // faster — respecting that choice matters more here than
        // preserving the staging for its own sake.
        var silenceMs = reducedMotion ? 0 : 900;
        signatureEntryTimers.push(window.setTimeout(showCta, silenceMs));
        return;
      }
      var scene = scenes[index];
      textEl.textContent = scene.text || "";
      textEl.hidden = false;
      textEl.classList.remove("exp-focus-in-el", "exp-signature-entry-exit");
      void textEl.offsetWidth; // reflow so the animation replays for every scene
      textEl.classList.add("exp-focus-in-el");

      var holdMs = scene.holdMs || 2500; // reading time — unaffected by reduced motion
      var exitMs = reducedMotion ? 0 : (scene.exitMs || 500);

      signatureEntryTimers.push(window.setTimeout(function () {
        textEl.classList.add("exp-signature-entry-exit");
        signatureEntryTimers.push(window.setTimeout(function () {
          playScene(index + 1);
        }, exitMs));
      }, holdMs));
    }

    // Deduplication: remove any handler attached by a prior invocation
    // before attaching a new one, so retry can never stack a second
    // click listener on top of a first.
    if (signatureEntryCtaHandler) {
      ctaEl.removeEventListener("click", signatureEntryCtaHandler);
    }
    signatureEntryCtaHandler = function () {
      var action = (config.cta && config.cta.action) || "reveal-experience";
      // Only one action exists in V1. Anything else fails safe by
      // proceeding anyway, rather than leaving the visitor stuck on a
      // button that does nothing.
      finish();
      void action;
    };
    ctaEl.addEventListener("click", signatureEntryCtaHandler);

    if (skipEl && signatureEntrySkipHandler) {
      skipEl.removeEventListener("click", signatureEntrySkipHandler);
      signatureEntrySkipHandler = null;
    }
    if (skipEl && (!config.skip || config.skip.allowSkip !== false)) {
      var skipAfterMs = (config.skip && config.skip.skipAfterMs) || 1500;
      signatureEntryTimers.push(window.setTimeout(function () {
        skipEl.hidden = false;
      }, skipAfterMs));
      signatureEntrySkipHandler = showCta; // stops pacing, jumps to the CTA — never bypasses the tap itself
      skipEl.addEventListener("click", signatureEntrySkipHandler);
    }

    // Safety net: never let a stalled or misconfigured sequence trap the
    // visitor. Mirrors the original video intro's 8-second timeout,
    // scaled up since this sequence is intentionally longer. Note this
    // only protects the scene sequence itself — the primary experience
    // fetch has its own, much shorter timeout (see LOAD_TIMEOUT_MS).
    signatureEntryTimers.push(window.setTimeout(finish, config.safetyTimeoutMs || 25000));

    // THE FIX: this must go through showState(), not a direct el.hidden
    // assignment. #exp-signature-entry now lives as a sibling of
    // #experience (see index.html), but showState() is still the single
    // place that decides which top-level state is visible — calling it
    // here, instead of just unhiding this element directly, is what
    // actually makes Signature Entry appear instead of staying invisible
    // behind whatever state was active before.
    showState("signatureentry");
    playScene(0);
  }

  // =====================================================================
  // Act II — "The Turn". Reusable Experience Engine component: a paced,
  // staged reveal (reuses the exact scene mechanism from Signature
  // Entry — same shape, same motion device, same reduced-motion
  // handling), followed by a staggered set of promise cards the visitor
  // taps to select. Contains no business-specific text of its own —
  // content comes entirely from window.BigSkyTheTurnAdapter.getConfig().
  // See the-turn-adapter.js for today's temporary configuration source.
  //
  // next(selectedCardId) — selectedCardId is the tapped card's id, or
  // null if the visitor used the Continue fallback, or null if Act II
  // isn't configured at all. Carried forward for a future Act III to
  // read; not persisted anywhere, since nothing about this journey
  // reloads the page between acts.
  // =====================================================================
  var theTurnTimers = [];
  var theTurnActiveFinish = null; // set only while an Act II sequence is actually running

  function clearTheTurnTimers() {
    theTurnTimers.forEach(function (t) { window.clearTimeout(t); });
    theTurnTimers = [];
  }

  function initTheTurn(record, next) {
    var config = (window.BigSkyTheTurnAdapter &&
      window.BigSkyTheTurnAdapter.getConfig(record)) || { enabled: false };

    if (!config.enabled || !config.scenes || !config.scenes.length) {
      next(null);
      return;
    }

    var el = els.theTurn;
    var textEl = els.theTurnText;
    var cardsEl = els.theTurnCards;
    var continueEl = els.theTurnContinue;

    if (!el || !textEl || !cardsEl) {
      next(null);
      return;
    }

    clearTheTurnTimers();

    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var scenes = config.scenes.slice();
    var settled = false;

    function finish(selectedCardId) {
      if (settled) return;
      settled = true;
      clearTheTurnTimers();
      theTurnActiveFinish = null;
      next(selectedCardId || null);
    }

    function playScene(index) {
      if (index >= scenes.length) {
        showCards();
        return;
      }
      var scene = scenes[index];
      textEl.textContent = scene.text || "";
      textEl.hidden = false;
      textEl.classList.remove("exp-focus-in-el", "exp-signature-entry-exit");
      void textEl.offsetWidth;
      textEl.classList.add("exp-focus-in-el");

      var holdMs = scene.holdMs || 2500;
      var exitMs = reducedMotion ? 0 : (scene.exitMs || 500);

      theTurnTimers.push(window.setTimeout(function () {
        textEl.classList.add("exp-signature-entry-exit");
        theTurnTimers.push(window.setTimeout(function () {
          playScene(index + 1);
        }, exitMs));
      }, holdMs));
    }

    // Cards are built fresh every call and torn down via innerHTML — no
    // listener-deduplication logic needed here the way Signature
    // Entry's static CTA button required, since old buttons (and their
    // listeners) are simply discarded with the DOM nodes that held them.
    function showCards() {
      textEl.hidden = true;
      cardsEl.innerHTML = "";
      cardsEl.hidden = false;

      (config.cards || []).forEach(function (card, i) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "exp-the-turn-card";
        btn.textContent = card.text || "";
        btn.addEventListener("click", function () { finish(card.id || null); });
        cardsEl.appendChild(btn);

        var delay = reducedMotion ? 0 : i * 120; // staggered, not simultaneous
        theTurnTimers.push(window.setTimeout(function () {
          btn.classList.add("exp-focus-in-el");
        }, delay));
      });

      if (continueEl && config.continueFallback) {
        continueEl.hidden = true;
        var appearAfterMs = reducedMotion ? 0 : (config.continueFallback.appearAfterMs || 4000);
        theTurnTimers.push(window.setTimeout(function () {
          continueEl.hidden = false;
        }, appearAfterMs));
      }
    }

    theTurnActiveFinish = finish;
    showState("theturn");
    playScene(0);
  }

  // Attached once, ever — same lesson as Signature Entry's CTA/skip
  // listeners: this is a static, reused button, so it must never be
  // re-attached on every initTheTurn() call.
  if (els.theTurnContinue) {
    els.theTurnContinue.addEventListener("click", function () {
      if (theTurnActiveFinish) theTurnActiveFinish(null);
    });
  }

  // =====================================================================
  // Act III — "The Vision". Reusable Experience Engine component: a
  // paced direct-address (same scene mechanism as Acts I-II), then two
  // sequential inputs — business name, then the promise question —
  // each with a skip affordance, ending in a combined reveal.
  //
  // CRITICAL BOUNDARY: this component has zero knowledge of how
  // interpretation works. It calls
  // window.BigSkyIdentityEngine.interpretPromise(promiseText, {}) and
  // only ever reads the returned signatureId — never how it was
  // produced, never confidence thresholds, never keyword lists. That
  // separation is the whole point: identity-engine.js can change its
  // entire internal implementation and this function never needs to.
  //
  // The visitor never sees signatureId, confidence, or any label —
  // per "Recognition Over Personalization" and "Technology Remains
  // Invisible" (01), interpretation only ever shows up later as tone,
  // not as a visible result here.
  //
  // next({ businessName, promiseText, signatureId }) — any field may be
  // null if skipped or not configured. Carried forward for Act IV to
  // read; nothing persisted, nothing reloaded.
  // =====================================================================
  var theVisionTimers = [];
  var theVisionActiveNameSubmit = null;
  var theVisionActiveNameSkip = null;
  var theVisionActivePromiseSubmit = null;
  var theVisionActivePromiseSkip = null;

  function clearTheVisionTimers() {
    theVisionTimers.forEach(function (t) { window.clearTimeout(t); });
    theVisionTimers = [];
  }

  function initTheVision(record, next) {
    var config = (window.BigSkyTheVisionAdapter &&
      window.BigSkyTheVisionAdapter.getConfig(record)) || { enabled: false };

    if (!config.enabled) {
      next({ businessName: null, promiseText: null, signatureId: null });
      return;
    }

    var el = els.theVision;
    var textEl = els.theVisionText;
    var nameStepEl = els.theVisionNameStep;
    var nameInputEl = els.theVisionNameInput;
    var nameSkipEl = els.theVisionNameSkip;
    var promiseStepEl = els.theVisionPromiseStep;
    var promiseInputEl = els.theVisionPromiseInput;
    var promiseSkipEl = els.theVisionPromiseSkip;
    var revealEl = els.theVisionReveal;
    var revealNameEl = els.theVisionRevealName;
    var revealPromiseEl = els.theVisionRevealPromise;

    if (!el || !textEl || !nameStepEl || !promiseStepEl) {
      next({ businessName: null, promiseText: null, signatureId: null });
      return;
    }

    clearTheVisionTimers();
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var scenes = (config.scenes || []).slice();
    var settled = false;
    var businessName = null;
    var promiseText = null;

    function finish(signatureId) {
      if (settled) return;
      settled = true;
      clearTheVisionTimers();
      theVisionActiveNameSubmit = null;
      theVisionActiveNameSkip = null;
      theVisionActivePromiseSubmit = null;
      theVisionActivePromiseSkip = null;
      next({ businessName: businessName, promiseText: promiseText, signatureId: signatureId || null });
    }

    function playScene(index) {
      if (index >= scenes.length) {
        showNameStep();
        return;
      }
      var scene = scenes[index];
      textEl.textContent = scene.text || "";
      textEl.hidden = false;
      textEl.classList.remove("exp-focus-in-el", "exp-signature-entry-exit");
      void textEl.offsetWidth;
      textEl.classList.add("exp-focus-in-el");

      var holdMs = scene.holdMs || 2500;
      var exitMs = reducedMotion ? 0 : (scene.exitMs || 500);
      theVisionTimers.push(window.setTimeout(function () {
        textEl.classList.add("exp-signature-entry-exit");
        theVisionTimers.push(window.setTimeout(function () { playScene(index + 1); }, exitMs));
      }, holdMs));
    }

    function showNameStep() {
      textEl.hidden = true;
      if (!config.nameStep) { showPromiseStep(); return; }

      nameStepEl.querySelector(".exp-the-vision-prompt").textContent = config.nameStep.prompt || "";
      nameInputEl.placeholder = config.nameStep.placeholder || "";
      nameInputEl.value = "";
      nameStepEl.hidden = false;
      nameInputEl.focus();

      theVisionActiveNameSubmit = function () {
        var val = (nameInputEl.value || "").trim();
        businessName = val || null;
        nameStepEl.hidden = true;
        revealNameThenContinue();
      };
      theVisionActiveNameSkip = function () {
        businessName = null;
        nameStepEl.hidden = true;
        revealNameThenContinue(); // no-ops straight to showPromiseStep() when businessName is null
      };

      if (nameSkipEl && config.nameStep.skip && config.nameStep.skip.allowSkip !== false) {
        nameSkipEl.hidden = true;
        var appearAfter = reducedMotion ? 0 : (config.nameStep.skip.skipAfterMs || 2000);
        theVisionTimers.push(window.setTimeout(function () { nameSkipEl.hidden = false; }, appearAfter));
      }
    }

    // Small ask, fast reward, per the approved architecture — the name
    // reveals in the same hero typography before the bigger ask
    // arrives. Skipped entirely (straight to the promise step) if
    // there's no name to show.
    function revealNameThenContinue() {
      if (!businessName) { showPromiseStep(); return; }
      revealNameEl.textContent = businessName;
      revealNameEl.hidden = false;
      revealNameEl.classList.remove("exp-focus-in-el");
      void revealNameEl.offsetWidth;
      revealNameEl.classList.add("exp-focus-in-el");
      revealEl.hidden = false;
      var holdMs = 1400; // reading time — unaffected by reduced motion, same principle as every scene hold in this file
      theVisionTimers.push(window.setTimeout(showPromiseStep, holdMs));
    }

    function showPromiseStep() {
      if (!config.promiseStep) { finish(null); return; }

      promiseStepEl.querySelector(".exp-the-vision-prompt").textContent = config.promiseStep.prompt || "";
      promiseInputEl.placeholder = config.promiseStep.placeholder || "";
      promiseInputEl.value = "";
      promiseStepEl.hidden = false;
      promiseInputEl.focus();

      theVisionActivePromiseSubmit = function () { submitPromise(); };
      theVisionActivePromiseSkip = function () {
        promiseText = null;
        promiseStepEl.hidden = true;
        finish(null); // no promise text — nothing to interpret, nothing to reveal a second time
      };

      if (promiseSkipEl && config.promiseStep.skip && config.promiseStep.skip.allowSkip !== false) {
        promiseSkipEl.hidden = true;
        var appearAfter = reducedMotion ? 0 : (config.promiseStep.skip.skipAfterMs || 2500);
        theVisionTimers.push(window.setTimeout(function () { promiseSkipEl.hidden = false; }, appearAfter));
      }
    }

    // The one call across this entire component that reaches outside
    // it — and it asks a question, it does not receive an explanation.
    // interpretPromise() is awaited exactly like any other async
    // dependency; a failure here is caught and treated as "no match,"
    // never as a reason to block the journey.
    async function submitPromise() {
      var val = (promiseInputEl.value || "").trim();
      promiseText = val || null;
      promiseStepEl.hidden = true;

      var signatureId = null;
      if (promiseText && window.BigSkyIdentityEngine && window.BigSkyIdentityEngine.interpretPromise) {
        try {
          var interpretation = await window.BigSkyIdentityEngine.interpretPromise(promiseText, {});
          signatureId = (interpretation && interpretation.signatureId) || null;
        } catch (e) {
          console.error("Big Sky Command: interpretPromise failed — proceeding without a signature.", e);
          signatureId = null;
        }
      }

      if (!promiseText) { finish(signatureId); return; }

      revealPromiseEl.textContent = promiseText;
      revealPromiseEl.hidden = false;
      revealPromiseEl.classList.remove("exp-focus-in-el");
      void revealPromiseEl.offsetWidth;
      revealPromiseEl.classList.add("exp-focus-in-el");
      revealEl.hidden = false;
      var holdMs = 1800; // reading time — unaffected by reduced motion, same fix as the name reveal above
      theVisionTimers.push(window.setTimeout(function () { finish(signatureId); }, holdMs));
    }

    showState("thevision");
    if (scenes.length) {
      playScene(0);
    } else {
      showNameStep();
    }
  }

  // Attached once, ever — same lesson as every other reused static
  // element in this file: these inputs and buttons exist once in the
  // DOM regardless of how many times initTheVision() itself runs, so
  // listeners are wired through an indirection (the "active" function
  // references above) rather than re-attached per call.
  if (els.theVisionNameInput) {
    els.theVisionNameInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && theVisionActiveNameSubmit) theVisionActiveNameSubmit();
    });
  }
  if (els.theVisionNameSubmit) {
    els.theVisionNameSubmit.addEventListener("click", function () {
      if (theVisionActiveNameSubmit) theVisionActiveNameSubmit();
    });
  }
  if (els.theVisionNameSkip) {
    els.theVisionNameSkip.addEventListener("click", function () {
      if (theVisionActiveNameSkip) theVisionActiveNameSkip();
    });
  }
  if (els.theVisionPromiseInput) {
    els.theVisionPromiseInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && theVisionActivePromiseSubmit) theVisionActivePromiseSubmit();
    });
  }
  if (els.theVisionPromiseSubmit) {
    els.theVisionPromiseSubmit.addEventListener("click", function () {
      if (theVisionActivePromiseSubmit) theVisionActivePromiseSubmit();
    });
  }
  if (els.theVisionPromiseSkip) {
    els.theVisionPromiseSkip.addEventListener("click", function () {
      if (theVisionActivePromiseSkip) theVisionActivePromiseSkip();
    });
  }

  // =====================================================================
  // Act IV — "The Invitation". For an experience with Act IV
  // configured, this REPLACES the old Hero-onward flow entirely — it
  // becomes the terminal state, not a lead-in to it. For any experience
  // without Act IV configured, next() fires immediately and the chain
  // falls through to showState("experience") exactly as it always has —
  // every other client is completely unaffected.
  //
  // CRITICAL BOUNDARY, same discipline as Act III: this component never
  // performs Identity Signature selection itself. It calls
  // window.BigSkyIdentityEngine.selectExpression(signatureId, toneLines)
  // and only ever reads the returned line — never signatureId, never
  // any classification logic. The tone-line content itself lives in
  // the-invitation-adapter.js, not here.
  // =====================================================================
  var theInvitationTimers = [];
  var theInvitationActiveCtaHandler = null;

  function clearTheInvitationTimers() {
    theInvitationTimers.forEach(function (t) { window.clearTimeout(t); });
    theInvitationTimers = [];
  }

  function initTheInvitation(record, next) {
    var config = (window.BigSkyTheInvitationAdapter &&
      window.BigSkyTheInvitationAdapter.getConfig(record)) || { enabled: false };

    if (!config.enabled) {
      next();
      return;
    }

    var el = els.theInvitation;
    var textEl = els.theInvitationText;
    var promiseRevealEl = els.theInvitationPromiseReveal;
    var ctaBlockEl = els.theInvitationCtaBlock;
    var ctaEl = els.theInvitationCta;
    var ctaSupportEl = els.theInvitationCtaSupport;

    if (!el || !textEl || !ctaBlockEl || !ctaEl) {
      next();
      return;
    }

    clearTheInvitationTimers();
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Carried forward from Act III — read once, at the start, never
    // mutated by this component.
    var businessName = theVisionBusinessName;
    var promiseText = theVisionPromiseText;
    var signatureId = theVisionSignatureId;
    void businessName; // not re-shown in Act IV — only the promise gets a second literal appearance, per docs/14

    function playTextScene(list, index, onDone) {
      if (index >= list.length) { onDone(); return; }
      var scene = list[index];
      textEl.textContent = scene.text || "";
      textEl.hidden = false;
      textEl.classList.remove("exp-focus-in-el", "exp-signature-entry-exit");
      void textEl.offsetWidth;
      textEl.classList.add("exp-focus-in-el");

      var holdMs = scene.holdMs || 2500; // reading time — never affected by reduced motion
      var exitMs = reducedMotion ? 0 : (scene.exitMs || 500);
      theInvitationTimers.push(window.setTimeout(function () {
        textEl.classList.add("exp-signature-entry-exit");
        theInvitationTimers.push(window.setTimeout(function () {
          playTextScene(list, index + 1, onDone);
        }, exitMs));
      }, holdMs));
    }

    function revealPromiseThenTurn() {
      if (!promiseText) {
        playTurnScenes();
        return;
      }
      textEl.hidden = true;
      promiseRevealEl.textContent = promiseText;
      promiseRevealEl.hidden = false;
      promiseRevealEl.classList.remove("exp-focus-in-el");
      void promiseRevealEl.offsetWidth;
      promiseRevealEl.classList.add("exp-focus-in-el");

      var holdMs = 2200; // the highest-weight moment in the whole journey — full length regardless of reduced motion
      theInvitationTimers.push(window.setTimeout(function () {
        promiseRevealEl.hidden = true;
        playTurnScenes();
      }, holdMs));
    }

    function playTurnScenes() {
      var turnScenes = (promiseText && config.turnScenes) ? config.turnScenes.slice() : [];
      playTextScene(turnScenes, 0, playClosingLine);
    }

    function playClosingLine() {
      var closing = promiseText ? config.closingLine : (config.fallbackNoPromise && config.fallbackNoPromise.closingLine);
      if (!closing) { showCtaBlock(); return; }
      playTextScene([closing], 0, showCtaBlock);
    }

    function showCtaBlock() {
      textEl.hidden = true;
      // No tone line spoken here — see the Manifest sequence below,
      // where the Identity Engine boundary is exercised differently
      // (reserved, not called, in this approved version of Act IV).
      ctaEl.textContent = (config.cta && config.cta.label) || "Continue";
      ctaSupportEl.textContent = (config.cta && config.cta.supportingText) || "";

      ctaBlockEl.hidden = false;
      ctaBlockEl.classList.remove("exp-focus-in-el");
      void ctaBlockEl.offsetWidth;
      ctaBlockEl.classList.add("exp-focus-in-el");
    }

    // The deliberate tap — "Let's Build Your Experience" — is the
    // visitor's conscious decision to cross from the Signature
    // Experience into seeing Command. Never auto-advanced into.
    function beginCommandLaunch() {
      ctaBlockEl.hidden = true;

      var curtainEl = els.theInvitationCurtain;
      var markerEl = els.theInvitationCurtainMarker;

      // Toggling `hidden` off is enough to make the curtain play its
      // animation from the start — the same mechanism that already
      // reveals it automatically at the very opening of the experience,
      // just triggered here by a tap instead of by rendering.
      if (curtainEl) curtainEl.hidden = false;
      if (markerEl && config.curtainMarkerText) {
        markerEl.textContent = config.curtainMarkerText;
        markerEl.hidden = false;
      }

      var revealDelay = reducedMotion ? 0 : 700;
      theInvitationTimers.push(window.setTimeout(function () {
        if (markerEl) markerEl.hidden = true;
        if (curtainEl) curtainEl.hidden = true;
        playManifestIntro();
      }, revealDelay));
    }

    function playManifestIntro() {
      var m = config.manifest || {};
      if (!m.introLine) { revealManifestItems(); return; }
      playTextScene([{ text: m.introLine, revealMs: 900, holdMs: m.introHoldMs || 2600, exitMs: 500 }], 0, revealManifestItems);
    }

    // THE MANIFEST — an honest, structured inventory, not a progress
    // bar. Every item's status is literally true the instant it
    // appears; nothing here simulates work happening elsewhere. Items
    // stack one at a time and ALL remain visible — never replaced,
    // never removed, so the visitor watches a real list grow rather
    // than a slideshow advance.
    function revealManifestItems() {
      textEl.hidden = true;
      var manifestEl = els.theInvitationManifest;
      var m = config.manifest || {};
      var items = m.items || [];
      if (!manifestEl || !items.length) { playManifestClosing(); return; }

      manifestEl.innerHTML = "";
      manifestEl.hidden = false;
      var stagger = reducedMotion ? 0 : (m.itemStaggerMs || 380);

      items.forEach(function (item, i) {
        var row = document.createElement("div");
        row.className = "exp-the-invitation-manifest-item";
        var label = document.createElement("span");
        label.className = "exp-the-invitation-manifest-label";
        label.textContent = item.label || "";
        var status = document.createElement("span");
        status.className = "exp-the-invitation-manifest-status";
        status.textContent = item.status || "";
        row.appendChild(label);
        row.appendChild(status);
        manifestEl.appendChild(row);

        theInvitationTimers.push(window.setTimeout(function () {
          row.classList.add("is-visible");
        }, i * stagger));
      });

      var totalStagger = items.length * stagger;
      var settleHold = reducedMotion ? 0 : 900; // let the full list actually be read before moving on
      theInvitationTimers.push(window.setTimeout(playManifestClosing, totalStagger + settleHold));
    }

    function playManifestClosing() {
      var m = config.manifest || {};
      if (!m.closingLine) { renderCommandLaunchPanel(); return; }
      playTextScene([{ text: m.closingLine, revealMs: 900, holdMs: m.closingHoldMs || 2400, exitMs: 500 }], 0, function () {
        textEl.hidden = true;
        renderCommandLaunchPanel();
      });
    }

    // Implements the approved runtime truth table: embeddable calendar
    // -> non-embeddable calendar (styled action) -> lead-capture
    // fallback (never mislabeled as scheduling) -> verified phone
    // fallback (no placeholder email). Reuses isUsable() and
    // injectEmbedHtml(), both already established elsewhere in this
    // file. This is the ONE practical action in the whole sequence —
    // no second CTA appears between the Manifest and this panel.
    function renderCommandLaunchPanel() {
      var panelEl = els.theInvitationPanel;
      var headingEl = els.theInvitationPanelHeading;
      var panelCopyEl = els.theInvitationPanelCopy;
      var calendarEmbedEl = els.theInvitationCalendarEmbed;
      var calendarLinkEl = els.theInvitationCalendarLink;
      var formEmbedEl = els.theInvitationFormEmbed;
      var contactLinkEl = els.theInvitationContactLink;

      var hasCalendar = isUsable(record.calendar_link);
      var hasForm = isUsable(record.ghl_form_embed);

      if (hasCalendar && config.calendarEmbeddable) {
        headingEl.textContent = config.calendarEmbedHeading || "";
        panelCopyEl.textContent = config.calendarEmbedCopy || "";
        var iframe = document.createElement("iframe");
        iframe.src = record.calendar_link;
        iframe.style.width = "100%";
        iframe.style.minHeight = "480px";
        iframe.style.border = "none";
        calendarEmbedEl.innerHTML = "";
        calendarEmbedEl.appendChild(iframe);
        calendarEmbedEl.hidden = false;
      } else if (hasCalendar && !config.calendarEmbeddable) {
        headingEl.textContent = config.calendarLinkHeading || "";
        panelCopyEl.textContent = config.calendarLinkCopy || "";
        calendarLinkEl.href = record.calendar_link;
        calendarLinkEl.textContent = config.calendarLinkButtonLabel || "Open Scheduling";
        calendarLinkEl.hidden = false;
      } else if (hasForm) {
        // Deliberately not called "scheduling" anywhere in this branch
        // — this is a genuine lead-capture fallback, and the copy must
        // stay honest about what it actually does.
        headingEl.textContent = config.formFallbackHeading || "";
        panelCopyEl.textContent = config.formFallbackCopy || "";
        injectEmbedHtml(formEmbedEl, record.ghl_form_embed);
        formEmbedEl.hidden = false;
      } else if (isUsable(config.contactPhone)) {
        // Verified, real destination — a phone number, never a
        // placeholder or invented email.
        headingEl.textContent = config.contactHeading || "";
        panelCopyEl.textContent = config.contactCopy || "";
        contactLinkEl.href = "tel:" + config.contactPhone.replace(/[^0-9+]/g, "");
        contactLinkEl.textContent = config.contactButtonLabel || ("Call " + config.contactPhone);
        contactLinkEl.hidden = false;
      }

      panelEl.hidden = false;
      panelEl.classList.remove("exp-focus-in-el");
      void panelEl.offsetWidth;
      panelEl.classList.add("exp-focus-in-el");

      if (els.theInvitationFooterText) {
        els.theInvitationFooterText.textContent = config.footerSignature || "";
      }
    }

    theInvitationActiveCtaHandler = beginCommandLaunch;

    showState("theinvitation");
    var openingScenes = (promiseText && config.fullCircleScenes) ? config.fullCircleScenes.slice() : [];
    if (openingScenes.length) {
      playTextScene(openingScenes, 0, revealPromiseThenTurn);
    } else {
      revealPromiseThenTurn();
    }
  }

  // Attached once, ever — same lesson as every other static element in
  // this file: the CTA button is reused, not recreated, so its listener
  // is wired through an indirection rather than re-attached per call.
  if (els.theInvitationCta) {
    els.theInvitationCta.addEventListener("click", function () {
      if (theInvitationActiveCtaHandler) theInvitationActiveCtaHandler();
    });
  }

  function renderExperience(record) {
    document.title = (record.experience_name || "Big Sky Command™ Experience");

    applyBrandColors(record);
    applyHeroImage(record); // NEW — additive, no-ops without hero_image_url

    // --- Hero: emotional hook only — no identity here on purpose ---
    els.headline.textContent = record.headline || "";

    if (isUsable(record.subheadline)) {
      els.subheadline.textContent = record.subheadline;
      els.subheadline.hidden = false;
    } else {
      els.subheadline.hidden = true;
    }

    // Computed once, reused anywhere copy needs to reference the business
    // by name with a sensible fallback.
    var businessLabel = isUsable(record.business_name) ? record.business_name : "your business";

    // --- Hero identity: quiet, doesn't compete with the mission headline ---
    if (isUsable(record.business_name)) {
      els.eyebrow.textContent = record.business_name;
      els.eyebrow.hidden = false;
    } else {
      els.eyebrow.hidden = true;
    }

    // --- Welcome video: identity already established in the hero, so this
    // section's caption stays static ("A Personal Welcome") rather than
    // repeating the business name a second time. Only the logo (a visual
    // mark, not a repeated name) still comes from data. ---
    if (isUsable(record.logo_url)) {
      els.videoLogo.src = record.logo_url;
      els.videoLogo.alt = record.business_name || "";
      els.videoLogo.hidden = false;
    }

    if (isUsable(record.welcome_video_url)) {
      els.video.src = record.welcome_video_url;
      els.video.hidden = false;
      els.videoPlaceholder.hidden = true;
    } else {
      els.video.hidden = true;
      els.videoPlaceholder.hidden = false;
      els.videoPlaceholderText.textContent = "A personal welcome from " + businessLabel + " is on its way.";
    }

    // --- Lead capture: always shows something ---
    els.cta.textContent = record.call_to_action_text || "Let's Get Started";

    if (isUsable(record.ghl_form_embed)) {
      injectEmbedHtml(els.formEmbed, record.ghl_form_embed);
      els.formEmbed.hidden = false;
      els.formPlaceholder.hidden = true;
    } else {
      els.formEmbed.hidden = true;
      els.formPlaceholder.hidden = false;
    }

    // --- Reserved guidance section: the technology stays invisible.
    // Customers aren't buying AI — they're buying a personally guided
    // experience. This copy describes what the visitor will feel, never
    // what powers it. ---
    els.aiCopy.textContent =
      "Soon, every visitor will be welcomed the moment they arrive, get real " +
      "answers about " + businessLabel + " right when they need them, and " +
      "always know exactly what to do next.";

    // --- Thank you: always shows something ---
    els.thankYou.textContent = isUsable(record.thank_you_message)
      ? record.thank_you_message
      : "Thanks for connecting with " + businessLabel + ". We received your information and will follow up personally.";
  }

  // =====================================================================
  // Experience Sections / Experience Flow — additive. Nothing above this
  // point is changed by any of what follows. Per the Constitution
  // (Experience Philosophy): "the renderer's only responsibility is to
  // render... Experience Flow determines what the customer experiences."
  // That boundary is implemented as a distinct step below
  // (resolveExperienceFlow) sitting between loading section data and
  // drawing it — the renderer itself never inspects visibility_rules or
  // decides whether a section belongs on the page.
  // =====================================================================

  // The seam future Experience Flow logic plugs into. Today this is an
  // identity function — nothing is filtered, reordered, or personalized.
  // `context` is threaded through now, even though nothing populates it
  // meaningfully yet, so a future version can extend what this function
  // *does* without changing what calls it or how. See
  // docs/02_PRODUCT_ARCHITECTURE.md §4 and docs/03_DECISIONS.md
  // (2026-07-20, "Experience Flow established as a distinct
  // architectural seam") for the full reasoning.
  function resolveExperienceFlow(sections, context) {
    return sections;
  }

  // load → order → resolve → render. Fire-and-forget from finishLoad():
  // sections are supplementary to the core journey (hero, video, form,
  // thank-you), not required for it, so this never blocks or delays the
  // existing reveal/timing. An experience with no enabled sections is a
  // valid, designed state — nothing renders, nothing errors, the
  // container stays hidden exactly as it does today for every existing
  // client.
  async function loadAndRenderSections(record) {
    if (!els.dynamicSections || !record || !record.id) return;

    var config = window.BIG_SKY_CONFIG || {};
    var result = await window.BigSkyDataProvider.getEnabledSections(record.id, config);

    // Covers three cases identically and safely: a real error (e.g.
    // DATA_PROVIDER is "json", which doesn't support Sections yet), no
    // data, or an empty array. All three mean "render nothing" — never
    // a broken or error state on the public page.
    if (result.error || !result.data || !result.data.length) return;

    // order: already ordered by display_order ascending — enforced by
    // the getEnabledSections() query itself, not re-sorted here.
    var context = {}; // reserved for future Experience Flow inputs (audience, schedule, personalization signals) — unused today
    var resolved = resolveExperienceFlow(result.data, context);

    renderSections(resolved);
  }

  function renderSections(sections) {
    if (!sections.length) return;
    sections.forEach(function (section) {
      var renderFn = SECTION_RENDERERS[section.section_type] || renderSectionGeneric;
      var el = renderFn(section);
      if (el) els.dynamicSections.appendChild(el);
    });
    els.dynamicSections.hidden = false;
    if (window.matchMedia && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      initScrollReveal(); // safe to call again — only newly-added [data-reveal] targets are unobserved
    } else {
      els.dynamicSections.querySelectorAll("[data-reveal]").forEach(function (el) {
        el.classList.add("is-visible");
      });
    }
  }

  // V1 fallback renderer, shared by every section_type today. Reuses the
  // existing .exp-section / .exp-section-inner shell and existing
  // heading/body classes — no new CSS required. Splitting any one type
  // out to its own renderer later (e.g. gallery as an image grid) is a
  // one-line addition to SECTION_RENDERERS below, not a rewrite of this
  // function or of anything else in the file.
  function renderSectionGeneric(section) {
    var wrapper = document.createElement("section");
    wrapper.className = "exp-section exp-section--dynamic";
    wrapper.setAttribute("data-reveal", "");
    wrapper.dataset.sectionType = section.section_type;
    wrapper.dataset.sectionId = section.id;

    var inner = document.createElement("div");
    inner.className = "exp-section-inner";

    if (isUsable(section.title)) {
      var heading = document.createElement("h2");
      heading.className = "exp-cta-heading"; // reuses existing heading style
      heading.textContent = section.title;
      inner.appendChild(heading);
    }

    if (isUsable(section.body_text)) {
      var body = document.createElement("p");
      body.className = "exp-ai-copy"; // reuses existing body-copy style
      body.textContent = section.body_text;
      inner.appendChild(body);
    }

    wrapper.appendChild(inner);
    return wrapper;
  }

  // Dispatch table, keyed by section_type. Empty today — every V1 type
  // (welcome, introduction, services, gallery, reviews, faq, resources,
  // contact, cta, concierge) falls through to renderSectionGeneric()
  // above via the `|| renderSectionGeneric` default in renderSections().
  // Adding a dedicated renderer for one type later means adding one key
  // here; nothing else in this file changes.
  var SECTION_RENDERERS = {};

  // NEW — additive. Extracts a scan code from "/scan/{code}". Only
  // consulted when neither an /e/{id} nor an /experience/{slug} was
  // found — this route resolves and redirects, it never renders the
  // Experience Engine template itself.
  function getScanCodeFromUrl() {
    var path = window.location.pathname;
    var match = path.match(/\/scan\/([^/]+)\/?$/i);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
    return null;
  }

  // A lightweight, non-identifying session marker — generated per
  // browser tab, kept only in memory (not a cookie, not localStorage).
  // Used alongside the server-side IP hash, per the approved IP-handling
  // requirements ("continue using a session identifier... since the IP
  // hash should not be treated as a perfect unique-person identifier").
  var scanSessionId = null;
  function getScanSessionId() {
    if (!scanSessionId) {
      scanSessionId = "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
    }
    return scanSessionId;
  }

  async function resolveAndRedirectScan(scanCode, config) {
    var result = await window.BigSkyDataProvider.resolveScan(
      scanCode,
      navigator.userAgent,
      document.referrer,
      getScanSessionId(),
      config
    );

    if (result.error || !result.data || !result.data.found || !result.data.active) {
      showState("notfound");
      return;
    }

    var destination = result.data;

    if (destination.destination_type === "url" && destination.destination_url) {
      window.location.replace(destination.destination_url);
      return;
    }

    if (destination.destination_type === "experience" && destination.destination_experience_id) {
      var expResult = await window.BigSkyDataProvider.getExperienceByRecordId(
        destination.destination_experience_id,
        config
      );
      if (expResult.error || !expResult.data) {
        showState("notfound");
        return;
      }
      window.location.replace("/e/" + encodeURIComponent(expResult.data.experience_id));
      return;
    }

    // Destination type not recognized by this version of the engine
    // (e.g. a future type not yet supported here) — fail safe.
    showState("notfound");
  }


  async function loadExperience(attempt) {
    var config = window.BIG_SKY_CONFIG || {};

    // Primary, original route — checked first, exactly as before.
    // Timeout-wrapped: a hung request now rejects after LOAD_TIMEOUT_MS
    // instead of waiting indefinitely — see withTimeout() and
    // startExperienceLoad() for how that rejection resolves into the
    // loadfailed state.
    var experienceId = getExperienceIdFromUrl();
    if (experienceId) {
      var idResult = await withTimeout(
        window.BigSkyDataProvider.getExperience(experienceId, config),
        LOAD_TIMEOUT_MS,
        "getExperience"
      );
      return finishLoad(idResult, attempt);
    }

    // Additive. Only reached if no /e/{id} or ?e= was present.
    var slug = getExperienceSlugFromUrl();
    if (slug) {
      var slugResult = await withTimeout(
        window.BigSkyDataProvider.getExperienceBySlug(slug, config),
        LOAD_TIMEOUT_MS,
        "getExperienceBySlug"
      );
      return finishLoad(slugResult, attempt);
    }

    // Additive. Only reached if neither of the above matched. Resolves
    // and redirects; never renders the template itself. Deliberately NOT
    // timeout-wrapped — this is the QR scan-resolution path, explicitly
    // out of scope for this reliability fix.
    var scanCode = getScanCodeFromUrl();
    if (scanCode) {
      return resolveAndRedirectScan(scanCode, config);
    }

    showState("notfound");
  }

  function finishLoad(result, attempt) {
    // Stale-result guard: if a newer attempt (a Retry) has started since
    // this one began, discard this result rather than let a late-arriving
    // response overwrite whatever the newer attempt has already shown.
    // Promise.race's own semantics already make this unlikely in
    // practice (see withTimeout — a losing promise's eventual settlement
    // is a no-op inside the race itself), but that safety is implicit;
    // this makes it an explicit guarantee that doesn't depend on
    // Promise.race internals staying exactly as they are today.
    if (attempt !== currentLoadAttempt) return;

    var data = result.data, error = result.error;

    // IMPORTANT: result.error here is NEVER a "confirmed missing record"
    // signal for getExperience()/getExperienceBySlug() — verified by
    // reading both methods directly in data-provider.js. error is
    // populated only for real problems (Supabase not configured, slug
    // routing attempted outside Supabase mode, or a genuine Postgrest-
    // level error from .maybeSingle(), e.g. more than one row matching).
    // A confirmed zero-row result comes back as { data: null, error:
    // null } — that's the separate !data branch below, unchanged.
    if (error) {
      console.error("Big Sky Command: experience lookup returned an error.", error);
      showState("loadfailed");
      return;
    }

    if (!data) {
      showState("notfound");
      return;
    }

    renderExperience(data);
    loadAndRenderSections(data); // additive, fire-and-forget — see comment above the function itself
    initSignatureEntry(data, function () {
      if (attempt !== currentLoadAttempt) return; // same stale-result guard, for the async completion callback
      initTheTurn(data, function (selectedCardId) {
        if (attempt !== currentLoadAttempt) return; // same guard, applied at every async handoff between acts
        theTurnSelectedCardId = selectedCardId; // module-level — carried forward, Act III doesn't currently read it (see note below)
        initTheVision(data, function (visionResult) {
          if (attempt !== currentLoadAttempt) return;
          theVisionBusinessName = visionResult.businessName;
          theVisionPromiseText = visionResult.promiseText;
          theVisionSignatureId = visionResult.signatureId; // ready for Act IV to read; never rendered anywhere in Act III itself
          initTheInvitation(data, function () {
            // Only reached when Act IV is NOT configured — the
            // unchanged fallthrough every other client already gets.
            // When Act IV IS configured, it becomes the terminal state
            // itself and this callback is never invoked.
            if (attempt !== currentLoadAttempt) return;
            showState("experience");
            initScrollReveal();
          });
        });
      });
    });
  }

  // =====================================================================
  // Top-level load boundary. This is the ONE place a failure anywhere in
  // the load path — a timed-out fetch, a rejected request, or an
  // unexpected exception during rendering — resolves into a visible
  // state instead of leaving the "Loading your experience…" spinner
  // active indefinitely. Called on initial page load and again by the
  // "Try Again" button; both cases run through the exact same guard and
  // cleanup logic, so retry can never leave the page in a worse state
  // than a fresh load would.
  // =====================================================================
  var loadInProgress = false;
  var currentLoadAttempt = 0; // incremented per attempt; see the stale-result guard in finishLoad()
  var theTurnSelectedCardId = null; // set by Act II, ready for Act III to read; no persistence — nothing here reloads the page
  var theVisionBusinessName = null; // set by Act III
  var theVisionPromiseText = null; // set by Act III — the literal text, first of exactly two locked appearances (see docs/14)
  var theVisionSignatureId = null; // set by Act III via identity-engine.js — never rendered in Act III itself, only as tone later

  async function startExperienceLoad() {
    if (loadInProgress) return; // ignores rapid repeated Retry clicks
    loadInProgress = true;
    var attempt = ++currentLoadAttempt;
    clearSignatureEntryTimers(); // defensive — cancels anything left over from a prior attempt
    clearTheTurnTimers(); // same defensive cleanup, for Act II
    clearTheVisionTimers(); // same defensive cleanup, for Act III
    clearTheInvitationTimers(); // same defensive cleanup, for Act IV
    showState("loading");
    try {
      await loadExperience(attempt);
    } catch (err) {
      if (attempt === currentLoadAttempt) {
        // Technical detail stays here, in the console, for debugging —
        // never surfaced to the visitor. See #state-loadfailed for what
        // they actually see.
        console.error("Big Sky Command: experience failed to load.", err);
        showState("loadfailed");
      }
    } finally {
      loadInProgress = false;
    }
  }

  if (els.loadFailedRetry) {
    els.loadFailedRetry.addEventListener("click", function () {
      startExperienceLoad();
    });
  }
  // els.loadFailedReturn is a plain <a href>, not a button — the browser
  // handles that navigation natively, no listener needed.

  document.addEventListener("DOMContentLoaded", function () {
    startExperienceLoad();
  });
})();
