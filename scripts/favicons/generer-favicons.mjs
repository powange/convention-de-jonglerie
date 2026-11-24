/**
 * Générateur de favicons COMMUN aux applications du dépôt (app1, app2).
 *
 * Chaque app garde un petit script d'appel (`apps/<app>/scripts/generate-favicons.*`, lancé par
 * `npm run favicons`) qui ne contient que SA configuration : logo source, couleur de fond,
 * recolorations, options. Le jeu de fichiers produit, ses noms et ses tailles sont les mêmes partout,
 * ce qui permet aussi de déclarer les icônes de la même façon dans `nuxt.config.ts` et dans le
 * manifeste web (`/api/site.webmanifest`).
 *
 * ⚠️ `sharp` et `png-to-ico` sont PASSÉS EN PARAMÈTRES, et non importés ici. Ce dossier vit à la
 * racine du dépôt, qui n'a pas de `node_modules` : un `import 'sharp'` y serait introuvable. Le
 * script de chaque app les importe depuis ses propres dépendances et les transmet.
 *
 * Fichiers produits, dans `dossierPublic` :
 *   favicons/favicon-{16,32,48,64,96,180,192,256,384,512}x….png   (logo sur fond)
 *   favicons/favicon.png                                           (48 px, sur fond)
 *   favicons/android-chrome-192x192.png, android-chrome-512x512.png, apple-touch-icon.png
 *   favicons/android-chrome-maskable-512x512.png   (si `maskable`)
 *   favicons/notification-badge.png                (si `badge`)
 *   favicon.ico                                    (16, 32, 48 px)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const TAILLES = [16, 32, 48, 64, 96, 180, 192, 256, 384, 512]

/**
 * @param {object} options
 * @param {typeof import('sharp')} options.sharp
 * @param {(pngs: Buffer[]) => Promise<Buffer>} options.pngToIco
 * @param {string} options.source              Logo SVG maître.
 * @param {string} options.dossierPublic       Dossier `public/` de l'app.
 * @param {{ r: number, g: number, b: number }} options.fond  Couleur de fond des icônes.
 * @param {Array<[RegExp | string, string]>} [options.remplacements]
 *        Recolorations appliquées au SVG avant rendu (ex. noir → blanc sur fond sombre).
 * @param {number} [options.echelle=1]
 *        Part du côté occupée par le logo. 1 = bord à bord, recadré au carré (comportement
 *        historique d'app1). En dessous de 1, le logo est CONTENU et centré, sans rognage — utile
 *        pour un logo qui n'est pas carré.
 * @param {{ echelle: number }} [options.maskable]
 *        Génère l'icône `maskable` d'Android. Seul le disque central de 80 % est garanti visible :
 *        une échelle de ~0,6 y fait tenir un logo carré.
 * @param {{ source: string, taille: number }} [options.badge]  Badge de notification (monochrome).
 * @param {{ log: (m: string) => void }} [options.journal]
 */
export async function genererFavicons({
  sharp,
  pngToIco,
  source,
  dossierPublic,
  fond,
  remplacements = [],
  echelle = 1,
  maskable,
  badge,
  journal = console,
}) {
  const dossier = path.join(dossierPublic, 'favicons')
  await mkdir(dossier, { recursive: true })

  let svg = await readFile(source, 'utf8')
  for (const [motif, remplacement] of remplacements) svg = svg.replaceAll(motif, remplacement)
  const logo = Buffer.from(svg)

  /** Le logo seul, rendu à la taille voulue. */
  const rendreLogo = (taille, part) => {
    if (part >= 1) return sharp(logo).resize(taille, taille).png().toBuffer()
    const cote = Math.round(taille * part)
    return sharp(logo)
      .resize(cote, cote, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
  }

  /** Le logo composé sur le fond, carré de `taille` px. */
  const surFond = async (taille, part = echelle) => {
    const rendu = await rendreLogo(taille, part)
    const { width = taille, height = taille } = await sharp(rendu).metadata()
    return sharp({ create: { width: taille, height: taille, channels: 4, background: fond } })
      .composite([
        {
          input: rendu,
          top: Math.round((taille - height) / 2),
          left: Math.round((taille - width) / 2),
        },
      ])
      .png({ compressionLevel: 9 })
  }

  await Promise.all(
    TAILLES.map(async (taille) =>
      (await surFond(taille)).toFile(path.join(dossier, `favicon-${taille}x${taille}.png`))
    )
  )

  await writeFile(path.join(dossier, 'favicon.png'), await (await surFond(48)).toBuffer())

  const speciaux = [
    { taille: 192, nom: 'android-chrome-192x192.png' },
    { taille: 512, nom: 'android-chrome-512x512.png' },
    { taille: 180, nom: 'apple-touch-icon.png' },
  ]
  await Promise.all(
    speciaux.map(async ({ taille, nom }) => (await surFond(taille)).toFile(path.join(dossier, nom)))
  )

  if (maskable) {
    await (
      await surFond(512, maskable.echelle)
    ).toFile(path.join(dossier, 'android-chrome-maskable-512x512.png'))
  }

  if (badge) {
    await sharp(Buffer.from(await readFile(badge.source, 'utf8')))
      .resize(badge.taille, badge.taille)
      .png({ compressionLevel: 9 })
      .toFile(path.join(dossier, 'notification-badge.png'))
  }

  const ico = await Promise.all(
    [16, 32, 48].map(async (taille) => (await surFond(taille)).png().toBuffer())
  )
  await writeFile(path.join(dossierPublic, 'favicon.ico'), await pngToIco(ico))

  journal.log(`Favicons générés dans ${path.relative(process.cwd(), dossier) || dossier}`)
  journal.log(
    `favicon.ico généré : ${path.relative(process.cwd(), path.join(dossierPublic, 'favicon.ico'))}`
  )
  if (maskable) journal.log('Icône maskable générée : android-chrome-maskable-512x512.png')
  if (badge) journal.log('Badge de notification généré : notification-badge.png')
}
