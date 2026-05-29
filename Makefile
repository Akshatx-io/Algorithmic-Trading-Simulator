# =============================================================================
# HFT Trading Platform — Makefile
#
# Conventions:
#   - Targets are short verbs.
#   - Targets that touch the host environment are explicit (install, db-*).
#   - Targets that run inside Docker prefix with `docker-`.
#
# Phase 2.0 changes:
#   - All `pip install -r requirements.txt` replaced with `pip install -e .[dev]`.
#   - `flake8/black/isort` replaced with `ruff`.
#   - `check-deploy` grep pattern fixed to match .env.example (audit 10.8).
# =============================================================================

.PHONY: help install dev test test-cov lint format type-check clean \
        docker-build docker-up docker-down docker-logs \
        db-migrate db-upgrade db-downgrade db-current \
        frontend-install frontend-dev frontend-build frontend-test \
        setup check-deploy

# Default target
help:
	@echo "Available targets:"
	@echo "  Setup:"
	@echo "    setup            One-shot dev environment bootstrap"
	@echo "    install          Install backend (runtime only)"
	@echo "    dev              Install backend (runtime + dev)"
	@echo "    frontend-install Install frontend deps"
	@echo ""
	@echo "  Quality:"
	@echo "    lint             Ruff lint check"
	@echo "    format           Ruff format (writes)"
	@echo "    type-check       mypy"
	@echo "    test             pytest"
	@echo "    test-cov         pytest with coverage"
	@echo ""
	@echo "  Docker:"
	@echo "    docker-build     Build all images"
	@echo "    docker-up        docker compose up"
	@echo "    docker-down      docker compose down"
	@echo "    docker-logs      Tail api logs"
	@echo ""
	@echo "  Database:"
	@echo "    db-migrate msg='...'  Generate migration"
	@echo "    db-upgrade            Apply migrations"
	@echo "    db-downgrade          Roll back one migration"
	@echo "    db-current            Show current head"
	@echo ""
	@echo "  Misc:"
	@echo "    clean            Remove caches and build artifacts"
	@echo "    check-deploy     Validate .env is production-ready"

# ----- Setup -----------------------------------------------------------------

install:
	pip install -e .

dev:
	pip install -e .[dev]

frontend-install:
	cd frontend && npm install

setup: dev frontend-install db-upgrade
	@echo ""
	@echo "Development setup complete."
	@echo "Run 'make docker-up' or 'uvicorn main:app --reload' to start."

# ----- Quality --------------------------------------------------------------

lint:
	ruff check app tests
	ruff format --check app tests

format:
	ruff format app tests
	ruff check --fix app tests

type-check:
	mypy app

test:
	pytest

test-cov:
	pytest --cov=app --cov-report=term --cov-report=html

# ----- Docker ----------------------------------------------------------------

docker-build:
	docker compose build

docker-up:
	docker compose up

docker-up-detached:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f api

# ----- Database --------------------------------------------------------------

db-migrate:
	@if [ -z "$(msg)" ]; then echo "Usage: make db-migrate msg='description'"; exit 1; fi
	alembic revision --autogenerate -m "$(msg)"

db-upgrade:
	alembic upgrade head

db-downgrade:
	alembic downgrade -1

db-current:
	alembic current

# ----- Frontend --------------------------------------------------------------

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

frontend-test:
	cd frontend && npm test

# ----- Misc ------------------------------------------------------------------

clean:
	find . -type d \( -name __pycache__ -o -name .pytest_cache -o -name .mypy_cache -o -name .ruff_cache -o -name htmlcov \) -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null || true
	find . -type f \( -name "*.pyc" -o -name ".coverage" \) -not -path "*/node_modules/*" -delete 2>/dev/null || true
	rm -rf build/ dist/ *.egg-info/
	@echo "Cleaned."

# Fixed (audit 10.8): grep now matches the actual placeholder in .env.example.
check-deploy:
	@echo "Checking deployment readiness..."
	@test -f .env || { echo "ERROR: .env file missing"; exit 1; }
	@grep -q "^ENVIRONMENT=production" .env || { echo "ERROR: ENVIRONMENT is not 'production'"; exit 1; }
	@! grep -q "your-super-secret-jwt-key-change-in-production" .env || { echo "ERROR: JWT_SECRET_KEY still contains placeholder"; exit 1; }
	@grep -q "^JWT_SECRET_KEY=" .env || { echo "ERROR: JWT_SECRET_KEY is not set"; exit 1; }
	@echo "Deployment check passed."
