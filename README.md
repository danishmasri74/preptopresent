# PrepToPresent

An AI-assisted presentation rehearsal and feedback web app for university students.

- Product spec: [docs/spec.md](docs/spec.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- Project conventions and commands: [CLAUDE.md](CLAUDE.md)

## Getting started

Requirements: Node 22+, pnpm 10, [uv](https://docs.astral.sh/uv/) (installs Python 3.12 for you).

```bash
pnpm install
cd services/worker && uv sync && cd ../..
cp apps/web/.env.example apps/web/.env.local       # then fill in Supabase values
cp services/worker/.env.example services/worker/.env
pnpm dev                                           # http://localhost:3000
```

## Repository layout

| Path               | What                                                      |
| ------------------ | --------------------------------------------------------- |
| `apps/web`         | Next.js web app                                           |
| `services/worker`  | Python worker (slides, speech analysis, scoring, AI jobs) |
| `packages/schemas` | JSON Schemas shared by web and worker                     |
| `supabase`         | Database migrations and config                            |
| `docs`             | Spec and architecture                                     |
| `spikes`           | Throwaway experiments                                     |
