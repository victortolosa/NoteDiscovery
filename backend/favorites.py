"""
Favorites and Starred Folders Sync for NoteDiscovery
Persists favorited notes, starred folders, and small synced UI preferences
to a single JSON file so they sync across devices.
"""

import json
import threading
from pathlib import Path
from typing import Any, Dict

# Thread lock for safe concurrent access
_lock = threading.Lock()

# Upper bound on notes/folders entries per payload, to keep a buggy or
# misbehaving client from growing .favorites.json without limit.
MAX_ENTRIES = 20000


def get_favorites_file_path(data_dir: str) -> Path:
    """Get the path to the favorites file."""
    return Path(data_dir) / '.favorites.json'


def normalize_favorites(value: Any) -> Dict[str, Any]:
    """
    Normalize a favorites payload to the canonical shape, tolerating the
    legacy format (a bare array of favorited note paths).
    """
    if isinstance(value, list):
        return {'notes': value, 'folders': [], 'preferences': {}}

    if not isinstance(value, dict):
        return {'notes': [], 'folders': [], 'preferences': {}}

    notes = value.get('notes')
    folders = value.get('folders')
    preferences = value.get('preferences')

    return {
        'notes': notes if isinstance(notes, list) else [],
        'folders': folders if isinstance(folders, list) else [],
        'preferences': preferences if isinstance(preferences, dict) else {},
    }


def has_only_strings(items: Any) -> bool:
    return isinstance(items, list) and all(isinstance(item, str) for item in items)


def is_within_limits(items: Any) -> bool:
    return isinstance(items, list) and len(items) <= MAX_ENTRIES


def load_favorites(data_dir: str) -> Dict[str, Any]:
    """Load favorites from file. Returns the default (empty) shape on any error."""
    favorites_file = get_favorites_file_path(data_dir)

    if not favorites_file.exists():
        return {'notes': [], 'folders': [], 'preferences': {}}

    try:
        with open(favorites_file, 'r', encoding='utf-8') as f:
            return normalize_favorites(json.load(f))
    except (json.JSONDecodeError, IOError):
        return {'notes': [], 'folders': [], 'preferences': {}}


def save_favorites(data_dir: str, payload: Dict[str, Any]) -> bool:
    """Atomically save favorites to file (write to temp file, then rename)."""
    favorites_file = get_favorites_file_path(data_dir)

    with _lock:
        try:
            favorites_file.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = favorites_file.with_suffix(favorites_file.suffix + '.tmp')
            with open(tmp_path, 'w', encoding='utf-8') as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)
            tmp_path.replace(favorites_file)
            return True
        except IOError as e:
            print(f"Failed to save favorites: {e}")
            return False
