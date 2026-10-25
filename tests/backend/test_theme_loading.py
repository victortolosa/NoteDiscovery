"""Theme response and early-render contracts; uses a disposable vault."""
import json
import os
import re
import tempfile
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient


class ThemeLoadingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.vault = tempfile.TemporaryDirectory(prefix='notediscovery-themes-')
        with patch.dict(os.environ, {'NOTES_DIR': cls.vault.name, 'AUTHENTICATION_ENABLED': 'false'}):
            from backend import main
        cls.backend = main
        cls.client = TestClient(main.app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        cls.vault.cleanup()

    def test_stylesheet_and_json_return_identical_css(self):
        for theme in ('obsidian', 'light', 'dark'):
            normal = self.client.get(f'/api/themes/{theme}')
            raw = self.client.get(f'/api/themes/{theme}?raw=true')
            self.assertEqual(raw.status_code, 200)
            self.assertTrue(raw.headers['content-type'].startswith('text/css'))
            self.assertEqual(raw.text, normal.json()['css'])
            self.assertEqual(raw.headers['cache-control'], 'no-cache')

    def test_missing_and_invalid_themes_do_not_return_css(self):
        for theme in ('missing-theme', 'invalid%21', '..%2Fconfig'):
            result = self.client.get(f'/api/themes/{theme}?raw=true')
            self.assertEqual(result.status_code, 404)

    def assert_bootstrap(self, html):
        self.assertNotIn('__THEME_BOOTSTRAP__', html)
        self.assertNotIn('__DEFAULT_THEME__', html)
        self.assertNotIn('__APP_VERSION__', html)
        self.assertNotIn('theme-critical', html)
        self.assertNotIn("localStorage.setItem('theme'", html)
        config = json.loads(re.search(r'const config = (.*?);', html).group(1))
        self.assertEqual(config['defaultTheme'], self.backend.DEFAULT_THEME)
        self.assertIn('light', config['themes'])
        self.assertLess(html.index('id="initial-theme"'), html.index('<body'))

    def test_app_embeds_valid_theme_config_before_body(self):
        self.assert_bootstrap(self.client.get('/').text)

    def test_login_bootstraps_without_authentication(self):
        with patch.dict(self.backend.config['authentication'], {'enabled': True}):
            result = self.client.get('/login')
            self.assertEqual(result.status_code, 200)
            self.assert_bootstrap(result.text)
            self.assertEqual(self.client.get('/api/themes/light?raw=true').status_code, 200)

    def test_theme_config_cannot_close_inline_script(self):
        with patch.object(self.backend, 'get_available_themes', return_value=[{'id': '</script><script>bad</script>'}]):
            rendered = self.backend._render_app_name_html('__THEME_BOOTSTRAP__')
            self.assertNotIn('<', rendered)
            self.assertEqual(json.loads(rendered)['themes'], ['</script><script>bad</script>'])


if __name__ == '__main__':
    unittest.main()
