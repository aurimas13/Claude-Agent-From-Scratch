# Handy shortcuts. Run `make help` to list them.
.PHONY: help setup api web cli test lint

help:
	@grep -E '^[a-z]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  make %-6s %s\n", $$1, $$2}'

setup: ## Install backend (venv) + frontend dependencies
	cd backend && python3 -m venv .venv && .venv/bin/python -m pip install -e ".[dev]"
	cd frontend && npm install
	@test -f backend/.env || cp backend/.env.example backend/.env
	@test -f frontend/.env.local || cp frontend/.env.example frontend/.env.local
	@echo "Now put your ANTHROPIC_API_KEY in backend/.env"

api: ## Run the agent API on http://localhost:8000
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

web: ## Run the website on http://localhost:3000
	cd frontend && npm run dev

cli: ## Chat with the agent in the terminal
	cd backend && .venv/bin/python -m app.cli

test: ## Run all tests and checks
	cd backend && .venv/bin/ruff check . && .venv/bin/pytest -q
	cd frontend && npm run lint && npm run typecheck

lint: ## Auto-format Python
	cd backend && .venv/bin/ruff format . && .venv/bin/ruff check --fix .
