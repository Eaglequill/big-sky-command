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

  return { getExperience: getExperience };
})();
