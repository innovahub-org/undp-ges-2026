// Turn the raw mirror into a self-contained static site that works from any sub-path
// (GitHub Pages project site, custom domain, or a sub-folder).
// usage: node build.mjs <rawDir> <outDir> <publicBaseUrl>
import fs from 'node:fs/promises';
import path from 'node:path';

const [RAW, OUT, BASE_URL] = process.argv.slice(2);
const OLD_ORIGIN = 'https://undp-ges-2026.vercel.app';
const SANITY = 'https://cdn.sanity.io/';

await fs.rm(OUT, { recursive: true, force: true });
await fs.cp(RAW, OUT, { recursive: true });

// 1. Download the CMS (Sanity) media and the social preview image so nothing depends on external hosts.
async function download(url, dest) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
  console.log('downloaded', url);
}

let html = await fs.readFile(path.join(OUT, 'index.html'), 'utf8');

const sanityUrls = new Set(
  [...html.matchAll(/https:\/\/cdn\.sanity\.io\/(?:images|files)\/[a-z0-9]+\/production\/[A-Za-z0-9_.-]+/g)].map((m) => m[0]),
);
const sanityLocal = (u) => 'assets/' + u.split('/').pop();
for (const u of sanityUrls) await download(u, path.join(OUT, sanityLocal(u)));

const og = html.match(/opengraph-image-[A-Za-z0-9_-]+\.png/)?.[0];
if (og) await download(`${OLD_ORIGIN}/${og}`, path.join(OUT, og));

// 2. HTML: drop the image optimizer srcsets, point everything to local, relative paths.
html = html
  .replace(/\ssrcSet="[^"]*\/_next\/image[^"]*"/g, '')
  .replace(/\/_next\/image\?url=([^&"]+)&amp;w=\d+&amp;q=\d+/g, (_, enc) => sanityLocal(decodeURIComponent(enc)));
for (const u of sanityUrls) html = html.split(u + '?dl=').join(sanityLocal(u)).split(u).join(sanityLocal(u));
html = html
  .split(OLD_ORIGIN).join(BASE_URL)
  .replace(/(["'(\s])\/(_next\/|brand\/|icon\.svg|favicon\.ico|apple-icon\.png)/g, '$1./$2')
  .replace(/(\\")\/(_next\/|brand\/|icon\.svg|favicon\.ico|apple-icon\.png)/g, '$1./$2')
  .replace(/\?dpl=dpl_[A-Za-z0-9]+/g, '');
// Download dialog: replace the single CMS item with every file listed in downloads/downloads.json.
// The item exists twice (server HTML and React payload); both must match or React re-renders the old list.
const DL_SRC = path.join(path.dirname(RAW), 'downloads');
const downloads = JSON.parse(await fs.readFile(path.join(DL_SRC, 'downloads.json'), 'utf8'));
await fs.mkdir(path.join(OUT, 'assets/downloads'), { recursive: true });
const htmlItem = html.match(/<li><a class="kGdWoq_item".*?<\/a><\/li>/)[0];
const rscItem = html.match(/\[\\"\$\\",\\"li\\",\\"[^\\]+\\",\{\\"children\\":\[\\"\$\\",\\"a\\",null,\{\\"className\\":\\"kGdWoq_item\\".*?triggerIcon\\"\}\]\]\}\]\}\]/)[0];
const oldHref = htmlItem.match(/href="([^"]+)"/)[1];
const htmlItems = [];
const rscItems = [];
for (const d of downloads) {
  await fs.copyFile(path.join(DL_SRC, d.file), path.join(OUT, 'assets/downloads', d.file));
  const size = ((await fs.stat(path.join(DL_SRC, d.file))).size / 1048576).toFixed(1);
  const href = 'assets/downloads/' + d.file;
  htmlItems.push(htmlItem.split(oldHref).join(href)
    .replace(/(kGdWoq_label">)[^<]*(<!-- --> )\([^)]*\)/, `$1${d.label}$2(${d.language})`)
    .replace(/(kGdWoq_meta">PDF<!-- --> )\([^)]*\)/, `$1(${size} MB)`));
  rscItems.push(rscItem.split(oldHref).join(href)
    .replace(/(\\"kGdWoq_label\\",\\"children\\":\[\\")[^\\]*(\\",\\" )\([^)]*\)/, `$1${d.label}$2(${d.language})`)
    .replace(/(\\"PDF\\",\\" )\([^)]*\)/, `$1(${size} MB)`));
}
html = html.replace(htmlItem, htmlItems.join('')).replace(rscItem, rscItems.join(','));

// Turbopack loads lazy chunks from "/_next/" unless told otherwise.
html = html.replace('<head>', '<head><script>var TURBOPACK_CHUNK_BASE_PATH="./_next/";</script>');
await fs.writeFile(path.join(OUT, 'index.html'), html);

// 3. JS: serve images as-is (no /_next/image optimizer on a static host) and fix root-relative public assets.
const chunkDir = path.join(OUT, '_next/static/immutable/chunks');
for (const f of await fs.readdir(chunkDir)) {
  if (!f.endsWith('.js')) continue;
  const p = path.join(chunkDir, f);
  let js = await fs.readFile(p, 'utf8');
  const before = js;
  js = js
    .replace(/(path:"\/_next\/image",loader:"default",[^}]*?)unoptimized:!1/g, '$1unoptimized:!0')
    .replace(/unoptimized:!1\}/g, 'unoptimized:!0}')
    .replace(/"\/brand\//g, '"./brand/');
  if (js !== before) { await fs.writeFile(p, js); console.log('patched', f); }
}

// 4. GitHub Pages must not run Jekyll (it would hide the "_next" folder).
await fs.writeFile(path.join(OUT, '.nojekyll'), '');
