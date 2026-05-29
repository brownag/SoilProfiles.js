.DEFAULT_GOAL := help

NPM ?= npm
NODE ?= node
PORT ?= 4173

.PHONY: help install ci build test check clean rebuild demo demo-url smoke

help: ## Show available targets
	@echo "Available targets:"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' Makefile | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-12s %s\n", $$1, $$2}'

install: ## Install dependencies
	$(NPM) install

ci: ## Clean install dependencies with lockfile
	$(NPM) ci

build: ## Compile TypeScript to dist/
	$(NPM) run build

test: ## Run test suite
	$(NPM) test -- --runInBand

check: test build smoke ## Run core local verification

all: test build smoke install ## Run all checks

clean: ## Remove build artifacts
	$(NODE) -e "const fs=require('fs'); fs.rmSync('dist',{recursive:true,force:true});"

rebuild: clean build ## Clean and rebuild

demo: ## Start SoilKnowledgeBase demo server
	PORT=$(PORT) $(NPM) run demo:web

demo-url: ## Print demo page URL
	@echo http://localhost:$(PORT)/examples/soilknowledgebase-demo.html

smoke: ## Verify package can be imported
	$(NODE) -e "const pkg=require('.'); if(typeof pkg.renderStaticSVG!=='function') process.exit(1); console.log('smoke ok');"
