-- Big Sky Command™ — Experience Registry
-- 02_seed_bs000001.sql
-- Inserts the first live Business Overlay record: Big Sky Lead Partners'
-- own demo experience. Run this AFTER 01_schema.sql.
--
-- Every placeholder below is clearly labeled "PLACEHOLDER —" so it can be
-- found and replaced later without ever touching the Experience Engine
-- code. See PLACEHOLDERS-NEEDED.md for the full list and what's needed
-- from Paul to replace each one.

insert into experiences (
  experience_id,
  business_name,
  experience_name,
  status,
  headline,
  subheadline,
  logo_url,
  primary_color,
  secondary_color,
  welcome_video_url,
  call_to_action_text,
  ghl_form_embed,
  thank_you_message
) values (
  'BS000001',
  'Big Sky Lead Partners',
  'Big Sky Lead Partners Demo Experience',
  'active',
  'Welcome to Your Big Sky Experience',
  'Discover how Big Sky Command turns customer interest into a guided, connected business experience.',
  'PLACEHOLDER — logo_url (transparent PNG, hosted, min 500px wide)',
  'PLACEHOLDER — primary_color (hex code, e.g. #1B2A41)',
  'PLACEHOLDER — secondary_color (hex code, e.g. #D4AF37)',
  'PLACEHOLDER — welcome_video_url (hosted video link, e.g. GHL Media Storage or unlisted link)',
  'Start Your Experience',
  '<!-- PLACEHOLDER — ghl_form_embed: paste the GHL form embed code/snippet here -->',
  'Thanks for connecting with Big Sky Lead Partners. We received your information and will follow up personally.'
)
on conflict (experience_id) do update set
  business_name       = excluded.business_name,
  experience_name      = excluded.experience_name,
  status                = excluded.status,
  headline              = excluded.headline,
  subheadline           = excluded.subheadline,
  logo_url              = excluded.logo_url,
  primary_color         = excluded.primary_color,
  secondary_color       = excluded.secondary_color,
  welcome_video_url     = excluded.welcome_video_url,
  call_to_action_text   = excluded.call_to_action_text,
  ghl_form_embed        = excluded.ghl_form_embed,
  thank_you_message     = excluded.thank_you_message;
