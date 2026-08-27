import { readFile } from 'node:fs/promises'

const requiredPages = [
  'site/index.html',
  'site/disposable-email-domain-blocklist/index.html',
  'site/disposable-email-checker/index.html',
  'site/supabase-disposable-email-blocker/index.html',
  'site/nextjs-disposable-email-validation/index.html',
]
const baseUrl = 'https://notoow.github.io/disposable-email-domain-blocklist/'

for (const path of requiredPages) {
  const html = await readFile(path, 'utf8')
  if (!/<title>[^<]+<\/title>/i.test(html)) throw new Error(`${path}: missing title`)
  if (!/<h1>[^<]+<\/h1>/i.test(html)) throw new Error(`${path}: missing h1`)
  if (!html.includes('rel="canonical"')) throw new Error(`${path}: missing canonical`)
  if (!html.includes('application/ld+json')) throw new Error(`${path}: missing JSON-LD`)
  if (!html.includes('Disposable Email')) throw new Error(`${path}: missing product phrase`)
}

const homepage = await readFile('site/index.html', 'utf8')
if (!homepage.includes('Which disposable email domains are blocked?')) {
  throw new Error('homepage: missing visible blocked-domain section')
}
if (!homepage.includes('<code>vtmpj.com</code>')) {
  throw new Error('homepage: missing current blocked domain')
}

const robots = await readFile('site/robots.txt', 'utf8')
const sitemap = await readFile('site/sitemap.xml', 'utf8')
if (!robots.includes(`${baseUrl}sitemap.xml`)) throw new Error('robots.txt: missing sitemap URL')
for (const path of requiredPages) {
  const route = path === 'site/index.html' ? '' : path.slice(5, -10)
  if (!sitemap.includes(`${baseUrl}${route}`)) throw new Error(`sitemap.xml: missing ${route}`)
}
console.log(`Site check passed for ${requiredPages.length} pages.`)
