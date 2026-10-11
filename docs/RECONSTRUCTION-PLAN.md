# Heat Chart reconstruction

Decision (2026-10-11): stop pursuing Railway recovery. Do not delete any remaining source data. Do not claim historical accounts have been recovered.

Use the existing McCluster shared Supabase project and canonical platform identity contract from `mcclusterishere/mccluster` (see its `AGENTS.md`). Do not provision a second backend or identity provider.

Rebuild public sneaker browsing from the existing KicksDB integration and preserve affiliate redirect behavior. Returning users must verify identity; old passwords and OAuth links cannot be reconstructed from missing database records. Never create synthetic user accounts or financial transactions.

Review the legacy Prisma schema, migrations, scheduled jobs, storage, and authentication before deploying against shared infrastructure. Supabase does not host the Next.js frontend. Run tests and validate authorization before enabling creator or payment workflows.

Legacy Railway startup database mutation and demo seeding have been disabled in this PR. This does not constitute a completed migration or a deployed website.
