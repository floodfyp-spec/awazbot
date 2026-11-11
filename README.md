# AwazBot KP

AI Voice Receptionist & Directory Platform for Khyber Pakhtunkhwa (Pakistan).
Enables local trade service providers (electricians, plumbers, mechanics, technicians) to provide real-time bilingual voice customer service in **Pashto and Urdu** via WebRTC and WhatsApp. Built for the KPITB AI Innovation Challenge 2026.

---

## Prerequisites

- **Node.js**: `v20.x` or later (LTS recommended) & `npm`
- **Python**: `3.11+` (CPython 3.12 recommended)
- **uv**: Fast Python package manager ([docs.astral.sh/uv](https://docs.astral.sh/uv/))
- **Make**: GNU Make 4+ (or use `./run.ps1` on Windows)

---

## Quickstart & Local Setup

### 1. Environment Configuration

Copy the example environment files and populate required credentials:

```bash
# Repo-level secrets (Agent, API, DB)
cp .env.example .env

# Web frontend secrets
cp web/.env.local.example web/.env.local
```

### 2. Install Dependencies

```bash
# Python workspace (core, agent, api)
uv sync

# Web application
npm --prefix web install
```

---

## Running Services

| Service | Make Command | Direct Command | Description |
|---|---|---|---|
| **Web Frontend** | `make web` | `npm --prefix web run dev` | Runs Next.js at http://localhost:3000 |
| **Agent Worker** | `make agent` | `uv run python -m awaz_agent.main start` | Starts LiveKit Agents voice worker |
| **FastAPI Backend** | `make api` | `uv run uvicorn awaz_api.main:app --reload --port 8000` | Serves API at http://localhost:8000 |
| **Run Tests** | `make test` | `uv run pytest` | Runs test suite across Python workspace |
| **Lint** | `make lint` | `npm --prefix web run lint && uv run ruff check` | Code quality and linting |

> **Note for Windows Users**: You can run `make <target>` using the included `make.cmd` / GNU Make, or run `./run.ps1 <target>` (e.g. `./run.ps1 web`).

---

## Repository Layout

```
awazbot-kp/
├── docs/AWAZBOT_SPEC.md          # Architecture & product specification (source of truth)
├── web/                          # Next.js 15 App Router in pure JavaScript (.js/.jsx)
├── core/                         # Shared Python package awaz_core (ontology, safety, booking)
├── agent/                        # LiveKit Agents worker awaz_agent (Pashto/Urdu voice pipeline)
├── api/                          # FastAPI service awaz_api (webhooks, eval runner, health)
├── supabase/                     # Database migrations and seed scripts
├── assets/audio/                 # Pre-rendered safety and greeting audio clips
├── eval/                         # Audio datasets and benchmark evaluation scripts
└── scripts/                      # Utility scripts (data seeding, health checks)
```

---

## Model & Dataset Disclosure

In compliance with hackathon evaluation standards, all models, APIs, and datasets utilized by AwazBot KP are disclosed below:

| Model / Dataset | Provider / Source | License | Purpose in AwazBot KP |
|---|---|---|---|
| | | | |

---

## License

Proprietary — Developed for KPITB AI Innovation Challenge 2026.
