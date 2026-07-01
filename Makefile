APP   := dib
TAG   := $(APP)-builder
OUT   := export
IMAGE := $(APP)-build:latest

# ── docker helpers ───────────────────────────────────────────
DOCKER  := docker
ifeq ($(OS),Windows_NT)
  CP ?= copy /Y
  RM ?= del /Q
  MKDIR ?= mkdir
  NULL ?= NUL
else
  CP ?= cp
  RM ?= rm -f
  MKDIR ?= mkdir -p
  NULL ?= /dev/null
endif

.PHONY: all linux windows clean distclean help

all: linux  ## build for Linux (default)

# ── Linux ────────────────────────────────────────────────────
linux: export/linux/dib  ## build Linux release binary

export/linux/dib: Dockerfile.build
	$(DOCKER) build -f Dockerfile.build --target build-linux -t $(IMAGE) .
	$(DOCKER) run --rm -v "$(CURDIR)/$(OUT):/host-out" $(IMAGE) sh -c "mkdir -p /host-out/linux && cp /out/dib /host-out/linux/dib && chmod +x /host-out/linux/dib"
	@echo "✓ Linux binary: $(OUT)/linux/dib"

# ── Windows ──────────────────────────────────────────────────
windows: export/windows/dib.exe  ## build Windows release binary (cross)

export/windows/dib.exe: Dockerfile.build
	$(DOCKER) build -f Dockerfile.build --target build-windows -t $(IMAGE) .
	$(DOCKER) run --rm -v "$(CURDIR)/$(OUT):/host-out" $(IMAGE) sh -c "mkdir -p /host-out/windows && cp /out/dib.exe /host-out/windows/dib.exe"
	@echo "✓ Windows binary: $(OUT)/windows/dib.exe"

# ── both ─────────────────────────────────────────────────────
both: linux windows  ## build Linux + Windows

# ── clean ────────────────────────────────────────────────────
clean:  ## remove exported binaries
	$(RM) $(OUT)/linux/dib 2>$(NULL) || true
	$(RM) $(OUT)/windows/dib.exe 2>$(NULL) || true
	@echo "✓ Cleaned $(OUT)/"

distclean: clean  ## remove everything (image + binaries)
	$(DOCKER) rmi $(IMAGE) 2>$(NULL) || true
	@echo "✓ Removed image $(IMAGE)"

help:  ## show this help
	@echo "Usage: make [target]"
	@echo ""
	@grep -Eh '^[a-z_-]+:.*##' $(MAKEFILE_LIST) | sort | \
	  awk 'BEGIN {FS = ":.*## "}; {printf "  make %-15s %s\n", $$1, $$2}'
