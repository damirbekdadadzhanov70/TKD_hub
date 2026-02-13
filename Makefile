.PHONY: help api webapp bot install install-api install-webapp db-migrate db-upgrade all

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Install ──────────────────────────────────────────────

install: install-api install-webapp ## Install all dependencies

install-api: ## Install Python dependencies
	pip install -r requirements.txt

install-webapp: ## Install frontend dependencies
	cd webapp && npm install

# ── Run ──────────────────────────────────────────────────

api: ## Run FastAPI server (port 8000)
	uvicorn api.main:app --reload --port 8000

webapp: ## Run React dev server (port 5173)
	cd webapp && npm run dev

bot: ## Run Telegram bot
	python3 -m bot.main

all: ## Run API + webapp in parallel
	@make api & make webapp & wait

# ── Database ─────────────────────────────────────────────

db-migrate: ## Create new Alembic migration (usage: make db-migrate msg="add column")
	alembic revision --autogenerate -m "$(msg)"

db-upgrade: ## Apply all pending migrations
	alembic upgrade head

# ── Build ────────────────────────────────────────────────

build-webapp: ## Build frontend for production
	cd webapp && npm run build

lint-webapp: ## TypeScript type check
	cd webapp && npx tsc --noEmit
