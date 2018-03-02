.PHONY: help

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

STAGE ?= test
SERVICE ?= tracking
COOKIE_NAME ?= sample_cookie
SECRET ?= secret
ALIAS = $(shell aws kms list-aliases --query "Aliases[?AliasName==\`alias/"$(STAGE)"/"$(SERVICE)"\`].AliasArn" --output text)

deploy: ## Deploy this project
	@STAGE=$(STAGE) COOKIE_NAME=$(COOKIE_NAME) SERVICE=$(SERVICE) bash -e -c '\
		[ -z "$(ALIAS)" ] && echo "Pre-deploying stack" && sls deploy --stage $(STAGE); \
		echo "Deploying stack" && SIGNATURE=$$(aws kms encrypt --key-id alias/$(STAGE)/$(SERVICE) --plaintext $(SECRET) --query CiphertextBlob --output text) \
		sls deploy --stage $(STAGE) \
	'
	@ make describe

describe: ## Describe the stack's outputs
	@echo 
	@echo "--- Stack Outputs ----"
	@aws cloudformation describe-stacks --query 'Stacks[0].[Outputs[].[OutputKey,OutputValue]]|[]' --output text --stack-name $(SERVICE)-$(STAGE) | awk '{printf "\033[32m%-50s\033[0m %s\n", $$1, $$2}'

remove: ## Remove the entire stack
	@STAGE=$(STAGE) COOKIE_NAME=$(COOKIE_NAME) SERVICE=$(SERVICE) sh -c '\
		sls remove --stage $(STAGE) \
	'


logs: ## tail the logs for the tracker
	@STAGE=$(STAGE) COOKIE_NAME=$(COOKIE_NAME) SERVICE=$(SERVICE) sh -c '\
		sls logs --stage $(STAGE) -f tracker -t \
	'
