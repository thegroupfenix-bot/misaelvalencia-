import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('deployment preserves the versioned .htaccess security policy', async () => {
  const deployment = await readFile('.cpanel.yml', 'utf8');
  const htaccess = await readFile('.htaccess', 'utf8');

  assert.match(htaccess, /connect-src 'self' https:\/\/script\.google\.com https:\/\/script\.googleusercontent\.com/);
  assert.doesNotMatch(deployment, /\bhtaccess\b/);
  assert.doesNotMatch(deployment, /\.(?:htaccess).*\b(?:mv|cp|ln|rm|install|rsync)\b|\b(?:mv|cp|ln|rm|install|rsync)\b.*\.htaccess/i);
});
