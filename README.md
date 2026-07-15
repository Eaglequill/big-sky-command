# Big Sky Command™

Customer Experience Operating System, built on a shared Experience Engine
and per-module architecture. This repository holds the whole platform —
each module lives under `modules/`, with its own front end and (where
applicable) its own Supabase schema.

## Structure

```
big-sky-command/
└── modules/
    └── module-01-experience-concierge/
        ├── site/        — the Experience Engine (static front end, deployed to Netlify)
        └── supabase/    — schema + seed SQL for this module's data
```

## Module 1: Experience Concierge

- **Live data source:** Supabase project `wssneqxgoqzrhnfqjqwj`, table `experiences`.
- **Front end:** `modules/module-01-experience-concierge/site/` — plain HTML/CSS/JS,
  no build step. Deployed as a Netlify static site.
- **Netlify config for this module, when linking this repo to Netlify:**
  - Base directory: `modules/module-01-experience-concierge/site`
  - Publish directory: `modules/module-01-experience-concierge/site`
  - Build command: (none — static files, no build step)

See `modules/module-01-experience-concierge/site/data-provider.js` for the
data source abstraction (`DATA_PROVIDER: "supabase"` in `config.js` — can
be switched to `"json"` to run locally against `experiences.json` without
touching any other code).

Future modules will be added as additional folders under `modules/`.

## License

Copyright © 2026 Big Sky Lead Partners™. All rights reserved.

This repository and its contents are proprietary and confidential. No
part of this codebase may be used, copied, modified, merged, published,
distributed, sublicensed, or sold without the express prior written
permission of Big Sky Lead Partners™. No license, express or implied, is
granted by making this repository viewable on GitHub.

