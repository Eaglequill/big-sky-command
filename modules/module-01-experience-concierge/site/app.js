// Big Sky Command™ — Experience Engine
// app.js
//
// This file is the ONE reusable engine. It contains no business-specific
// text, colors, images, or embeds. Everything rendered comes from the
// experience record matched by the Experience ID in the URL — this file
// never knows or cares whether that record came from Supabase or a local
// file. See data-provider.js for that decision.
//
// Flow:
//   1. Read the Experience ID from the URL path (/e/{EXPERIENCE_ID}).
//   2. Ask the data provider for an active record with that experience_id.
//   3. Populate the template in index.html with that record's data.
//   4. Play the shared Opening Sequence if one exists (see
//      initIntroSequence below), then reveal the page.
//   5. If no ID is present, or no active record matches, show the
//      fallback message instead.
//
// Journey this template renders, in fixed order (see index.html):
//   Opening Sequence (reserved) → Hero → Welcome Video → Lead Capture →
//   AI Concierge (reserved) → Thank You
// Video and Lead Capture always render — either the real content, or a
// designed placeholder state — so every future client's experience shows
// the full journey from day one, and swapping in real assets later never
// requires touching this file or the markup.

(function () {
  "use strict";

  var els = {
    loading: document.getElementById("state-loading"),
    notFound: document.getElementById("state-notfound"),
    experience: document.getElementById("experience"),

    intro: document.getElementById("exp-intro-sequence"),

    headline: document.getElementById("exp-headline"),
    subheadline: document.getElementById("exp-subheadline"),

    videoLogo: document.getElementById("exp-video-logo"),
    videoCaption: document.getElementById("exp-video-caption"),
    video: document.getElementById("exp-video"),
    videoPlaceholder: document.getElementById("exp-video-placeholder"),
    videoPlaceholderText: document.getElementById("exp-video-placeholder-text"),

    cta: document.getElementById("exp-cta"),
    formEmbed: document.getElementById("exp-form-embed"),
    formPlaceholder: document.getElementById("exp-form-placeholder"),

    aiCopy: document.getElementById("exp-ai-copy"),

    thankYou: document.getElementById("exp-thankyou")
  };

  function showState(name) {
    els.loading.hidden = name !== "loading";
    els.notFound.hidden = name !== "notfound";
    els.experience.hidden = name !== "experience";
  }

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

  // Plays the shared Opening Sequence (the "eagle" intro) if one has been
  // installed, then calls `next()`. If no intro file exists — the case
  // today — this fails silently and calls `next()` immediately, so the
  // visitor never sees a flash, a broken player, or a placeholder. This
  // is engine-level content shared by every client, not something a
  // Business Overlay ever configures.
  function initIntroSequence(next) {
    var video = els.intro;
    if (!video) { next(); return; }

    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var settled = false;
    function proceed() {
      if (settled) return;
      settled = true;
      video.hidden = true;
      video.removeEventListener("click", proceed);
      next();
    }

    // No intro file installed (the current state for every client until
    // real footage exists) — this fires almost immediately and we move on.
    video.addEventListener("error", proceed);

    if (reducedMotion) {
      // Real footage, once it exists, is narrative content rather than
      // decorative motion — but skipping it under reduced-motion is the
      // more respectful default until there's a reason to reconsider.
      proceed();
      return;
    }

    video.addEventListener("loadeddata", function () {
      video.hidden = false;
      video.play().catch(proceed); // autoplay can be blocked — fail gracefully
    });
    video.addEventListener("ended", proceed);
    video.addEventListener("click", proceed); // tap/click anywhere to skip

    // Safety net: never let a stalled video trap the visitor on a blank
    // screen. If nothing has happened within 8 seconds, move on.
    window.setTimeout(proceed, 8000);
  }

  function renderExperience(record) {
    document.title = (record.experience_name || "Big Sky Command™ Experience");

    applyBrandColors(record);

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

    // --- Welcome video: this is where the business is introduced ---
    if (isUsable(record.logo_url)) {
      els.videoLogo.src = record.logo_url;
      els.videoLogo.alt = record.business_name || "";
      els.videoLogo.hidden = false;
    }

    if (isUsable(record.business_name)) {
      els.videoCaption.textContent = "A word from " + record.business_name;
      els.videoCaption.hidden = false;
    } else {
      els.videoCaption.hidden = true;
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

  async function loadExperience() {
    var experienceId = getExperienceIdFromUrl();

    if (!experienceId) {
      showState("notfound");
      return;
    }

    var config = window.BIG_SKY_CONFIG || {};

    // The Experience Engine does not know or care whether records come
    // from Supabase or a local file — it only asks the data provider.
    // See data-provider.js for where that decision is actually made.
    var { data, error } = await window.BigSkyDataProvider.getExperience(
      experienceId,
      config
    );

    if (error) {
      console.error("Big Sky Command: experience lookup failed.", error);
      showState("notfound");
      return;
    }

    if (!data) {
      showState("notfound");
      return;
    }

    renderExperience(data);
    initIntroSequence(function () {
      showState("experience");
      initScrollReveal();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    showState("loading");
    loadExperience();
  });
})();
