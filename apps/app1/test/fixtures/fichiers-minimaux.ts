/**
 * Des contenus de fichiers RÉELS, réduits à leur signature.
 *
 * ## ⚠️ POURQUOI CE FICHIER EXISTE (constat A2)
 *
 * La validation d'un envoi ne comparait que le type MIME **déclaré par le navigateur** et
 * l'extension du nom — deux valeurs que le client choisit. Un fichier arbitraire renommé `.png`
 * était accepté, stocké, puis servi avec `Content-Type: image/png`. Le commentaire du validateur
 * l'écrivait noir sur blanc : « Pour une vraie validation, contrôler aussi les magic bytes ». Un
 * constat documenté dans le code n'est pas un constat traité.
 *
 * Depuis que les octets de signature sont vérifiés, un contenu inventé — `'fake image data'`, que
 * deux fichiers de test employaient — est **refusé**, et c'est exactement le but. Les tests qui
 * déposent un fichier ont donc besoin d'un contenu dont les premiers octets sont vrais.
 *
 * ⚠️ UN SEUL ENDROIT, et c'est le point : ces data-URL étaient à inventer dans chaque test. Écrites
 * à la main deux fois, elles auraient fini par diverger, et un test aurait éprouvé une signature
 * que la production ne voit jamais.
 */

/** Une data-URL `data:<type>;base64,<…>` à partir d'octets. */
const dataUrl = (type: string, octets: number[]) =>
  `data:${type};base64,${Buffer.from(octets).toString('base64')}`

/** JPEG : `FF D8 FF`, suivi du marqueur JFIF. */
export const JPEG_MINIMAL = dataUrl(
  'image/jpeg',
  [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]
)

/** PNG : `89 50 4E 47 0D 0A 1A 0A`. */
export const PNG_MINIMAL = dataUrl(
  'image/png',
  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]
)

/** GIF : `GIF89a`. */
export const GIF_MINIMAL = dataUrl(
  'image/gif',
  [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00]
)

/** WebP : `RIFF` ….. `WEBP` — la signature est en DEUX morceaux, aux octets 0-3 et 8-11. */
export const WEBP_MINIMAL = dataUrl(
  'image/webp',
  [0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]
)

/** PDF : `%PDF`. Un justificatif de trésorerie peut en être un. */
export const PDF_MINIMAL = dataUrl(
  'application/pdf',
  [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46]
)

/**
 * Du texte, qui se fait passer pour une image.
 *
 * C'est le contenu exact que deux fichiers de test employaient (`'fake image data'`), et c'est
 * désormais le cas de refus : ni signature JPEG, ni aucune autre.
 */
export const TEXTE_DEGUISE_EN_IMAGE = dataUrl(
  'image/jpeg',
  [...'fake image data'].map((c) => c.charCodeAt(0))
)

/** Un fichier déposé, tel que nuxt-file-storage le rend au serveur. */
export const fichierDepose = (content: string, name: string, type: string, taille = 1024) => ({
  name,
  type,
  size: String(taille),
  content,
  lastModified: '0',
})
