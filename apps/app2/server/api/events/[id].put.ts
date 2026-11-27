import { z } from 'zod'

import { afficheAEnregistrer } from '../../utils/affiche-evenement'
import { droitsSurEvenement } from '../../utils/droits-evenement'
import { idDepuisLaRoute } from '../../utils/evenement-public'
import { geocoderAdresse } from '../../utils/geocodage'

import { fuseauUtilisable, versInstant } from '#core/shared/utils/fuseau-edition'

/**
 * Modifie un événement : nom, description, lieu, dates de début et de fin, fuseau — et ce que
 * montre sa page publique : adresse (et ses coordonnées GPS), contact, affiche, liens, et le
 * choix de la rendre publique.
 *
 * Les champs de la page publique sont FACULTATIFS : absents, ils ne changent pas (un client ouvert
 * avant leur ajout continue d'enregistrer sans les effacer).
 *
 * Les dates arrivent en HORLOGE MURALE (`AAAA-MM-JJTHH:MM`, ce que montre un champ date-heure) et
 * sont ancrées ICI dans le fuseau de l'événement — jamais dans celui du navigateur : un
 * organisateur à Paris qui saisit 10 h pour un événement à Montréal enregistre 10 h à Montréal.
 */
const horloge = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Date et heure invalides')
  .nullable()

/** Texte court facultatif : vide → null. */
const texte = (max: number) => z.string().trim().max(max).nullable().optional()
/** Lien http(s) facultatif : vide → null. */
const lien = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === '' || /^https?:\/\/\S+$/i.test(v),
    'Le lien doit commencer par http:// ou https://'
  )
  .nullable()
  .optional()

const schema = z
  .object({
    name: z.string().trim().min(1, "Le nom de l'événement est requis").max(200),
    description: z.string().trim().max(5000).nullable(),
    location: z.string().trim().max(200).nullable(),
    timezone: z.string().refine((f) => !!fuseauUtilisable(f), 'Fuseau horaire inconnu'),
    debut: horloge,
    fin: horloge,
    addressLine1: texte(191),
    addressLine2: texte(191),
    postalCode: texte(20),
    city: texte(191),
    country: texte(191),
    imageUrl: z.string().max(500).nullable().optional(),
    appIconUrl: z.string().max(191).nullable().optional(),
    officialWebsiteUrl: lien,
    ticketingUrl: lien,
    facebookUrl: lien,
    instagramUrl: lien,
    pagePublique: z.boolean().optional(),
    contactEmail: z
      .string()
      .trim()
      .max(191)
      .refine(
        (v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        'Adresse e-mail de contact invalide'
      )
      .nullable()
      .optional(),
    // Coordonnées GPS saisies à la main ; absentes, elles se recalculent depuis l'adresse.
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .refine((d) => !d.debut || !d.fin || d.fin >= d.debut, {
    message: 'La fin doit suivre le début',
    path: ['fin'],
  })

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = await idDepuisLaRoute(event)

  const droits = await droitsSurEvenement(id, (user as { id: number }).id)
  if (!droits.voir) throw createError({ status: 404, message: 'Événement introuvable' })
  if (!droits.modifier)
    throw createError({ status: 403, message: 'Vous ne pouvez pas modifier cet événement' })

  const resultat = schema.safeParse(await readBody(event))
  if (!resultat.success) {
    throw createError({
      status: 400,
      message: resultat.error.issues[0]?.message ?? 'Données invalides',
    })
  }
  const d = resultat.data
  const actuel = await prisma.event.findUniqueOrThrow({
    where: { id },
    select: {
      imageUrl: true,
      appIconUrl: true,
      addressLine1: true,
      postalCode: true,
      city: true,
      country: true,
      latitude: true,
      longitude: true,
    },
  })
  const imageUrl = await afficheAEnregistrer(d.imageUrl, actuel.imageUrl, id)
  // L'icône de l'application suit le même circuit que l'affiche (dépôt temporaire, puis définitif).
  const appIconUrl = await afficheAEnregistrer(d.appIconUrl, actuel.appIconUrl, id)
  /** `undefined` (absent) ne change rien ; une chaîne vide efface. */
  const facultatif = (v: string | null | undefined) => (v === undefined ? undefined : v || null)

  // Coordonnées GPS : celles saisies à la main si elles changent ; sinon, si l'adresse change,
  // recalculées depuis elle (null si elle est introuvable : les anciennes ne vaudraient plus).
  const adresse = {
    ligne1: d.addressLine1 === undefined ? actuel.addressLine1 : d.addressLine1 || null,
    codePostal: d.postalCode === undefined ? actuel.postalCode : d.postalCode || null,
    ville: d.city === undefined ? actuel.city : d.city || null,
    pays: d.country === undefined ? actuel.country : d.country || null,
  }
  const adresseChangee =
    adresse.ligne1 !== actuel.addressLine1 ||
    adresse.codePostal !== actuel.postalCode ||
    adresse.ville !== actuel.city ||
    adresse.pays !== actuel.country
  const saisieManuelle =
    (d.latitude !== undefined && d.latitude !== actuel.latitude) ||
    (d.longitude !== undefined && d.longitude !== actuel.longitude)
  let coordonnees: { latitude: number | null; longitude: number | null } | undefined
  if (saisieManuelle) {
    coordonnees = { latitude: d.latitude ?? null, longitude: d.longitude ?? null }
  } else if (adresseChangee) {
    const trouvees = await geocoderAdresse(adresse)
    coordonnees = trouvees ?? { latitude: null, longitude: null }
  }

  const evenement = await prisma.event.update({
    where: { id },
    data: {
      name: d.name,
      description: d.description || null,
      location: d.location || null,
      timezone: d.timezone,
      startDate: d.debut ? new Date(versInstant(d.debut, d.timezone)) : null,
      endDate: d.fin ? new Date(versInstant(d.fin, d.timezone)) : null,
      addressLine1: facultatif(d.addressLine1),
      addressLine2: facultatif(d.addressLine2),
      postalCode: facultatif(d.postalCode),
      city: facultatif(d.city),
      country: facultatif(d.country),
      imageUrl,
      appIconUrl,
      officialWebsiteUrl: facultatif(d.officialWebsiteUrl),
      ticketingUrl: facultatif(d.ticketingUrl),
      facebookUrl: facultatif(d.facebookUrl),
      instagramUrl: facultatif(d.instagramUrl),
      pagePublique: d.pagePublique,
      contactEmail: facultatif(d.contactEmail),
      ...coordonnees,
    },
  })
  return createSuccessResponse({ event: evenement }, 'Événement mis à jour')
})
