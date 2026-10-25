"""Plugin settings live in the vault even when plugin code is read-only."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from backend.plugins import PluginManager


class PluginPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='notediscovery-plugin-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.plugins = self.root / 'plugins'
        self.vault = self.root / 'vault'
        self.plugins.mkdir()
        (self.plugins / 'sample.py').write_text(
            'from backend.plugins import Plugin as BasePlugin\n'
            'class Plugin(BasePlugin):\n'
            '    def __init__(self):\n'
            '        super().__init__()\n'
            '        self.name = "Sample"\n'
            '        self.version = "1"\n'
            '        self.enabled = True\n'
        )

    def manager(self):
        return PluginManager(str(self.plugins), notes_dir=str(self.vault))

    def test_new_settings_survive_new_manager_with_readonly_plugins(self):
        self.plugins.chmod(0o555)
        try:
            manager = self.manager()
            manager.disable_plugin('sample')
            self.assertFalse(self.manager().plugins['sample'].enabled)
            self.assertEqual(json.loads((self.vault / '.plugin-config.json').read_text()), {'sample': False})
            self.assertFalse((self.plugins / 'plugin_config.json').exists())
        finally:
            self.plugins.chmod(0o755)

    def test_legacy_settings_migrate_without_changing_original(self):
        legacy = self.plugins / 'plugin_config.json'
        legacy.write_text('{"sample": false}')
        manager = self.manager()
        self.assertFalse(manager.plugins['sample'].enabled)
        self.assertEqual(legacy.read_text(), '{"sample": false}')
        self.assertEqual(json.loads(manager.config_file.read_text()), {'sample': False})

    def test_persistent_settings_take_precedence(self):
        (self.plugins / 'plugin_config.json').write_text('{"sample": false}')
        self.vault.mkdir()
        (self.vault / '.plugin-config.json').write_text('{"sample": true}')
        self.assertTrue(self.manager().plugins['sample'].enabled)

    def test_invalid_settings_are_not_overwritten_at_startup(self):
        self.vault.mkdir()
        target = self.vault / '.plugin-config.json'
        for invalid in ('broken json', '[]', '{"sample": "false"}'):
            target.write_text(invalid)
            with self.assertLogs('uvicorn.error', level='ERROR'):
                self.manager()
            self.assertEqual(target.read_text(), invalid)

    def test_failed_atomic_write_preserves_previous_file_and_cleans_temp(self):
        manager = self.manager()
        original = manager.config_file.read_text()
        with patch('backend.plugins.os.replace', side_effect=OSError('simulated failure')):
            with self.assertLogs('uvicorn.error', level='ERROR'):
                manager.disable_plugin('sample')
        self.assertEqual(manager.config_file.read_text(), original)
        self.assertEqual(list(self.vault.glob('.plugin-config-*.tmp')), [])

    def test_optional_notes_directory_keeps_legacy_callers_working(self):
        manager = PluginManager(str(self.plugins))
        self.assertEqual(manager.config_file, self.plugins / 'plugin_config.json')
        self.assertTrue(manager.config_file.exists())


if __name__ == '__main__':
    unittest.main()
