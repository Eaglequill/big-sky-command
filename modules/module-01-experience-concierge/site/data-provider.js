// Big Sky Command™ — Experience Engine
// data-provider.js
//
// This is the ONLY file that knows where experience records come from.
// app.js never talks to Supabase or the JSON file directly — it just
// calls window.BigSkyDataProvider.getExperience(id) and gets back
// { data, error }, the same shape either way.
//
// To switch back to Supabase later:
//   1. In config.js, set DATA_PROVIDER: "supabase" and fill in
//      SUPABASE_URL / SUPABASE_ANON_KEY.
//   2. Nothing else changes — not this file, not app.js, not index.html
//      (the Supabase client script tag is already present, it's simply
//      unused while DATA_PROVIDER is "json").
//
// experiences.json is a temporary stand-in for the Supabase "experiences"
// table while Supabase auth is unavailable. Its records use the exact
// same field names as the database schema (01_schema.sql), so switching
// providers never requires reshaping any data or touching renderExperience()
// in app.js.
//
// ---------------------------------------------------------------------
// Experience Manager additions (03_experience_manager.sql)
// ---------------------------------------------------------------------
// Everything below the original getExperience() is new, added for the
// Experience Manager (/manager). None of it changes the public Experience
// Engine's read path. The new surface:
//
//   Auth (Supabase Auth — the Manager's login gate):
//     signIn(email, password, config)
//     signOut(config)
//     getSession(config)
//     onAuthStateChange(callback, config)
//
//   Reads (authenticated only — enforced by RLS, not by this file):
//     getExperienceBySlug(slug, config)      — new /experience/{slug} route
//     getExperienceByRecordId(id, config)    — load one record into the edit form
//     listExperiences(config)                — dashboard
//
//   Writes (authenticated only — enforced by RLS, not by this file):
//     createExperience(record, config)
//     updateExperience(id, patch, config)
//     setPublishStatus(id, status, config)
//
//   Storage (authenticated only — enforced by Storage policies):
//     uploadHeroImage(slug, file, onProgress, config)
//     uploadWelcomeVideo(slug, file, onProgress, config)
//
// All of it is only reachable if DATA_PROVIDER is "supabase" and a real
// SUPABASE_URL/SUPABASE_ANON_KEY are set — same guard the original code
// already used. Under "json" mode, Manager methods return a clear error
// instead of silently failing, since the Manager has nothing meaningful
// to do against a static local file.

