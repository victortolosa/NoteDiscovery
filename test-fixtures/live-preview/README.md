# Live preview fixtures

These source fixtures must never be edited in place through NoteDiscovery.

Create a disposable vault before testing:

```bash
fixture_vault="$(mktemp -d)/live-preview-vault"
cp -R test-fixtures/live-preview "$fixture_vault"
NOTES_DIR="$fixture_vault" PORT=8002 .venv/bin/python run.py
```

The temporary directory printed by `mktemp` can be deleted after the development
server stops. Keep normal development on port 8001 so the isolated server is
visibly distinct.
