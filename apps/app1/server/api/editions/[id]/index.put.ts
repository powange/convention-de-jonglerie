import type { Prisma } from '#server/types/prisma'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { invalidateEditionCache } from '#server/utils/cache-helpers'
import { normalizeDateToISO } from '#server/utils/date-helpers'
import { syncEventMetadataFromEdition } from '#server/utils/event-sync'
import { handleFileUpload } from '#server/utils/file-helpers'
import { geocodeEdition } from '#server/utils/geocoding'
import { getConventionForEditionCreation } from '#server/utils/permissions/convention-permissions'
import { getEditionForEdit } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { updateEditionSchema } from '#server/utils/validation-schemas'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    const body = await readBody(event)

    // Validation et sanitisation des données avec Zod (gérée automatiquement par wrapApiHandler)
    const validatedData = updateEditionSchema.parse(body)

    const {
      conventionId,
      name,
      description,
      imageUrl,
      startDate,
      endDate,
      timezone,
      currency,
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
      hasFoodTrucks,
      hasKidsZone,
      acceptsPets,
      hasTentCamping,
      hasTruckCamping,
      hasFamilyCamping,
      hasSleepingRoom,
      hasGym,
      hasFireSpace,
      hasGala,
      hasOpenStage,
      hasLongShow,
      hasConcert,
      hasCantine,
      hasAerialSpace,
      hasSlacklineSpace,
      hasUnicycleSpace,
      hasToilets,
      hasShowers,
      hasPrmAccess,
      hasSignLanguage,
      hasWorkshops,
      mealsEnabled,
      volunteersEnabled,
      artistsEnabled,
      ticketingEnabled,
      workshopsEnabled,
      programEnabled,
      workshopLocationsFreeInput,
      siteMapEnabled,
      tasksEnabled,
      stockEnabled,
      faqEnabled,
      treasuryEnabled,
      faqPagePublic,
      programPagePublic,
      hasATM,
      hasCashPayment,
      hasCreditCardPayment,
      hasAfjTokenPayment,
    } = validatedData

    // Récupère l'édition et vérifie les permissions d'édition
    const edition = await getEditionForEdit(editionId, user)

    /*
     * Déplacer une édition vers une autre convention, c'est y CRÉER une édition : on pose la même
     * règle que la création.
     *
     * ⚠️ CE QUI ÉTAIT DEMANDÉ AVANT, et c'était le mauvais droit : `canManageOrganizers` sur la
     * convention cible. Conséquence à double sens — un organisateur qui peut créer des éditions
     * (`canAddEdition`) ne pouvait pas y en déplacer une, tandis qu'un gestionnaire
     * d'organisateurs SANS droit d'ajout le pouvait. Et rien n'interdisait de déplacer une édition
     * vers une convention ARCHIVÉE, que la création refuse par un 409.
     *
     * 📍 CE QUE CE CHANGEMENT NE CORRIGE PAS, contrairement à ce que le constat laissait entendre :
     * l'admin global reste reconnu SANS mode admin. `canCreateEdition` lit `user.isGlobalAdmin`
     * brut, exactement comme le bloc remplacé — la création a donc le même écart, et le corriger
     * ici seulement ferait diverger les deux chemins qu'on vient d'aligner. C'est un point à part.
     */
    if (conventionId && conventionId !== edition.conventionId) {
      await getConventionForEditionCreation(conventionId, user)
    }

    // Gérer l'image avec le helper centralisé
    const finalImageFilename = await handleFileUpload(imageUrl, edition.imageUrl, {
      resourceId: editionId,
      resourceType: 'editions',
    })

    /*
     * ⚠️ DEUX SÉMANTIQUES DIFFÉRENTES ICI, ET C'EST LE SCHÉMA QUI TRANCHE.
     *
     * `description`, `region` et `addressLine2` sont `nullable().optional()` dans
     * `updateEditionSchema` : le formulaire envoie `null` quand on vide le champ, et cette absence
     * est une VALEUR. Ils suivent donc le motif de `name` — `!== undefined ? … : inchangé` — et
     * non `|| edition.X`, qui retombait sur l'ancienne valeur : une description effacée
     * réapparaissait au rechargement, sans erreur.
     *
     * `addressLine1`, `postalCode`, `city` et `country` sont `min(1).optional()` : ils ne peuvent
     * PAS être vides. `|| edition.X` y est équivalent et reste tel quel — les réécrire n'aurait
     * rien changé, et le faire « par symétrie » aurait laissé croire qu'ils sont vidables.
     *
     * 📍 `addressLine2` était simplement ABSENT de cet objet : destructuré, utilisé pour le
     * géocodage, et jamais écrit. La création l'enregistrait bien (`index.post.ts`), si bien que
     * le complément d'adresse se posait à la création et ne se corrigeait jamais.
     */
    const updatedData: Prisma.EditionUpdateInput = {
      name: name !== undefined ? name?.trim() || null : edition.name,
      description: description !== undefined ? description : edition.description,
      imageUrl: finalImageFilename !== undefined ? finalImageFilename : edition.imageUrl,
      startDate: startDate ? normalizeDateToISO(startDate) || startDate : edition.startDate,
      endDate: endDate ? normalizeDateToISO(endDate) || endDate : edition.endDate,
      addressLine1: addressLine1 || edition.addressLine1,
      addressLine2: addressLine2 !== undefined ? addressLine2 : edition.addressLine2,
      postalCode: postalCode || edition.postalCode,
      city: city || edition.city,
      region: region !== undefined ? region : edition.region,
      country: country || edition.country,
    }

    // Gérer le changement de convention si spécifié
    if (conventionId !== undefined && conventionId !== edition.conventionId) {
      updatedData.convention = { connect: { id: conventionId } }
    }

    if (timezone !== undefined) updatedData.timezone = timezone
    if (currency !== undefined) updatedData.currency = currency
    if (ticketingUrl !== undefined) updatedData.ticketingUrl = ticketingUrl
    if (officialWebsiteUrl !== undefined) updatedData.officialWebsiteUrl = officialWebsiteUrl
    if (programUrl !== undefined) updatedData.programUrl = programUrl
    if (facebookUrl !== undefined) updatedData.facebookUrl = facebookUrl
    if (instagramUrl !== undefined) updatedData.instagramUrl = instagramUrl
    if (jugglingEdgeUrl !== undefined) updatedData.jugglingEdgeUrl = jugglingEdgeUrl
    if (hasFoodTrucks !== undefined) updatedData.hasFoodTrucks = hasFoodTrucks
    if (hasKidsZone !== undefined) updatedData.hasKidsZone = hasKidsZone
    if (acceptsPets !== undefined) updatedData.acceptsPets = acceptsPets
    if (hasTentCamping !== undefined) updatedData.hasTentCamping = hasTentCamping
    if (hasTruckCamping !== undefined) updatedData.hasTruckCamping = hasTruckCamping
    if (hasFamilyCamping !== undefined) updatedData.hasFamilyCamping = hasFamilyCamping
    if (hasSleepingRoom !== undefined) updatedData.hasSleepingRoom = hasSleepingRoom
    if (hasGym !== undefined) updatedData.hasGym = hasGym
    if (hasFireSpace !== undefined) updatedData.hasFireSpace = hasFireSpace
    if (hasGala !== undefined) updatedData.hasGala = hasGala
    if (hasOpenStage !== undefined) updatedData.hasOpenStage = hasOpenStage
    if (hasLongShow !== undefined) updatedData.hasLongShow = hasLongShow
    if (hasConcert !== undefined) updatedData.hasConcert = hasConcert
    if (hasCantine !== undefined) updatedData.hasCantine = hasCantine
    if (hasAerialSpace !== undefined) updatedData.hasAerialSpace = hasAerialSpace
    if (hasSlacklineSpace !== undefined) updatedData.hasSlacklineSpace = hasSlacklineSpace
    if (hasUnicycleSpace !== undefined) updatedData.hasUnicycleSpace = hasUnicycleSpace
    if (hasToilets !== undefined) updatedData.hasToilets = hasToilets
    if (hasShowers !== undefined) updatedData.hasShowers = hasShowers
    if (hasPrmAccess !== undefined) updatedData.hasPrmAccess = hasPrmAccess
    if (hasSignLanguage !== undefined) updatedData.hasSignLanguage = hasSignLanguage
    if (hasWorkshops !== undefined) updatedData.hasWorkshops = hasWorkshops
    if (mealsEnabled !== undefined) updatedData.mealsEnabled = mealsEnabled
    // volunteersEnabled : déplacé vers EventVolunteerSettings (étape 0bis), géré après l'update
    if (artistsEnabled !== undefined) updatedData.artistsEnabled = artistsEnabled
    if (ticketingEnabled !== undefined) updatedData.ticketingEnabled = ticketingEnabled
    if (workshopsEnabled !== undefined) updatedData.workshopsEnabled = workshopsEnabled
    if (programEnabled !== undefined) updatedData.programEnabled = programEnabled
    if (workshopLocationsFreeInput !== undefined)
      updatedData.workshopLocationsFreeInput = workshopLocationsFreeInput
    if (siteMapEnabled !== undefined) updatedData.siteMapEnabled = siteMapEnabled
    if (tasksEnabled !== undefined) updatedData.tasksEnabled = tasksEnabled
    if (stockEnabled !== undefined) updatedData.stockEnabled = stockEnabled
    if (faqEnabled !== undefined) updatedData.faqEnabled = faqEnabled
    if (treasuryEnabled !== undefined) updatedData.treasuryEnabled = treasuryEnabled
    if (faqPagePublic !== undefined) updatedData.faqPagePublic = faqPagePublic
    if (programPagePublic !== undefined) updatedData.programPagePublic = programPagePublic
    if (hasATM !== undefined) updatedData.hasATM = hasATM
    if (hasCashPayment !== undefined) updatedData.hasCashPayment = hasCashPayment
    if (hasCreditCardPayment !== undefined) updatedData.hasCreditCardPayment = hasCreditCardPayment
    if (hasAfjTokenPayment !== undefined) updatedData.hasAfjTokenPayment = hasAfjTokenPayment

    // Si l'adresse a été modifiée, recalculer les coordonnées
    const addressChanged =
      addressLine1 !== undefined ||
      addressLine2 !== undefined ||
      city !== undefined ||
      postalCode !== undefined ||
      country !== undefined

    if (addressChanged) {
      const geoCoords = await geocodeEdition({
        addressLine1: addressLine1 || edition.addressLine1,
        addressLine2: addressLine2 !== undefined ? addressLine2 : (edition.addressLine2 ?? null),
        city: city || edition.city,
        postalCode: postalCode || edition.postalCode,
        country: country || edition.country,
      })

      updatedData.latitude = geoCoords.latitude
      updatedData.longitude = geoCoords.longitude
    }

    const updatedEdition = await prisma.edition.update({
      where: {
        id: editionId,
      },
      data: updatedData,
      include: {
        creator: {
          select: { id: true, pseudo: true },
        },
        favoritedBy: {
          select: { id: true },
        },
      },
    })

    // Étape 0bis : volunteersEnabled vit dans EventVolunteerSettings
    if (volunteersEnabled !== undefined) {
      await prisma.eventVolunteerSettings.upsert({
        where: { eventId: editionId },
        update: { enabled: volunteersEnabled },
        create: { eventId: editionId, enabled: volunteersEnabled },
      })
    }

    // Étape 0bis : répercuter nom/dates/statut sur l'Event (lu par les modules, ex. bénévoles).
    await syncEventMetadataFromEdition(editionId)

    // Invalider le cache après mise à jour
    await invalidateEditionCache(editionId)

    return createSuccessResponse(updatedEdition)
  },
  { operationName: 'UpdateEdition' }
)