window.BigSkyDataProvider = (function () {
  "use strict";

  var jsonCache = null;

  async function getFromJson(experienceId, config) {
    try {
      if (!jsonCache) {
        var url = config.JSON_DATA_URL || "experiences.json";
        var response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
          return { data: null, error: new Error("Could not load " + url) };
        }
        jsonCache = await response.json();
      }

      var record = jsonCache.find(function (row) {
        return row.experience_id === experienceId && row.status === "active";
      });

      return { data: record || null, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  async function getFromSupabase(experienceId, config) {
    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY ||
        /^PLACEHOLDER/i.test(config.SUPABASE_URL)) {
      return {
        data: null,
        error: new Error("Supabase is not configured — check config.js.")
      };
    }

    var client = window.supabase.createClient(
      config.SUPABASE_URL,
      config.SUPABASE_ANON_KEY
    );

    var result = await client
      .from("experiences")
      .select("*")
      .eq("experience_id", experienceId)
      .eq("status", "active")
      .maybeSingle();

    return { data: result.data, error: result.error };
  }

  async function getExperience(experienceId, config) {
    config = config || window.BIG_SKY_CONFIG || {};

    if (config.DATA_PROVIDER === "supabase") {
      return getFromSupabase(experienceId, config);
    }
    // Default to the local JSON file while Supabase is unavailable.
    return getFromJson(experienceId, config);
  }

  // =====================================================================
  // Experience Manager additions below. Nothing above this line changed.
  // =====================================================================

  var UNCONFIGURED_ERROR = new Error(
    "Supabase is not configured — check config.js."
  );
  var JSON_MODE_ERROR = new Error(
    "The Experience Manager requires DATA_PROVIDER: \"supabase\" in config.js. " +
    "It cannot read from or write to the local experiences.json fallback."
  );

  // A single cached client for the new Manager methods only. The original
  // getFromSupabase() above is left exactly as it was — it creates its own
  // client inline and is not touched by this cache.
  var cachedClient = null;
  var cachedClientKey = null;

  function isSupabaseConfigured(config) {
    return !!(config.SUPABASE_URL && config.SUPABASE_ANON_KEY &&
      !/^PLACEHOLDER/i.test(config.SUPABASE_URL));
  }

  function getClient(config) {
    if (!isSupabaseConfigured(config)) return null;
    var key = config.SUPABASE_URL + "|" + config.SUPABASE_ANON_KEY;
    if (cachedClient && cachedClientKey === key) return cachedClient;
    cachedClient = window.supabase.createClient(
      config.SUPABASE_URL,
      config.SUPABASE_ANON_KEY
    );
    cachedClientKey = key;
    return cachedClient;
  }

  function resolveConfig(config) {
    return config || window.BIG_SKY_CONFIG || {};
  }

  function requireSupabaseMode(config) {
    if (config.DATA_PROVIDER !== "supabase") return JSON_MODE_ERROR;
    if (!isSupabaseConfigured(config)) return UNCONFIGURED_ERROR;
    return null;
  }

  // --- Auth ------------------------------------------------------------

  async function signIn(email, password, config) {
    config = resolveConfig(config);
    var guardErr = requireSupabaseMode(config);
    if (guardErr) return { data: null, error: guardErr };

    var client = getClient(config);
    var result = await client.auth.signInWithPassword({ email: email, password: password });
    return { data: result.data, error: result.error };
  }

  async function signOut(config) {
    config = resolveConfig(config);
    var guardErr = requireSupabaseMode(config);
    if (guardErr) return { error: guardErr };

    var client = getClient(config);
    var result = await client.auth.signOut();
    return { error: result.error };
  }

  async function getSession(config) {
    config = resolveConfig(config);
    var guardErr = requireSupabaseMode(config);
    if (guardErr) return { data: { session: null }, error: guardErr };

    var client = getClient(config);
    var result = await client.auth.getSession();
    return { data: result.data, error: result.error };
  }

  // Registers a callback fired whenever the auth state changes (sign in,
  // sign out, token refresh). Returns the subscription so the caller can
  // unsubscribe if needed. Used by the Manager to keep the login gate and
  // dashboard in sync without polling.
  function onAuthStateChange(callback, config) {
    config = resolveConfig(config);
    if (!isSupabaseConfigured(config) || config.DATA_PROVIDER !== "supabase") {
      return { data: { subscription: null } };
    }
    var client = getClient(config);
    return client.auth.onAuthStateChange(function (event, session) {
      callback(event, session);
    });
  }

  // --- Reads (admin) -----------------------------------------------------

  async function getExperienceBySlug(slug, config) {
    config = resolveConfig(config);

    if (config.DATA_PROVIDER !== "supabase") {
      // Slug routing is a Supabase-only feature; the local JSON fallback
      // only ever supported lookup by experience_id.
      return { data: null, error: JSON_MODE_ERROR };
    }
    var guardErr = requireSupabaseMode(config);
    if (guardErr) return { data: null, error: guardErr };

    var client = getClient(config);
    var result = await client
      .from("experiences")
      .select("*")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();

    return { data: result.data, error: result.error };
  }

  async function getExperienceByRecordId(id, config) {
    config = resolveConfig(config);
    var guardErr = requireSupabaseMode(config);
    if (guardErr) return { data: null, error: guardErr };

    var client = getClient(config);
    var result = await client
      .from("experiences")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    return { data: result.data, error: result.error };
  }

  // Every experience, any status, newest-edited first — for the dashboard.
  // Relies on the "Authenticated can read all experiences" RLS policy;
  // if the caller isn't signed in, Supabase simply returns no rows.
  async function listExperiences(config) {
    config = resolveConfig(config);
    var guardErr = requireSupabaseMode(config);
    if (guardErr) return { data: null, error: guardErr };

    var client = getClient(config);
    var result = await client
      .from("experiences")
      .select("*")
      .order("updated_at", { ascending: false });

    return { data: result.data, error: result.error };
  }

  // --- Writes (admin) ------------------------------------------------

  async function createExperience(record, config) {
    config = resolveConfig(config);
    var guardErr = requireSupabaseMode(config);
    if (guardErr) return { data: null, error: guardErr };

    var client = getClient(config);
    var result = await client
      .from("experiences")
      .insert(record)
      .select()
      .single();

    return { data: result.data, error: result.error };
  }

  async function updateExperience(id, patch, config) {
    config = resolveConfig(config);
    var guardErr = requireSupabaseMode(config);
    if (guardErr) return { data: null, error: guardErr };

    var client = getClient(config);
    var result = await client
      .from("experiences")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    return { data: result.data, error: result.error };
  }

  // Thin, explicit wrapper over updateExperience so the Manager UI's
  // publish/unpublish toggle reads as its own action rather than a
  // generic field edit.
  async function setPublishStatus(id, status, config) {
    if (status !== "active" && status !== "inactive") {
      return { data: null, error: new Error("status must be \"active\" or \"inactive\".") };
    }
    return updateExperience(id, { status: status }, config);
  }

  // --- Storage uploads -------------------------------------------------
  //
  // supabase-js's storage.upload() does not expose upload progress, so
  // these use a direct XHR against the Storage REST endpoint (same
  // project, same bucket policies) purely to get progress events for the
  // UI. Auth is the signed-in user's own access token — never a
  // service-role key, and never anything besides what RLS already allows.

  var MAX_HERO_IMAGE_BYTES = 10 * 1024 * 1024;   // 10 MB
  var MAX_VIDEO_BYTES = 100 * 1024 * 1024;       // 100 MB

  function sanitizeFileName(name) {
    return String(name || "file")
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-");
  }

  async function uploadToStorage(pathPrefix, file, maxBytes, sizeLabel, onProgress, config) {
    config = resolveConfig(config);
    var guardErr = requireSupabaseMode(config);
    if (guardErr) return { data: null, error: guardErr };

    if (!file) {
      return { data: null, error: new Error("No file was selected.") };
    }
    if (file.size > maxBytes) {
      return {
        data: null,
        error: new Error(
          "That file is too large. The limit is " + sizeLabel + "."
        )
      };
    }

    var client = getClient(config);
    var sessionResult = await client.auth.getSession();
    var session = sessionResult.data && sessionResult.data.session;
    if (!session) {
      return { data: null, error: new Error("You're signed out. Please sign in again and retry the upload.") };
    }

    var objectPath = pathPrefix + "/" + Date.now() + "-" + sanitizeFileName(file.name);
    var uploadUrl = config.SUPABASE_URL + "/storage/v1/object/experiences/" + objectPath;

    var uploadResult = await new Promise(function (resolve) {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", uploadUrl, true);
      xhr.setRequestHeader("Authorization", "Bearer " + session.access_token);
      xhr.setRequestHeader("apikey", config.SUPABASE_ANON_KEY);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

      xhr.upload.onprogress = function (evt) {
        if (onProgress && evt.lengthComputable) {
          onProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      };

      xhr.onerror = function () {
        resolve({ ok: false, error: new Error("Upload failed — check your connection and try again.") });
      };

      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ ok: true });
        } else {
          var message = "Upload failed (" + xhr.status + ").";
          try {
            var parsed = JSON.parse(xhr.responseText);
            if (parsed && parsed.message) message = parsed.message;
          } catch (e) { /* leave default message */ }
          resolve({ ok: false, error: new Error(message) });
        }
      };

      xhr.send(file);
    });

    if (!uploadResult.ok) {
      return { data: null, error: uploadResult.error };
    }

    var publicUrl = config.SUPABASE_URL + "/storage/v1/object/public/experiences/" + objectPath;
    return { data: { url: publicUrl, path: objectPath }, error: null };
  }

  // folderKey namespaces the uploaded file in Storage. Callers should pass
  // the experience's slug when one is set, and fall back to experience_id
  // when it isn't — slug is optional/nullable on the record, but every
  // experience always has an experience_id, so uploads are never blocked
  // on a field that isn't required.
  async function uploadHeroImage(folderKey, file, onProgress, config) {
    if (!folderKey) return { data: null, error: new Error("Set the Experience ID before uploading a hero image.") };
    return uploadToStorage(folderKey + "/hero", file, MAX_HERO_IMAGE_BYTES, "10 MB", onProgress, config);
  }

  async function uploadWelcomeVideo(folderKey, file, onProgress, config) {
    if (!folderKey) return { data: null, error: new Error("Set the Experience ID before uploading a welcome video.") };
    return uploadToStorage(folderKey + "/video", file, MAX_VIDEO_BYTES, "100 MB", onProgress, config);
  }

  // =====================================================================
  // Big Sky Scan™ additions (04_scan_architecture.sql). Nothing above
  // this line is changed by these additions.
  // =====================================================================

  // Public. Calls the approved resolve_scan() function, which looks up
  // the destination, records the scan event server-side (salted IP
  // hash, never client-computed — see SCAN_ARCHITECTURE.md), and
  // returns only what's needed to redirect. Used by the /scan/{code}
  // route in app.js.
  async function resolveScan(scanCode, userAgent, referrer, sessionId, config) {
    config = resolveConfig(config);
    var guardErr = requireSupabaseMode(config);
    if (guardErr) return { data: null, error: guardErr };

    var client = getClient(config);
    var result = await client.rpc("resolve_scan", {
      p_scan_code: scanCode,
      p_user_agent: userAgent || null,
      p_referrer: referrer || null,
      p_session_id: sessionId || null
    });

    if (result.error) return { data: null, error: result.error };
    // .rpc() on a function returning `table(...)` gives back an array;
    // resolve_scan() always returns exactly one row.
    var row = Array.isArray(result.data) ? result.data[0] : result.data;
    return { data: row || null, error: null };
  }

  function generateScanCode() {
    // 10-character random alphanumeric — short enough for a clean QR
    // and URL, long enough to not be casually guessable. Uniqueness is
    // enforced by the database's unique constraint on scan_code; a
    // collision here would surface as an insert error, vanishingly
    // unlikely at Phase 1 volume.
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
    var out = "";
    for (var i = 0; i < 10; i++) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
  }

  // Admin/Studio only (relies on the authenticated RLS policies on
  // scan_destinations). Looks for an existing scan_destinations row
  // pointed at this experience; creates one if none exists. This is
  // what makes "Publish → Permanent Big Sky Scan™ created
  // automatically" true — called once, right after a successful
  // publish.
  async function ensureScanDestination(experienceRecord, config) {
    config = resolveConfig(config);
    var guardErr = requireSupabaseMode(config);
    if (guardErr) return { data: null, error: guardErr };

    var client = getClient(config);

    var existing = await client
      .from("scan_destinations")
      .select("*")
      .eq("destination_experience_id", experienceRecord.id)
      .eq("destination_type", "experience")
      .limit(1)
      .maybeSingle();

    if (existing.error) return { data: null, error: existing.error };
    if (existing.data) return { data: existing.data, error: null };

    var insertResult = await client
      .from("scan_destinations")
      .insert({
        scan_code: generateScanCode(),
        label: (experienceRecord.experience_name || experienceRecord.experience_id) + " — Primary QR",
        business_name: experienceRecord.business_name || null,
        destination_type: "experience",
        destination_experience_id: experienceRecord.id,
        active: true
      })
      .select()
      .single();

    return { data: insertResult.data, error: insertResult.error };
  }

  // Admin/Studio only. For the dashboard's "View / Test / Download QR"
  // action — looks up the existing scan destination for an experience
  // without creating one (use ensureScanDestination for that).
  async function getScanDestinationForExperience(experienceRecordId, config) {
    config = resolveConfig(config);
    var guardErr = requireSupabaseMode(config);
    if (guardErr) return { data: null, error: guardErr };

    var client = getClient(config);
    var result = await client
      .from("scan_destinations")
      .select("*")
      .eq("destination_experience_id", experienceRecordId)
      .eq("destination_type", "experience")
      .limit(1)
      .maybeSingle();

    return { data: result.data, error: result.error };
  }

  // =====================================================================
  // Experience Sections additions (05_experience_sections.sql). Nothing
  // above this line is changed by these additions. The public renderer
  // (app.js) does not call any of these yet — see PROJECT_HOME.md for
  // the follow-up step that connects them.
  // =====================================================================

  // App-level allowlist for section_type. The database intentionally
  // does NOT CHECK-constrain this column (same reasoning as
  // scan_destinations.destination_type in 04_scan_architecture.sql), so
  // adding a new section type later is a one-line change here, never a
  // migration.
  var ALLOWED_SECTION_TYPES = [
    "welcome", "introduction", "services", "gallery", "reviews",
    "faq", "resources", "contact", "cta", "concierge"
  ];

  function validateSectionType(type) {
    if (ALLOWED_SECTION_TYPES.indexOf(type) === -1) {
      return new Error(
        "Unknown section_type \"" + type + "\". Allowed types: " +
        ALLOWED_SECTION_TYPES.join(", ") + ". (Application-layer check " +
        "only — the database does not enforce a fixed list on purpose, " +
        "so new types can be added here without a migration.)"
      );
    }
    return null;
  }

  // Mirrors the database's own `jsonb_typeof(content) = 'object'` check
  // — catches the mistake client-side before a round trip, without
  // constraining which keys any given section type actually uses.
  function validateSectionContent(content) {
    if (content === undefined || content === null) return null; // defaults to {} at insert
    if (typeof content !== "object" || Array.isArray(content)) {
      return new Error("content must be a plain object (matches the database's jsonb_typeof(content) = 'object' constraint).");
    }
    return null;
  }

  // --- Reads --------------------------------------------------------

  // Public-shaped read: enabled, non-deleted sections only, in display
  // order. This is what the (not-yet-built) renderer update will call.
  // Also safe to call from an authenticated context — the explicit
  // .eq("enabled", true) here means Studio callers get the same
  // "what a visitor would actually see" result regardless of what the
  // broader authenticated RLS policy would otherwise allow through.
  async function getEnabledSections(experienceId, config) {
    config = resolveConfig(config);
    var guardErr = requireSupabaseMode(config);
    if (guardErr) return { data: null, error: guardErr };

    var client = getClient(config);
    var result = await client
      .from("experience_sections")
      .select("*")
      .eq("experience_id", experienceId)
      .eq("enabled", true)
      .is("deleted_at", null)
      .order("display_order", { ascending: true });

    return { data: result.data, error: result.error };
  }

  // Admin/Studio read: every non-deleted section regardless of enabled
  // state, still ordered by display_order — for the edit UI's section
  // list, where disabled sections need to stay visible (and reorderable)
  // to the person editing them.
  async function listSectionsForExperience(experienceId, config) {
    config = resolveConfig(config);
    var guardErr = requireSupabaseMode(config);
    if (guardErr) return { data: null, error: guardErr };

    var client = getClient(config);
    var result = await client
      .from("experience_sections")
      .select("*")
      .eq("experience_id", experienceId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true });

    return { data: result.data, error: result.error };
  }

  async function getSectionById(id, config) {
    config = resolveConfig(config);
    var guardErr = requireSupabaseMode(config);
    if (guardErr) return { data: null, error: guardErr };

    var client = getClient(config);
    var result = await client
      .from("experience_sections")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    return { data: result.data, error: result.error };
  }

  // --- Writes ---------------------------------------------------------

  async function createSection(record, config) {
    config = resolveConfig(config);
    var guardErr = requireSupabaseMode(config);
    if (guardErr) return { data: null, error: guardErr };

    if (!record || !record.experience_id) {
      return { data: null, error: new Error("experience_id is required.") };
    }
    var typeErr = validateSectionType(record.section_type);
    if (typeErr) return { data: null, error: typeErr };
    var contentErr = validateSectionContent(record.content);
    if (contentErr) return { data: null, error: contentErr };

    var client = getClient(config);
    var result = await client
      .from("experience_sections")
      .insert({
        experience_id: record.experience_id,
        section_type: record.section_type,
        title: record.title || null,
        body_text: record.body_text || null,
        content: record.content || {},
        visibility_rules: record.visibility_rules || null,
        enabled: record.enabled !== undefined ? !!record.enabled : true,
        display_order: record.display_order !== undefined ? record.display_order : 0
      })
      .select()
      .single();

    return { data: result.data, error: result.error };
  }

  async function updateSection(id, patch, config) {
    config = resolveConfig(config);
    var guardErr = requireSupabaseMode(config);
    if (guardErr) return { data: null, error: guardErr };

    if (patch && patch.section_type !== undefined) {
      var typeErr = validateSectionType(patch.section_type);
      if (typeErr) return { data: null, error: typeErr };
    }
    if (patch && patch.content !== undefined) {
      var contentErr = validateSectionContent(patch.content);
      if (contentErr) return { data: null, error: contentErr };
    }

    var client = getClient(config);
    var result = await client
      .from("experience_sections")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    return { data: result.data, error: result.error };
  }

  // Thin, explicit wrapper over updateSection so a toggle in the Studio
  // UI reads as its own action — same pattern as setPublishStatus() for
  // experiences.
  async function setSectionEnabled(id, enabled, config) {
    return updateSection(id, { enabled: !!enabled }, config);
  }

  // orderedIds: array of section UUIDs in the desired display order.
  // Writes display_order = array index for each row. Not wrapped in a
  // single DB transaction — supabase-js has no client-side
  // multi-statement transaction primitive — so a failure partway
  // through can leave orders partially updated. Acceptable for Phase 1
  // volume/risk; flagged here for future hardening (e.g. a
  // SECURITY DEFINER RPC that reorders atomically server-side,
  // mirroring resolve_scan()'s pattern) once reordering is a frequent,
  // high-stakes action. The .eq("experience_id", ...) guard on every
  // write prevents a caller from accidentally reordering a section that
  // belongs to a different experience than the one being edited.
  async function reorderSections(experienceId, orderedIds, config) {
    config = resolveConfig(config);
    var guardErr = requireSupabaseMode(config);
    if (guardErr) return { data: null, error: guardErr };
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return { data: null, error: new Error("orderedIds must be a non-empty array of section IDs.") };
    }

    var client = getClient(config);
    var updated = [];
    for (var i = 0; i < orderedIds.length; i++) {
      var result = await client
        .from("experience_sections")
        .update({ display_order: i })
        .eq("id", orderedIds[i])
        .eq("experience_id", experienceId)
        .select()
        .single();
      if (result.error) {
        return {
          data: updated,
          error: new Error(
            "Reorder stopped after " + updated.length + " of " + orderedIds.length +
            " updates — display_order may now be inconsistent. Underlying error: " +
            friendlyErrorMessage(result.error)
          )
        };
      }
      updated.push(result.data);
    }
    return { data: updated, error: null };
  }

  function friendlyErrorMessage(error) {
    return (error && error.message) || String(error);
  }

  // Soft delete only — sets deleted_at, never issues a hard DELETE.
  // Matches this project's existing convention of never hard-deleting
  // rows the public engine or Studio might still reference (experiences
  // use status; scan_destinations use active). Every read method above
  // already excludes rows where deleted_at is set.
  async function softDeleteSection(id, config) {
    return updateSection(id, { deleted_at: new Date().toISOString() }, config);
  }

  return {
    // Original — unchanged
    getExperience: getExperience,

    // Auth
    signIn: signIn,
    signOut: signOut,
    getSession: getSession,
    onAuthStateChange: onAuthStateChange,

    // Reads
    getExperienceBySlug: getExperienceBySlug,
    getExperienceByRecordId: getExperienceByRecordId,
    listExperiences: listExperiences,

    // Writes
    createExperience: createExperience,
    updateExperience: updateExperience,
    setPublishStatus: setPublishStatus,

    // Storage
    uploadHeroImage: uploadHeroImage,
    uploadWelcomeVideo: uploadWelcomeVideo,

    // Big Sky Scan™
    resolveScan: resolveScan,
    ensureScanDestination: ensureScanDestination,
    getScanDestinationForExperience: getScanDestinationForExperience,

    // Experience Sections
    getEnabledSections: getEnabledSections,
    listSectionsForExperience: listSectionsForExperience,
    getSectionById: getSectionById,
    createSection: createSection,
    updateSection: updateSection,
    setSectionEnabled: setSectionEnabled,
    reorderSections: reorderSections,
    softDeleteSection: softDeleteSection
  };
})();
