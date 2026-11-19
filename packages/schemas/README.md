# @preptopresent/schemas

JSON Schemas that define data shared between the web app and the Python worker: job payloads and results, AI structured outputs, and scoring results.

- **Source of truth:** the `.schema.json` files here.
- **Web:** mirror them as Zod schemas (or generate them) and validate at the boundary.
- **Worker:** mirror them as Pydantic models.
- **Claude structured outputs:** pass the schema as `output_config.format` (see `docs/architecture.md` §7).

When a schema changes, update both sides in the same change.
