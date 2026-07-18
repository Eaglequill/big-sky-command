// Big Sky Command™ — Experience Manager
// manager.js
//
// Like the public Experience Engine, this file never talks to Supabase
// directly — every read, write, auth check, and upload goes through
// window.BigSkyDataProvider, the same abstraction app.js uses. If the
// underlying infrastructure ever changes, this file does not.

(function () {
  "use strict";

  var DP = window.BigSkyDataProvider;
  var CONFIG = window.BIG_SKY_CONFIG || {};

  var STEPS = ["basics", "branding", "content", "leadcapture"];

  var state = {
    mode: "create",     // "create" | "edit"
    editingId: null,    // uuid of the record being edited
    currentStep: 0,
    heroImageUrl: null,
    welcomeVideoUrl: null,
    experiences: []
  };

  // -----------------------------------------------------------------
  // Small helpers
  // -----------------------------------------------------------------

  function $(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    } catch (e) {
      return iso;
    }
  }

  function friendlyError(error) {
    if (!error) return "Something went wrong. Please try again.";
    return error.message || String(error);
  }

  function show(el) { el.hidden = false; }
  function hide(el) { el.hidden = true; }

  // -----------------------------------------------------------------
  // Screen switching: authcheck → login → shell
  // -----------------------------------------------------------------

  function showAuthCheck() {
    show($("mgr-authcheck"));
    hide($("mgr-login"));
    hide($("mgr-shell"));
  }

  function showLogin() {
    hide($("mgr-authcheck"));
    show($("mgr-login"));
    hide($("mgr-shell"));
  }

  function showShell(session) {
    hide($("mgr-authcheck"));
    hide($("mgr-login"));
    show($("mgr-shell"));
    $("mgr-user-email").textContent = (session && session.user && session.user.email) || "";
    showDashboardView();
    loadDashboard();
  }

  function showFatal(message) {
    var el = $("mgr-authcheck");
    el.innerHTML = "";
    var p = document.createElement("p");
    p.textContent = message;
    el.appendChild(p);
    show(el);
    hide($("mgr-login"));
    hide($("mgr-shell"));
  }

  // -----------------------------------------------------------------
  // Init / auth
  // -----------------------------------------------------------------

  async function init() {
    showAuthCheck();

    if (CONFIG.DATA_PROVIDER !== "supabase") {
      showFatal("The Experience Manager requires DATA_PROVIDER: \"supabase\" in config.js.");
      return;
    }

    var result = await DP.getSession(CONFIG);
    if (result.error) {
      showFatal(friendlyError(result.error));
      return;
    }

    var session = result.data && result.data.session;
    if (session) {
      showShell(session);
    } else {
      showLogin();
    }

    DP.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_OUT") {
        showLogin();
      }
      // Deliberately not handling "SIGNED_IN" here — the login form's
      // submit handler and the getSession() check above already call
      // showShell() for the two cases that matter (fresh sign-in, and
      // page load with an existing session). Also reacting to SIGNED_IN
      // here caused loadDashboard() to run twice concurrently, producing
      // duplicate rows and a loading spinner that never cleared.
    }, CONFIG);
  }

  $("mgr-login-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var errorEl = $("mgr-login-error");
    hide(errorEl);

    var email = $("mgr-login-email").value.trim();
    var password = $("mgr-login-password").value;
    var submitBtn = $("mgr-login-submit");

    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in…";

    var result = await DP.signIn(email, password, CONFIG);

    submitBtn.disabled = false;
    submitBtn.textContent = "Sign in";

    if (result.error) {
      errorEl.textContent = friendlyError(result.error);
      show(errorEl);
      return;
    }

    showShell(result.data.session);
  });

  $("mgr-signout").addEventListener("click", async function () {
    await DP.signOut(CONFIG);
    showLogin();
  });

  // -----------------------------------------------------------------
  // View switching within the shell: dashboard ↔ form
  // -----------------------------------------------------------------

  function showDashboardView() {
    show($("mgr-view-dashboard"));
    hide($("mgr-view-form"));
  }

  function showFormView(title) {
    $("mgr-form-title").textContent = title;
    hide($("mgr-view-dashboard"));
    show($("mgr-view-form"));
  }

  $("mgr-back-btn").addEventListener("click", function () {
    showDashboardView();
  });

  // -----------------------------------------------------------------
  // Dashboard
  // -----------------------------------------------------------------

  var dashboardLoadInFlight = false;

  async function loadDashboard() {
    if (dashboardLoadInFlight) return;
    dashboardLoadInFlight = true;

    var errorEl = $("mgr-dashboard-error");
    var loadingEl = $("mgr-dashboard-loading");
    var emptyEl = $("mgr-dashboard-empty");
    var tableWrap = $("mgr-table-wrap");
    var tbody = $("mgr-table-body");

    hide(errorEl);
    hide(emptyEl);
    hide(tableWrap);
    show(loadingEl);
    tbody.innerHTML = "";

    var result = await DP.listExperiences(CONFIG);
    hide(loadingEl);
    dashboardLoadInFlight = false;

    if (result.error) {
      errorEl.textContent = friendlyError(result.error);
      show(errorEl);
      return;
    }

    state.experiences = result.data || [];

    if (state.experiences.length === 0) {
      show(emptyEl);
      return;
    }

    state.experiences.forEach(function (record) {
      tbody.appendChild(renderRow(record));
    });
    show(tableWrap);
  }

  function renderRow(record) {
    var tr = document.createElement("tr");
    var isActive = record.status === "active";

    tr.innerHTML =
      "<td>" + escapeHtml(record.business_name || "—") + "</td>" +
      "<td>" + escapeHtml(record.experience_name || "—") + "</td>" +
      "<td>" + escapeHtml(record.experience_id) + "</td>" +
      "<td>" + (record.slug ? escapeHtml(record.slug) : "—") + "</td>" +
      "<td><span class=\"mgr-badge " + (isActive ? "mgr-badge-active" : "mgr-badge-inactive") + "\">" +
        (isActive ? "Published" : "Draft") + "</span></td>" +
      "<td>" + formatDate(record.updated_at) + "</td>" +
      "<td class=\"mgr-row-actions\"></td>";

    var actionsCell = tr.querySelector(".mgr-row-actions");

    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "mgr-btn mgr-btn-ghost mgr-btn-small";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", function () { openEdit(record); });
    actionsCell.appendChild(editBtn);

    var toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "mgr-btn mgr-btn-ghost mgr-btn-small";
    toggleBtn.textContent = isActive ? "Unpublish" : "Publish";
    toggleBtn.addEventListener("click", function () { togglePublish(record, toggleBtn); });
    actionsCell.appendChild(toggleBtn);

    var qrBtn = document.createElement("button");
    qrBtn.type = "button";
    qrBtn.className = "mgr-btn mgr-btn-ghost mgr-btn-small";
    qrBtn.textContent = "QR";
    qrBtn.addEventListener("click", function () { openQrForExperience(record); });
    actionsCell.appendChild(qrBtn);

    var viewIdLink = document.createElement("a");
    viewIdLink.href = "/e/" + encodeURIComponent(record.experience_id);
    viewIdLink.target = "_blank";
    viewIdLink.rel = "noopener";
    viewIdLink.className = "mgr-btn mgr-btn-ghost mgr-btn-small";
    viewIdLink.textContent = "View";
    actionsCell.appendChild(viewIdLink);

    if (record.slug) {
      var viewSlugLink = document.createElement("a");
      viewSlugLink.href = "/experience/" + encodeURIComponent(record.slug);
      viewSlugLink.target = "_blank";
      viewSlugLink.rel = "noopener";
      viewSlugLink.className = "mgr-btn mgr-btn-ghost mgr-btn-small";
      viewSlugLink.textContent = "View (slug)";
      actionsCell.appendChild(viewSlugLink);
    }

    return tr;
  }

  async function togglePublish(record, btn) {
    btn.disabled = true;
    var newStatus = record.status === "active" ? "inactive" : "active";
    var result = await DP.setPublishStatus(record.id, newStatus, CONFIG);
    btn.disabled = false;

    if (result.error) {
      var errorEl = $("mgr-dashboard-error");
      errorEl.textContent = friendlyError(result.error);
      show(errorEl);
      return;
    }
    loadDashboard();
  }

  $("mgr-new-btn").addEventListener("click", function () {
    openCreate();
  });

  // -----------------------------------------------------------------
  // Wizard: step navigation
  // -----------------------------------------------------------------

  function goToStep(index) {
    state.currentStep = Math.max(0, Math.min(STEPS.length - 1, index));
    updateStepUI();
  }

  function updateStepUI() {
    STEPS.forEach(function (name, i) {
      var tab = document.querySelector('.mgr-step[data-step="' + name + '"]');
      var panel = document.querySelector('.mgr-fieldset[data-step-panel="' + name + '"]');
      var active = i === state.currentStep;
      tab.classList.toggle("is-active", active);
      panel.classList.toggle("is-active", active);
    });
    $("mgr-step-back").disabled = state.currentStep === 0;
    $("mgr-step-next").hidden = state.currentStep === STEPS.length - 1;
  }

  document.querySelectorAll(".mgr-step").forEach(function (tab) {
    tab.addEventListener("click", function () {
      goToStep(STEPS.indexOf(tab.getAttribute("data-step")));
    });
  });

  $("mgr-step-next").addEventListener("click", function () {
    goToStep(state.currentStep + 1);
  });
  $("mgr-step-back").addEventListener("click", function () {
    goToStep(state.currentStep - 1);
  });

  // -----------------------------------------------------------------
  // Create / edit form
  // -----------------------------------------------------------------

  function resetForm() {
    $("mgr-experience-form").reset();
    $("f-primary-color").value = "#1c2b3a";
    $("f-secondary-color").value = "#c99a3e";
    state.heroImageUrl = null;
    state.welcomeVideoUrl = null;

    hide($("hero-preview-wrap"));
    hide($("video-preview-wrap"));
    hide($("hero-progress"));
    hide($("video-progress"));
    $("hero-upload-status").textContent = "";
    $("hero-upload-status").className = "mgr-upload-status";
    $("video-upload-status").textContent = "";
    $("video-upload-status").className = "mgr-upload-status";
    $("f-hero-file").value = "";
    $("f-video-file").value = "";

    hide($("mgr-form-error"));
    hide($("mgr-form-success"));
    show($("mgr-publish-btn"));

    goToStep(0);
  }

  function populateForm(record) {
    $("f-experience-id").value = record.experience_id || "";
    $("f-slug").value = record.slug || "";
    $("f-business-name").value = record.business_name || "";
    $("f-experience-name").value = record.experience_name || "";
    $("f-logo-url").value = record.logo_url || "";
    $("f-primary-color").value = record.primary_color || "#1c2b3a";
    $("f-secondary-color").value = record.secondary_color || "#c99a3e";
    $("f-headline").value = record.headline || "";
    $("f-subheadline").value = record.subheadline || "";
    $("f-cta-text").value = record.call_to_action_text || "";
    $("f-thankyou").value = record.thank_you_message || "";
    $("f-ghl-embed").value = record.ghl_form_embed || "";
    $("f-ai-prompt").value = record.ai_prompt || "";
    $("f-calendar-link").value = record.calendar_link || "";

    state.heroImageUrl = record.hero_image_url || null;
    state.welcomeVideoUrl = record.welcome_video_url || null;

    if (state.heroImageUrl) {
      $("hero-preview-img").src = state.heroImageUrl;
      show($("hero-preview-wrap"));
    } else {
      hide($("hero-preview-wrap"));
    }

    if (state.welcomeVideoUrl) {
      $("video-preview-el").src = state.welcomeVideoUrl;
      show($("video-preview-wrap"));
    } else {
      hide($("video-preview-wrap"));
    }
  }

  function openCreate() {
    state.mode = "create";
    state.editingId = null;
    resetForm();
    showFormView("New experience");
  }

  function openEdit(record) {
    state.mode = "edit";
    state.editingId = record.id;
    resetForm();
    populateForm(record);
    showFormView("Edit experience: " + (record.experience_name || record.experience_id));
  }

  function collectRecordFromForm(status) {
    return {
      experience_id: $("f-experience-id").value.trim(),
      slug: $("f-slug").value.trim() || null,
      business_name: $("f-business-name").value.trim(),
      experience_name: $("f-experience-name").value.trim(),
      status: status,
      headline: $("f-headline").value.trim() || null,
      subheadline: $("f-subheadline").value.trim() || null,
      logo_url: $("f-logo-url").value.trim() || null,
      primary_color: $("f-primary-color").value || null,
      secondary_color: $("f-secondary-color").value || null,
      hero_image_url: state.heroImageUrl,
      welcome_video_url: state.welcomeVideoUrl,
      call_to_action_text: $("f-cta-text").value.trim() || null,
      ghl_form_embed: $("f-ghl-embed").value.trim() || null,
      ai_prompt: $("f-ai-prompt").value.trim() || null,
      calendar_link: $("f-calendar-link").value.trim() || null,
      thank_you_message: $("f-thankyou").value.trim() || null
    };
  }

  function showFormError(message) {
    var el = $("mgr-form-error");
    el.textContent = message;
    show(el);
    hide($("mgr-form-success"));
  }

  function showFormSuccess(message) {
    var el = $("mgr-form-success");
    el.textContent = message;
    show(el);
    hide($("mgr-form-error"));
  }

  async function handleSave(status) {
    hide($("mgr-form-error"));
    hide($("mgr-form-success"));

    var record = collectRecordFromForm(status);

    if (!record.experience_id || !record.business_name || !record.experience_name) {
      showFormError("Experience ID, business name, and experience name are required.");
      goToStep(STEPS.indexOf("basics"));
      return;
    }

    var draftBtn = $("mgr-save-draft");
    var publishBtn = $("mgr-publish-btn");
    draftBtn.disabled = true;
    publishBtn.disabled = true;

    var result;
    if (state.mode === "edit" && state.editingId) {
      result = await DP.updateExperience(state.editingId, record, CONFIG);
    } else {
      result = await DP.createExperience(record, CONFIG);
    }

    draftBtn.disabled = false;
    publishBtn.disabled = false;

    if (result.error) {
      showFormError(friendlyError(result.error));
      return;
    }

    state.mode = "edit";
    state.editingId = result.data.id;

    showFormSuccess(status === "active" ? "Published." : "Saved as draft.");
    loadDashboard();

    if (status === "active") {
      createScanDestinationAfterPublish(result.data);
    }
  }

  $("mgr-save-draft").addEventListener("click", function () { handleSave("inactive"); });
  $("mgr-publish-btn").addEventListener("click", function () { handleSave("active"); });

  // -----------------------------------------------------------------
  // Uploads (hero image, welcome video) — via data-provider, with
  // progress and clear error messaging.
  // -----------------------------------------------------------------

  function currentFolderKey() {
    return $("f-slug").value.trim() || $("f-experience-id").value.trim();
  }

  $("f-hero-file").addEventListener("change", async function (e) {
    var file = e.target.files[0];
    if (!file) return;

    var statusEl = $("hero-upload-status");
    var progressWrap = $("hero-progress");
    var progressBar = $("hero-progress-bar");
    var key = currentFolderKey();

    if (!key) {
      statusEl.textContent = "Enter the Experience ID (step 1) before uploading.";
      statusEl.className = "mgr-upload-status is-error";
      e.target.value = "";
      return;
    }

    statusEl.textContent = "Uploading…";
    statusEl.className = "mgr-upload-status";
    progressBar.style.width = "0%";
    show(progressWrap);

    var result = await DP.uploadHeroImage(key, file, function (pct) {
      progressBar.style.width = pct + "%";
    }, CONFIG);

    hide(progressWrap);

    if (result.error) {
      statusEl.textContent = friendlyError(result.error);
      statusEl.className = "mgr-upload-status is-error";
      return;
    }

    state.heroImageUrl = result.data.url;
    $("hero-preview-img").src = result.data.url;
    show($("hero-preview-wrap"));
    statusEl.textContent = "Uploaded.";
    statusEl.className = "mgr-upload-status is-success";
  });

  $("f-video-file").addEventListener("change", async function (e) {
    var file = e.target.files[0];
    if (!file) return;

    var statusEl = $("video-upload-status");
    var progressWrap = $("video-progress");
    var progressBar = $("video-progress-bar");
    var key = currentFolderKey();

    if (!key) {
      statusEl.textContent = "Enter the Experience ID (step 1) before uploading.";
      statusEl.className = "mgr-upload-status is-error";
      e.target.value = "";
      return;
    }

    statusEl.textContent = "Uploading…";
    statusEl.className = "mgr-upload-status";
    progressBar.style.width = "0%";
    show(progressWrap);

    var result = await DP.uploadWelcomeVideo(key, file, function (pct) {
      progressBar.style.width = pct + "%";
    }, CONFIG);

    hide(progressWrap);

    if (result.error) {
      statusEl.textContent = friendlyError(result.error);
      statusEl.className = "mgr-upload-status is-error";
      return;
    }

    state.welcomeVideoUrl = result.data.url;
    $("video-preview-el").src = result.data.url;
    show($("video-preview-wrap"));
    statusEl.textContent = "Uploaded.";
    statusEl.className = "mgr-upload-status is-success";
  });

  // -----------------------------------------------------------------
  // Big Sky Scan™ — QR modal
  // -----------------------------------------------------------------

  function scanUrlFor(scanCode) {
    return window.location.origin + "/scan/" + encodeURIComponent(scanCode);
  }

  function renderQrModal(scanDestination, experienceLabel) {
    var url = scanUrlFor(scanDestination.scan_code);

    $("mgr-qr-label").textContent = experienceLabel || scanDestination.label || "";
    $("mgr-qr-url").value = url;
    $("mgr-qr-test").href = url;
    $("mgr-qr-copy-status").textContent = "";

    var imageContainer = $("mgr-qr-image");
    imageContainer.innerHTML = "";
    var canvas = document.createElement("canvas");
    imageContainer.appendChild(canvas);

    QRCode.toCanvas(canvas, url, { width: 240, margin: 1 }, function (err) {
      if (err) {
        imageContainer.textContent = "Couldn't generate the QR image.";
        console.error("Big Sky Scan: QR render failed.", err);
      }
    });

    show($("mgr-qr-modal"));
  }

  function closeQrModal() {
    hide($("mgr-qr-modal"));
  }

  $("mgr-qr-close").addEventListener("click", closeQrModal);
  $("mgr-qr-modal").addEventListener("click", function (e) {
    if (e.target === $("mgr-qr-modal")) closeQrModal(); // click outside the card
  });

  $("mgr-qr-download").addEventListener("click", function () {
    var container = $("mgr-qr-image");
    var canvas = container.querySelector("canvas");
    if (!canvas) return; // the canvas we created and passed to QRCode.toCanvas()
    var link = document.createElement("a");
    link.download = "big-sky-scan-qr.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  $("mgr-qr-copy").addEventListener("click", async function () {
    var statusEl = $("mgr-qr-copy-status");
    try {
      await navigator.clipboard.writeText($("mgr-qr-url").value);
      statusEl.textContent = "Copied.";
      statusEl.className = "mgr-upload-status is-success";
    } catch (e) {
      statusEl.textContent = "Couldn't copy automatically — select and copy the URL above.";
      statusEl.className = "mgr-upload-status is-error";
    }
  });

  // Dashboard "QR" button — finds or creates the scan destination for
  // this experience, then shows it. Uses ensureScanDestination so this
  // also works as a safety net for any experience published before
  // this feature existed.
  async function openQrForExperience(record) {
    var result = await DP.ensureScanDestination(record, CONFIG);
    if (result.error) {
      var errorEl = $("mgr-dashboard-error");
      errorEl.textContent = friendlyError(result.error);
      show(errorEl);
      return;
    }
    renderQrModal(result.data, record.experience_name || record.business_name);
  }

  // Called right after a successful Publish (see handleSave) — this is
  // what makes "Publish → Permanent Big Sky Scan™ created automatically"
  // true. Failure here is shown but does not undo the publish — the
  // experience is still correctly published either way; the QR can
  // always be created afterward via the dashboard's QR button.
  async function createScanDestinationAfterPublish(record) {
    var result = await DP.ensureScanDestination(record, CONFIG);
    if (result.error) {
      showFormError(
        "Published, but the permanent QR couldn't be created automatically (" +
        friendlyError(result.error) +
        "). You can create it from the dashboard's QR button."
      );
      return;
    }
    renderQrModal(result.data, record.experience_name || record.business_name);
  }


  // -----------------------------------------------------------------
  // Go
  // -----------------------------------------------------------------

  init();
})();
