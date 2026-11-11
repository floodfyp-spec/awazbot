param (
    [Parameter(Position=0, Mandatory=$true)]
    [ValidateSet("web", "agent", "api", "test", "lint")]
    [string]$Target
)

switch ($Target) {
    "web" {
        npm --prefix web run dev
    }
    "agent" {
        uv run python -m awaz_agent.main start
    }
    "api" {
        uv run uvicorn awaz_api.main:app --reload --port 8000
    }
    "test" {
        uv run pytest
    }
    "lint" {
        npm --prefix web run lint
    }
}
