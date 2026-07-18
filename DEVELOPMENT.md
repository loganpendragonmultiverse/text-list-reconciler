# Development handoff

The v1 application is dependency-free and local-only. It must not add analytics, remote APIs, or silent fuzzy matching. Any parser expansion needs adversarial tests for quotes, Unicode, large inputs, and formula-like CSV values before export behavior changes.
