.PHONY: up down db seed migrate lint typecheck clean help

help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

up: ## Start infrastructure services
	docker compose up -d
	@echo "Services starting..."
	@echo "  DB: postgresql://app:app@localhost:5434/app"
	@echo "  Redis: localhost:6379"
	@echo "  MinIO: http://localhost:9000 (console: http://localhost:9001)"
	@echo "  MailHog: http://localhost:8025"

down: ## Stop and remove all containers
	docker compose down -v

db: ## Open psql shell
	psql postgresql://app:app@localhost:5434/app

seed: ## Drop and recreate database schema using individual DDL files
	./db/drop_and_recreate.sh

migrate: ## Run database migrations
	pnpm --filter api db:migrate

dev: ## Start development servers
	pnpm dev

build: ## Build all packages
	pnpm build

lint: ## Lint all packages
	pnpm lint

typecheck: ## Type check all packages
	pnpm typecheck

test: ## Run tests
	pnpm test

clean: ## Clean all node_modules and build artifacts
	pnpm clean

logs: ## View logs from all services
	docker compose logs -f

status: ## Show status of all services
	docker compose ps