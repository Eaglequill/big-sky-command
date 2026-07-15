// Big Sky Command™ — Experience Engine
// config.js
//
// Project connection details only. No client/business content belongs in
// this file — that all lives in the experience data source (the
// Supabase "experiences" table).
//
// DATA_PROVIDER controls which one the engine uses. Now pointed at the
// live Supabase project. To fall back to the local JSON file again,
// change DATA_PROVIDER to "json" — nothing else in the project needs to
// change.

window.BIG_SKY_CONFIG = {
  DATA_PROVIDER: "supabase", // "supabase" (current) or "json" (local fallback)

  // Used when DATA_PROVIDER is "json":
  JSON_DATA_URL: "experiences.json",

  // Used when DATA_PROVIDER is "supabase":
  SUPABASE_URL: "https://wssneqxgoqzrhnfqjqwj.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_jdGAnAawdIUS9zfNu97FIQ_GDuW7ogp"
};
