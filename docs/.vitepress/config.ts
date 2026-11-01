import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vitepress'

// Where the site is hosted: https://archipen.dev/ → "/" (default); a project page such as https://<owner>.github.io/<repo>/ → "/<repo>/".
// The live app is copied to <base>app/ by `npm run site:build`.
const base = normalizeBase(process.env.DOCS_BASE ?? '/')

function normalizeBase(b: string) {
  return `/${b.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/')
}

// The markdown files link to repo files with relative paths (../schema/…, ../examples/…, ../app/public/…),
// so they work when browsing the repo. On the site those files are served from the site root instead.
const REPO_LINKS: [RegExp, string][] = [
  [/^(\.\.\/)+schema\//, 'schema/'],
  [/^(\.\.\/)+examples\//, 'examples/'],
  [/^(\.\.\/)+app\/public\//, 'app/'],
]

// `npm run site:build` copies these folders into the site. The dev server serves them from the repo instead,
// so the schema, example and app links also work with `npm run docs:dev`. The app needs `npm run build` first.
const repo = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url))
const DEV_FOLDERS: [string, string[]][] = [
  ['schema/', [repo('schema')]],
  ['examples/', [repo('examples')]],
  ['app/', [repo('app/dist'), repo('app/public')]],
]
const TYPES: Record<string, string> = {
  '.json': 'application/json', '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
}

function serveRepoFolders(): Plugin {
  return {
    name: 'archipen-repo-folders',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url ?? '').split(/[?#]/)[0])
        const path = url.startsWith(base) ? url.slice(base.length) : url.replace(/^\//, '')
        for (const [prefix, dirs] of DEV_FOLDERS) {
          if (!path.startsWith(prefix)) continue
          for (const dir of dirs) {
            let file = normalize(join(dir, path.slice(prefix.length)))
            if (!file.startsWith(dir)) break
            if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
            if (!existsSync(file)) continue
            res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream')
            createReadStream(file).pipe(res)
            return
          }
        }
        next()
      })
    },
  }
}

export default defineConfig({
  base,
  vite: { plugins: [serveRepoFolders()] },
  title: 'Archipen',
  description: 'Isometric architecture diagrams in the browser.',
  lang: 'en',
  cleanUrls: false,
  lastUpdated: false,
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}app/favicon.svg` }]],
  srcExclude: ['**/README.md'],
  markdown: {
    config(md) {
      const render = md.renderer.rules.link_open
      md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        const href = token.attrGet('href')
        for (const [re, to] of href ? REPO_LINKS : []) {
          if (re.test(href!)) {
            token.attrSet('href', base + href!.replace(re, to))
            token.attrSet('target', '_blank')
            break
          }
        }
        return render ? render(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options)
      }
    },
  },
  themeConfig: {
    logo: { src: '/app/favicon.svg', alt: '' },
    nav: [
      { text: 'Guide', link: '/' },
      { text: 'File format', link: '/file-format' },
      { text: 'Hosting', link: '/hosting' },
      // Not a docs page: a plain link to the app copied in by site:build.
      { text: 'Open the app', link: '/app/', target: '_self' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Controls', link: '/controls' },
          { text: 'Examples', link: '/examples' },
          { text: 'Export without a browser', link: '/export' },
          { text: 'Edit with AI (MCP)', link: '/mcp' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'File format', link: '/file-format' },
          { text: 'JSON Schema', link: `${base}schema/archipen.schema.json`, target: '_blank' },
        ],
      },
      {
        text: 'Hosting',
        items: [
          { text: 'From source', link: '/hosting#from-source' },
          { text: 'Docker', link: '/hosting#docker' },
          { text: 'Export server', link: '/hosting#export-server' },
          { text: 'GitHub Pages', link: '/hosting#github-pages' },
        ],
      },
    ],
    search: { provider: 'local' },
    outline: { level: [2, 3] },
    socialLinks: [{ icon: 'github', link: 'https://github.com/archipen-dev/archipen' }],
    editLink: { pattern: 'https://github.com/archipen-dev/archipen/edit/main/docs/:path', text: 'Edit this page on GitHub' },
    footer: {
      message: 'Released under the MIT License. Vendor logos from Simple Icons are trademarks of their respective owners.',
    },
  },
})
