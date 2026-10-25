"""Run with: python -m unittest discover -s tests/backend -v.

Uses a temporary vault, never the configured notes directory.
Requires the development httpx dependency from pyproject.toml.
"""
import hashlib
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient


class NoteRevisionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.vault = tempfile.TemporaryDirectory(prefix='notediscovery-revisions-')
        # Import only after selecting a disposable vault: module initialization
        # reads config and constructs the app.
        with patch.dict(os.environ, {'NOTES_DIR': cls.vault.name, 'AUTHENTICATION_ENABLED': 'false'}):
            from backend import main
        cls.backend = main
        cls.client = TestClient(main.app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        cls.vault.cleanup()

    def setUp(self):
        self.path = f'{self._testMethodName}.md'
        self.url = f'/api/notes/{self.path}'
        self.file = Path(self.vault.name) / self.path

    def create(self, content='original'):
        result = self.client.post(self.url, json={'content': content})
        self.assertEqual(result.status_code, 200, result.text)
        return result.json()['hash']

    def test_stale_revision_cannot_overwrite_external_edit(self):
        base = self.create()
        self.file.write_text('external change', encoding='utf-8')
        result = self.client.post(self.url, json={'content': 'local change', 'base_hash': base})
        self.assertEqual(result.status_code, 409)
        self.assertEqual(self.file.read_text(), 'external change')
        self.assertEqual(result.json()['hash'], hashlib.sha256(b'external change').hexdigest())

    def test_get_and_save_return_next_revision(self):
        base = self.create()
        self.assertEqual(self.client.get(self.url).json()['hash'], base)
        result = self.client.post(self.url, json={'content': 'updated', 'base_hash': base})
        self.assertEqual(result.status_code, 200)
        self.assertNotEqual(result.json()['hash'], base)
        self.assertEqual(self.client.get(self.url).json()['hash'], result.json()['hash'])

    def test_unconditional_clients_keep_existing_behavior(self):
        self.create()
        self.file.write_text('external', encoding='utf-8')
        self.assertEqual(self.client.post(self.url, json={'content': 'script write'}).status_code, 200)
        self.assertEqual(self.file.read_text(), 'script write')

    def test_deleted_note_is_not_resurrected_by_stale_editor(self):
        base = self.create()
        self.file.unlink()
        result = self.client.post(self.url, json={'content': 'stale', 'base_hash': base})
        self.assertEqual(result.status_code, 409)
        self.assertIsNone(result.json()['hash'])
        self.assertFalse(self.file.exists())

    def test_line_endings_match_readback_revision(self):
        base = self.create('one\r\ntwo\rthree\n')
        self.assertEqual(self.client.get(self.url).json()['hash'], base)
        self.assertEqual(self.client.post(self.url, json={'content': 'next', 'base_hash': base}).status_code, 200)

    def test_rename_preserves_revision(self):
        base = self.create()
        new_path = f'renamed-{self.path}'
        result = self.client.post('/api/notes/move', json={'oldPath': self.path, 'newPath': new_path})
        self.assertEqual(result.status_code, 200, result.text)
        result = self.client.post(f'/api/notes/{new_path}', json={'content': 'after rename', 'base_hash': base})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertFalse(self.file.exists())

    def test_hash_uses_stored_content_before_load_plugin(self):
        def dispatch(hook, **kwargs):
            if hook == 'on_note_load':
                return 'displayed text'
            if hook == 'on_note_save':
                return 'stored:' + kwargs['content']
            return kwargs.get('initial_content', kwargs.get('content'))

        with patch.object(self.backend.plugin_manager, 'dispatch', side_effect=dispatch):
            base = self.create('input')
            loaded = self.client.get(self.url).json()
            self.assertEqual(loaded['content'], 'displayed text')
            self.assertEqual(loaded['hash'], hashlib.sha256(b'stored:input').hexdigest())
            self.assertEqual(loaded['hash'], base)
            self.assertEqual(self.client.post(self.url, json={'content': 'next', 'base_hash': base}).status_code, 200)

    def test_invalid_hash_is_rejected_without_writing(self):
        self.create()
        for bad in ['', 123, {}, 'wrong']:
            result = self.client.post(self.url, json={'content': 'bad', 'base_hash': bad})
            self.assertEqual(result.status_code, 400)
        self.assertEqual(self.file.read_text(), 'original')


if __name__ == '__main__':
    unittest.main()
