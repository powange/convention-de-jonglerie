#!/usr/bin/env tsx
/* eslint-disable import/order */
/**
 * Génère des variantes PNG du logo SVG pour les favicons et PWA.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

async function run() {
  const srcSvg = path.resolve('public/logos/logo-jc.svg')
  const outDir = path.resolve('public/favicons')
  await mkdir(outDir, { recursive: true })

  let svgContent = await readFile(srcSvg, 'utf8')

  // Remplacer les zones noires (fill rgb(5,12,10)) par blanc pour les favicons
  svgContent = svgContent.replace(/fill="rgb\(5,12,10\)"/g, 'fill="#ffffff"')
  const sizes = [16, 32, 48, 64, 96, 180, 192, 256, 384, 512]

  await Promise.all(
    sizes.map(async (size) => {
      const file = path.join(outDir, `favicon-${size}x${size}.png`)
      await sharp(Buffer.from(svgContent))
        .resize(size, size)
        .png({ compressionLevel: 9 })
        .toFile(file)
    })
  )

  // Générer favicon.ico (16,32,48)
  const icoBuffer = await sharp(Buffer.from(svgContent)).resize(48, 48).png().toBuffer()
  await writeFile(path.join(outDir, 'favicon.png'), icoBuffer)

  // Générer les noms spéciaux attendus par les PWA et navigateurs
  const specialFiles = [
    { size: 192, name: 'android-chrome-192x192.png' },
    { size: 512, name: 'android-chrome-512x512.png' },
    { size: 180, name: 'apple-touch-icon.png' },
  ]

  await Promise.all(
    specialFiles.map(async ({ size, name }) => {
      const file = path.join(outDir, name)
      await sharp(Buffer.from(svgContent))
        .resize(size, size)
        .png({ compressionLevel: 9 })
        .toFile(file)
    })
  )

  // Note: Le manifest web est maintenant généré dynamiquement via /api/site.webmanifest
  // selon l'environnement (DEV/TEST/PROD). Voir server/api/site.webmanifest.get.ts
  console.log('Favicons générés dans public/favicons')
  console.log('Le manifest est généré dynamiquement via /api/site.webmanifest')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
