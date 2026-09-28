import { createRequire } from 'node:module'

const require = createRequire(
  '/home/powange/projects/convention-de-jonglerie/apps/app1/package.json'
)
const { chromium } = require('playwright')

const b = await chromium.launch()
const p = await b.newPage()
await p.goto('file://' + process.cwd() + '/tutoriel.html', { waitUntil: 'load' })
await p.pdf({
  path: '../controle-acces-benevole.pdf',
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate:
    '<div style="width:100%;font-size:8px;color:#9ca3af;padding:0 15mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>Tenir le contrôle d\'accès — guide du bénévole</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
})
await b.close()
