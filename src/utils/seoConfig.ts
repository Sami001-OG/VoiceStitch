export interface DeployEnv {
  SITE_URL?: string;
  GITHUB_ACTIONS?: string;
  GITHUB_REPOSITORY?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

export function resolveDeployBaseUrl(env: DeployEnv): string | null {
  const siteUrl = env.SITE_URL?.trim();
  if (siteUrl) {
    const withProtocol = /^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`;
    return ensureTrailingSlash(withProtocol);
  }

  if (env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY) {
    const parts = env.GITHUB_REPOSITORY.split('/');
    if (parts.length === 2 && parts[0] && parts[1]) {
      const [owner, repo] = parts;
      const lowerOwner = owner.toLowerCase();
      if (repo.toLowerCase() === `${lowerOwner}.github.io`) {
        return `https://${lowerOwner}.github.io/`;
      }
      return `https://${lowerOwner}.github.io/${repo}/`;
    }
  }

  const vercelHost =
    env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || env.VERCEL_URL?.trim();
  if (vercelHost) {
    const cleanHost = vercelHost.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    return `https://${cleanHost}/`;
  }

  return null;
}

export function injectAbsoluteSocialUrls(html: string, baseUrl: string | null): string {
  if (!baseUrl) {
    return html;
  }

  const normalizedBase = ensureTrailingSlash(baseUrl);
  const ogImageUrl = `${normalizedBase}og-card.png`;

  let next = html
    .replace(/(property="og:image"\s+content=")\.\/og-card\.png(")/g, `$1${ogImageUrl}$2`)
    .replace(/(name="twitter:image"\s+content=")\.\/og-card\.png(")/g, `$1${ogImageUrl}$2`);

  if (!/property="og:url"/i.test(next)) {
    next = next.replace(
      '</head>',
      `    <meta property="og:url" content="${normalizedBase}" />\n    <link rel="canonical" href="${normalizedBase}" />\n  </head>`,
    );
  }

  return next;
}
