import test from 'node:test';
import assert from 'node:assert/strict';
import { injectAbsoluteSocialUrls, resolveDeployBaseUrl } from './seoConfig';

test('resolveDeployBaseUrl resolves GitHub Pages project and user sites', () => {
  assert.equal(
    resolveDeployBaseUrl({
      GITHUB_ACTIONS: 'true',
      GITHUB_REPOSITORY: 'OctoCat/voice-stitch',
    }),
    'https://octocat.github.io/voice-stitch/',
  );

  assert.equal(
    resolveDeployBaseUrl({
      GITHUB_ACTIONS: 'true',
      GITHUB_REPOSITORY: 'OctoCat/octocat.github.io',
    }),
    'https://octocat.github.io/',
  );
});

test('resolveDeployBaseUrl resolves Vercel and custom SITE_URL', () => {
  assert.equal(
    resolveDeployBaseUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'voicestitch.vercel.app' }),
    'https://voicestitch.vercel.app/',
  );
  assert.equal(
    resolveDeployBaseUrl({ SITE_URL: 'https://audio.example.com/app' }),
    'https://audio.example.com/app/',
  );
  assert.equal(resolveDeployBaseUrl({}), null);
});

test('injectAbsoluteSocialUrls rewrites relative og-card.png and adds canonical/og:url when baseUrl is present', () => {
  const sampleHtml = `<head>
    <meta property="og:image" content="./og-card.png" />
    <meta name="twitter:image" content="./og-card.png" />
  </head>`;

  assert.equal(injectAbsoluteSocialUrls(sampleHtml, null), sampleHtml);

  const rewritten = injectAbsoluteSocialUrls(
    sampleHtml,
    'https://octocat.github.io/voice-stitch/',
  );
  assert.ok(
    rewritten.includes('property="og:image" content="https://octocat.github.io/voice-stitch/og-card.png"'),
  );
  assert.ok(
    rewritten.includes('name="twitter:image" content="https://octocat.github.io/voice-stitch/og-card.png"'),
  );
  assert.ok(
    rewritten.includes('<meta property="og:url" content="https://octocat.github.io/voice-stitch/" />'),
  );
  assert.ok(
    rewritten.includes('<link rel="canonical" href="https://octocat.github.io/voice-stitch/" />'),
  );
});
