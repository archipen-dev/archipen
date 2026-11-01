// Regenerate the vendor icon files and public/vendor-icon-credits.txt: curated brand logos from Simple Icons
// (devDependency). Output:
// - src/icons/vendorSet.ts: name, category, colour and licence of every logo (small, always loaded);
// - src/icons/vendorPathsCore.ts: shapes of the CORE logos, loaded at startup;
// - src/icons/vendorPathsRest.ts: all other shapes, loaded on demand (see src/icons/vendorLoader.ts).
// Only royalty-free icons are kept:
// - no per-icon licence (the project's CC0 applies), CC0-1.0 or Unlicense: no conditions;
// - Apache-2.0, CC-BY-3.0, CC-BY-4.0: attribution only, credited in the generated credits file.
// Anything else (share-alike, non-commercial, no-derivatives, GPL, custom, and MIT/BSD, which need a copyright
// notice Simple Icons doesn't record) is skipped and reported. A slug that doesn't exist fails the run.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { root } from './load.mjs'

// Categories in picker order. A slug listed twice keeps its first category.
const CATEGORIES = {
  'Hosting & cloud': `
    googlecloud googlecloudstorage googlebigquery cloudflare cloudflarepages cloudflareworkers vercel netlify
    digitalocean hetzner vultr ovh scaleway render railway flydotio koyeb akamai fastly alibabacloud openstack
    proxmox vmware firebase supabase githubpages ionos hostinger godaddy namecheap backblaze wasabi bunnydotnet
    contabo upcloud neon planetscale upstash turso fauna appwrite pocketbase cloudron coolify caprover`,
  'Cloud native': `
    kubernetes helm docker podman containerd istio linkerd envoyproxy argo cilium etcd falco knative dapr backstage
    vitess rook longhorn rancher k3s redhatopenshift cncf natsdotio nomad consul vault traefikproxy kong nginx caddy
    lens portainer skaffold apache apachetomcat`,
  'CI/CD & DevOps': `
    githubactions github gitlab bitbucket gitea codeberg git circleci travisci teamcity buildkite drone spinnaker
    tekton octopusdeploy semaphoreci concourse bamboo appveyor bitrise codemagic fastlane codecov sonar renovate
    dependabot snyk trivy checkmarx jfrog sonatype terraform opentofu pulumi ansible chef puppet packer vagrant
    gradle apachemaven npm pnpm yarn nx turborepo bazel make cmake`,
  'Programming languages': `
    python go typescript kotlin c cplusplus dotnet scala swift dart elixir erlang haskell clojure julia lua perl
    nim ocaml fsharp gleam crystal fortran solidity elm purescript racket commonlisp webassembly assemblyscript
    nodedotjs bun`,
  'Data & messaging': `
    postgresql mysql mariadb mongodb redis sqlite cockroachlabs scylladb apachecassandra couchbase neo4j clickhouse
    snowflake databricks duckdb trino presto influxdb timescale elasticsearch opensearch apachesolr meilisearch
    algolia apachekafka apachepulsar rabbitmq mqtt eclipsemosquitto apachespark apacheflink apacheairflow
    apachehadoop minio ceph prisma drizzle hasura`,
  Observability: `
    prometheus grafana opentelemetry jaeger thanos fluentbit fluentd datadog newrelic sentry elastic kibana logstash
    splunk pagerduty k6`,
  Frameworks: `
    react angular svelte nextdotjs nuxt django flask fastapi spring springboot rubyonrails graphql apollographql`,
  'AI & ML': `anthropic huggingface ollama langchain pytorch tensorflow jupyter nvidia`,
  Technology: `
    linux ubuntu redhat centos almalinux alpinelinux archlinux opensuse suse nixos freebsd apple macos ios android
    google meta intel amd arm qualcomm cisco fortinet paloaltonetworks hp dell lenovo samsung huawei xiaomi
    raspberrypi arduino espressif truenas synology unraid openwrt pfsense mikrotik ubiquiti tplink wireguard
    openvpn tailscale zerotier openssl openid auth0 okta 1password bitwarden hashicorp citrix nutanix json yaml toml
    markdown openapiinitiative swagger postman jetbrains vim`,
  Services: `stripe paypal shopify wordpress cloudinary sap atlassian jira confluence notion zoom discord`,
}

// Common logos whose shapes load at startup; the rest load when the picker opens or a diagram uses one.
const CORE = new Set(`
  kubernetes docker helm argo istio postgresql mysql mongodb redis rabbitmq apachekafka elasticsearch nginx
  traefikproxy cloudflare vercel googlecloud terraform ansible vault github gitlab githubactions prometheus grafana
  opentelemetry sentry datadog python go typescript nodedotjs dotnet kotlin react nextdotjs linux ubuntu stripe`
  .trim()
  .split(/\s+/))

const SLUGS = []
const categoryOf = new Map()
for (const [category, list] of Object.entries(CATEGORIES)) {
  for (const slug of list.trim().split(/\s+/)) {
    if (categoryOf.has(slug)) continue
    categoryOf.set(slug, category)
    SLUGS.push(slug)
  }
}

