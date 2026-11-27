import sharp from 'sharp'

import { fichierDeLEvenement } from '../../../../utils/affiche-evenement'
import { sourceIcone } from '../../../../utils/application-evenement'
import { estUnNumero } from '../../../../utils/evenement-public'

/**
 * L'icône de l'application d'un événement, carrée, à la taille demandée (`?taille=192|512`) :
 * l'icône déposée, sinon l'affiche, recadrées au centre. `masquable=1` la réduit dans la zone sûre
 * (80 %) sur fond blanc, pour les lanceurs Android qui la découpent en cercle ou en goutte.
 *
 * Sans session : le lanceur du téléphone la télécharge sans cookies. Par identifiant PUBLIC
 * seulement (aléatoire) : on ne parcourt pas les icônes en comptant 1, 2, 3… Elle ne dit rien
 * d'autre que l'image elle-même. Sans image, renvoie vers l'icône de Flowvent.
 */
export default defineEventHandler(async (event) => {
  const ref = String(getRouterParam(event, 'id') ?? '')
  if (!ref || estUnNumero(ref)) throw createError({ status: 404, message: 'Icône introuvable' })
  const q = getQuery(event)
  const taille = Number(q.taille) === 192 ? 192 : 512
  const masquable = q.masquable === '1'

  const e = await prisma.event.findUnique({
    where: { publicId: ref },
    select: { id: true, appIconUrl: true, imageUrl: true },
  })
  if (!e) throw createError({ status: 404, message: 'Icône introuvable' })
  const chemin = fichierDeLEvenement(sourceIcone(e), e.id)
  if (!chemin) {
    return sendRedirect(event, `/favicons/android-chrome-${taille}x${taille}.png?v=v1`, 302)
  }

  try {
    const interieur = masquable ? Math.round(taille * 0.8) : taille
    let image = sharp(chemin).rotate().resize(interieur, interieur, { fit: 'cover' })
    if (masquable) {
      const marge = Math.floor((taille - interieur) / 2)
      image = image.extend({
        top: marge,
        bottom: taille - interieur - marge,
        left: marge,
        right: taille - interieur - marge,
        background: '#ffffff',
      })
    }
    const png = await image.png().toBuffer()
    setHeader(event, 'Content-Type', 'image/png')
    // L'URL porte l'empreinte de l'image (`v=`) : une icône changée change d'adresse.
    setHeader(event, 'Cache-Control', 'public, max-age=86400')
    return png
  } catch (erreur) {
    console.warn('[icône] image illisible :', erreur instanceof Error ? erreur.message : erreur)
    return sendRedirect(event, `/favicons/android-chrome-${taille}x${taille}.png?v=v1`, 302)
  }
})
