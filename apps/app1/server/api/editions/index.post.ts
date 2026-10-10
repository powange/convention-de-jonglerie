import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { invalidateEditionCache } from '#server/utils/cache-helpers'
import { normalizeDateToISO } from '#server/utils/date-helpers'
import { syncEventMetadataFromEdition } from '#server/utils/event-sync'
import { handleFileUpload } from '#server/utils/file-helpers'
import { geocodeEdition } from '#server/utils/geocoding'
import { getConventionForEditionCreation } from '#server/utils/permissions/convention-permissions'
import { editionWithFavoritesInclude } from '#server/utils/prisma-select-helpers'
import { editionSchema } from '#server/utils/validation-schemas'
import { servicesPourEcriture } from '~~/shared/utils/services-d-edition'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const body = await readBody(event)

    // Validation et sanitisation des données avec Zod (gérée automatiquement par wrapApiHandler)
    const validatedData = editionSchema.parse(body)

    const {
      conventionId,
      name,
      description,
      imageUrl,
      startDate,
      endDate,
      timezone,
      addressLine1,
      addressLine2,
      postalCode,
      city,
      region,
      country,
      ticketingUrl,
      officialWebsiteUrl,
      programUrl,
      facebookUrl,
      instagramUrl,
      jugglingEdgeUrl,
      currency,
    } = validatedData

    /*
     * Les services ne sont plus destructurés un par un.
     *
     * ⚠️ Cette destructuration en nommait 23 sur 26. Les trois manquants — `hasUnicycleSpace`,
     * `hasLongShow`, `hasATM` — étaient acceptés par `editionSchema`, donc présents dans
     * `validatedData`, et perdus ici : le `create` n'écrit que ce qui a été destructuré. Un
     * service pouvait ainsi être filtrable sur l'accueil, cochable dans la page Services, et
     * silencieusement non enregistré à la création.
     *
     * `jugglingEdgeUrl` et `currency` étaient dans le même cas, et sont repris ci-dessus.
     */
    const services = servicesPourEcriture(validatedData)

    // Vérifier les permissions pour créer une édition
    await getConventionForEditionCreation(conventionId, user)

    // Géocoder l'adresse pour obtenir les coordonnées
    const geoCoords = await geocodeEdition({
      addressLine1,
      addressLine2,
      city,
      postalCode,
      country,
    })

    // Créer l'événement générique (ancre) puis l'édition qui partage son id (invariant
    // Edition.id == eventId) de façon atomique : pas d'Event orphelin si l'édition échoue.
    const edition = await prisma.$transaction(async (tx) => {
      const eventAnchor = await tx.event.create({ data: {} })

      // Créer l'édition sans l'image d'abord
      const created = await tx.edition.create({
        data: {
          id: eventAnchor.id,
          eventId: eventAnchor.id,
          conventionId,
          name: name?.trim() || null,
          description,
          imageUrl: null, // On met null d'abord
          startDate: normalizeDateToISO(startDate) || startDate,
          endDate: normalizeDateToISO(endDate) || endDate,
          addressLine1,
          addressLine2,
          postalCode,
          city,
          region,
          country,
          timezone,
          latitude: geoCoords.latitude,
          longitude: geoCoords.longitude,
          ticketingUrl,
          officialWebsiteUrl,
          programUrl,
          facebookUrl,
          instagramUrl,
          jugglingEdgeUrl,
          // `currency` porte un défaut en base (« EUR ») : ne pas écrire `undefined` dessus.
          ...(currency ? { currency } : {}),
          ...services,
          creatorId: user.id,
          status: 'OFFLINE', // Nouvelle édition créée hors ligne par défaut
        },
        include: editionWithFavoritesInclude,
      })

      // Étape 0bis : renseigner les métadonnées génériques de l'Event ancre depuis l'édition,
      // et créer la config bénévole par défaut (EventVolunteerSettings).
      await syncEventMetadataFromEdition(created.id, tx)
      await tx.eventVolunteerSettings.create({ data: { eventId: eventAnchor.id } })

      return created
    })

    /*
     * L'affiche déposée avant que l'édition existe, rangée sous son identifiant.
     *
     * ## ⚠️ CE QUI ÉTAIT CASSÉ ICI (constat B3)
     *
     * Ce bloc appelait `move-temp-image.ts`, qui faisait le même travail que `handleFileUpload` —
     * en moins bien, et sur DEUX chemins dont un mort :
     *
     * - le dossier de stockage y était écrit **en dur** (`/uploads`), donc `NUXT_FILE_STORAGE_MOUNT`
     *   était ignoré ;
     * - il appelait ensuite `copyToOutputPublic`, qui lit sa source sous `public/` là où le fichier
     *   vient d'être écrit sous le montage : en production, **chaque création d'édition avec
     *   affiche** écrivait « Erreur lors de la copie vers .output/public » dans les journaux, pour
     *   un mécanisme que la route `/uploads/**` a rendu inutile ;
     * - la seconde branche cherchait le fichier sous `public/uploads/temp/`, où **rien n'est jamais
     *   écrit** : une URL temporaire autre que `NEW_EDITION` laissait l'édition pointer vers
     *   `/uploads/temp/…`, que la purge horaire effaçait une heure plus tard.
     *
     * `handleFileUpload` — celui que la MODIFICATION d'une édition emploie déjà — n'a aucun de ces
     * défauts : il déduit le dossier temporaire de l'URL reçue, passe par nuxt-file-storage (donc
     * par le montage) et supprime le fichier temporaire. Les deux chemins partagent enfin une
     * seule définition, et l'affiche est rangée sous `editions/<id>` des deux côtés.
     *
     * ⚠️ La garde reste `includes('/temp/')`, comme avant : `handleFileUpload` sait aussi
     * télécharger une URL http, mais la création ne le faisait pas et ce lot ne l'ajoute pas.
     */
    if (imageUrl && imageUrl.includes('/temp/')) {
      const newImageUrl = await handleFileUpload(imageUrl, null, {
        resourceId: edition.id,
        resourceType: 'editions',
      })

      if (newImageUrl) {
        // Mettre à jour l'édition avec la nouvelle URL
        const updatedEdition = await prisma.edition.update({
          where: { id: edition.id },
          data: { imageUrl: newImageUrl },
          include: editionWithFavoritesInclude,
        })
        // Invalider le cache après création
        await invalidateEditionCache(updatedEdition.id)

        return createSuccessResponse(updatedEdition)
      }
    }

    // Invalider le cache après création
    await invalidateEditionCache(edition.id)

    return createSuccessResponse(edition)
  },
  { operationName: 'CreateEdition' }
)