const NO_CONDITIONS = new Set(['CC0-1.0', 'Unlicense'])
const ATTRIBUTION = {
  'Apache-2.0': 'https://www.apache.org/licenses/LICENSE-2.0',
  'CC-BY-3.0': 'https://creativecommons.org/licenses/by/3.0/',
  'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/',
}
// npm installs a package in app/node_modules or hoists it to the workspace root.
function pkgDir(name) {
  const dir = [join(root, 'node_modules', name), join(root, '../node_modules', name)].find((d) =>
    existsSync(join(d, 'package.json')),
  )
  if (!dir) throw new Error(`${name} is not installed; run npm install`)
  return dir
}
const simpleIcons = pkgDir('simple-icons')
const version = JSON.parse(readFileSync(join(simpleIcons, 'package.json'), 'utf8')).version
const data = JSON.parse(readFileSync(join(simpleIcons, 'data/simple-icons.json'), 'utf8'))
const bySlug = new Map(data.map((i) => [i.slug, i]))

const kept = []
const skipped = []
const missing = []
for (const slug of [...SLUGS].sort()) {
  const icon = bySlug.get(slug)
  if (!icon) {
    missing.push(slug)
    continue
  }
  const licence = icon.license?.type
  if (licence && !NO_CONDITIONS.has(licence) && !ATTRIBUTION[licence]) {
    skipped.push(`${slug} (${licence})`)
    continue
  }
  const svg = readFileSync(join(simpleIcons, 'icons', `${slug}.svg`), 'utf8')
  if (!/viewBox="0 0 24 24"/.test(svg)) throw new Error(`${slug}: unexpected viewBox`)
  const paths = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1])
  if (paths.length !== 1) throw new Error(`${slug}: expected one path, found ${paths.length}`)
  const credit = licence && ATTRIBUTION[licence] ? { licence, source: icon.source } : null
  kept.push({ slug, title: icon.title, hex: icon.hex.toLowerCase(), path: paths[0], credit, category: categoryOf.get(slug) })
}

for (const slug of CORE) if (!categoryOf.has(slug)) missing.push(`${slug} (in CORE but no category)`)
if (missing.length) {
  console.error(`Not in simple-icons ${version}: ${missing.join(', ')}`)
  process.exit(1)
}

const header = `// Generated by \`npm run icons:vendor\` from simple-icons ${version}. Do not edit.
// CC0-1.0 unless an icon names a licence; those are credited in public/vendor-icon-credits.txt.
// Brand logos are trademarks of their owners; they are included to refer to those products in diagrams.
`
const meta = kept.map(
  (i) =>
    `  ${JSON.stringify(i.slug)}: { title: ${JSON.stringify(i.title)}, category: ${JSON.stringify(i.category)}, hex: '#${i.hex}'${i.credit ? `, licence: '${i.credit.licence}'` : ''} },`,
)
writeFileSync(
  join(root, 'src/icons/vendorSet.ts'),
  `${header}
/** Picker and docs order. */
export const VENDOR_CATEGORIES = ${JSON.stringify(Object.keys(CATEGORIES))} as const
export type VendorCategory = (typeof VENDOR_CATEGORIES)[number]

export interface VendorIcon {
  title: string
  category: VendorCategory
  /** Brand colour, "#rrggbb". */
  hex: string
  /** Set when the logo's licence asks for attribution (see public/vendor-icon-credits.txt). */
  licence?: string
}

export const VENDOR_ICONS: Record<string, VendorIcon> = {
${meta.join('\n')}
}
`,
)
const pathFile = (name, doc, icons) =>
  `${header}
/** ${doc} Each is a single filled path on a 24×24 viewBox. */
export const ${name}: Record<string, string> = {
${icons.map((i) => `  ${JSON.stringify(i.slug)}: ${JSON.stringify(i.path)},`).join('\n')}
}
`
const core = kept.filter((i) => CORE.has(i.slug))
writeFileSync(join(root, 'src/icons/vendorPathsCore.ts'), pathFile('VENDOR_CORE_PATHS', 'Shapes of the common logos, loaded at startup.', core))
writeFileSync(join(root, 'src/icons/vendorPathsRest.ts'), pathFile('VENDOR_REST_PATHS', 'Shapes of all other logos, loaded on demand.', kept.filter((i) => !CORE.has(i.slug))))
console.log(`Vendor icons: ${core.length} core, ${kept.length - core.length} on demand`)

// Credits, served with the app and linked from the icon picker.
const credited = kept.filter((i) => i.credit)
const usedLicences = [...new Set(credited.map((i) => i.credit.licence))].sort()
const credits = `Archipen vendor icon credits
============================

Vendor logos are single-colour versions of the projects' logos, prepared by Simple Icons
(https://simpleicons.org, simple-icons ${version}). All logos are trademarks of their owners and are used
only to refer to their products.

Logos without an entry below are CC0-1.0 (public domain). These logos are used under the licence shown
and were changed from the original: converted to a single-colour path by Simple Icons.

${credited.map((i) => `${i.title}\n  Licence: ${i.credit.licence} (${ATTRIBUTION[i.credit.licence]})\n  Source:  ${i.credit.source}`).join('\n\n')}

Licences: ${usedLicences.map((l) => `${l} ${ATTRIBUTION[l]}`).join(', ')}
${usedLicences.includes('Apache-2.0') ? `\n\n${'-'.repeat(72)}\n\n${readFileSync(join(pkgDir('typescript'), 'LICENSE'), 'utf8').trim()}\n` : ''}`
writeFileSync(join(root, 'public/vendor-icon-credits.txt'), credits)
console.log(`Wrote public/vendor-icon-credits.txt: ${credited.length} credited icons`)
console.log(`Wrote src/icons/vendor*.ts: ${kept.length} icons from simple-icons ${version}`)
if (skipped.length) console.log(`Skipped (licence asks for more than attribution): ${skipped.join(', ')}`)
