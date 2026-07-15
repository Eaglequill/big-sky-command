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
//   4. If no ID is present, or no active record matches, show the
//      fallback message instead.

(function () {
  "use strict";

  var els = {
    loading: document.getElementById("state-loading"),
    notFound: document.getElementById("state-notfound"),
    experience: document.getElementById("experience"),
    logo: document.getElementById("exp-logo"),
    headline: document.getElementById("exp-headline"),
    subheadline: document.getElementById("exp-subheadline"),
    videoSection: document.getElementById("exp-video-section"),
    video: document.getElementById("exp-video"),
    cta: document.getElementById("exp-cta"),
    formSection: document.getElementById("exp-form-section"),
    formEmbed: document.getElementById("exp-form-embed"),
    thankYouSection: document.getElementById("exp-thankyou-section"),
    thankYou: document.getElementById("exp-thankyou")
  };

  function showState(name) {
    els.loading.hidden = name !== "loading";
    els.notFound.hidden = name !== "notfound";
    els.experience.hidden = name !== "experience";
  }

  // A value counts as "provided" only if it's non-empty and isn't one of
  // our own labeled placeholder strings — so an unfilled placeholder
  // safely hides its section instead of displaying "PLACEHOLDER — ...".
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

  function renderExperience(record) {
    document.title = (record.experience_name || "Big Sky Command™ Experience");

    applyBrandColors(record);

    if (isUsable(record.logo_url)) {
      els.logo.src = record.logo_url;
      els.logo.alt = record.business_name || "";
      els.logo.hidden = false;
    }

    els.headline.textContent = record.headline || "";
    els.subheadline.textContent = record.subheadline || "";

    if (isUsable(record.welcome_video_url)) {
      els.video.src = record.welcome_video_url;
      els.videoSection.hidden = false;
    }

    els.cta.textContent = record.call_to_action_text || "Get Started";
    els.cta.addEventListener("click", function () {
      if (!els.formSection.hidden) {
        els.formSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });

    if (isUsable(record.ghl_form_embed)) {
      injectEmbedHtml(els.formEmbed, record.ghl_form_embed);
      els.formSection.hidden = false;
    }

    if (isUsable(record.thank_you_message)) {
      els.thankYou.textContent = record.thank_you_message;
      els.thankYouSection.hidden = false;
    }

    showState("experience");
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
  }

  document.addEventListener("DOMContentLoaded", function () {
    showState("loading");
    loadExperience();
  });
})();
