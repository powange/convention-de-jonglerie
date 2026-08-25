import { wrapApiHandler } from '#server/utils/api-helpers'
import { canEditEditionById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { construireFriseProgramme } from '~~/shared/utils/program-timeline'

/**
 * Programme d'une édition : workshops, spectacles et éléments libres réunis en une seule frise.
 *
 * Route publique, mais qui s'adapte à qui la lit. Un organisateur y voit aussi les brouillons,
 * chaque entrée portant son état de publication : c'est la même lecture qui sert la page publique
 * et la page de composition, ce qui évite deux vues qui divergeraient à la première évolution.
 *
 * Chaque source reste soumise à son propre interrupteur : couper les workshops ou les artistes doit
 * les retirer du programme, sans quoi le module désactivé continuerait de s'afficher ailleurs.
 */
export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: {
        id: true,
        programEnabled: true,
        programPagePublic: true,
        workshopsEnabled: true,
        artistsEnabled: true,
        siteMapEnabled: true,
        mapPublic: true,
        timezone: true,
      },
    })

    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }

    if (!edition.programEnabled) {
      throw createError({
        status: 404,
        message: 'Le programme n’est pas activé pour cette édition',
      })
    }

    const user = event.context.user
    const peutEditer = user ? await canEditEditionById(editionId, user.id, event) : false

    /**
     * Un programme activé mais non publié ne se lit qu'en coulisses.
     *
     * On compose une frise pendant des semaines avant qu'elle ne mérite d'être montrée. Les
     * organisateurs y accèdent en aperçu — un bandeau les prévient —, les autres reçoivent le
     * même 404 que si le module était éteint : distinguer les deux dirait à un visiteur qu'il y
     * a quelque chose à voir, ce qui n'est pas son affaire.
     */
    if (!edition.programPagePublic && !peutEditer) {
      throw createError({
        status: 404,
        message: 'Le programme n’est pas public pour cette édition',
      })
    }

    /**
     * La couleur accompagne le nom : la frise de gestion affiche zones et repères sous forme
     * d'étiquettes colorées, comme la page des spectacles, et une pastille grise ne dirait rien
     * de l'endroit. Défini une fois pour les trois sources, qui doivent en dire autant.
     */
    const lieuDeCarte = { select: { id: true, name: true, color: true } }

    const [workshops, spectacles, elements] = await Promise.all([
      edition.workshopsEnabled
        ? prisma.workshop.findMany({
            where: { editionId },
            select: {
              id: true,
              title: true,
              description: true,
              startDateTime: true,
              endDateTime: true,
              location: { select: { name: true, zone: lieuDeCarte, marker: lieuDeCarte } },
            },
          })
        : [],
      edition.artistsEnabled
        ? // Le programme liste les représentations, pas les spectacles : un spectacle joué deux
          // fois occupe deux moments de la frise. Le filtre sur `isPublic` est posé ici plutôt
          // qu'à la fusion : inutile de faire remonter des passages non publiés à un visiteur.
          prisma.showPerformance.findMany({
            where: {
              show: { editionId },
              ...(peutEditer ? {} : { isPublic: true }),
            },
            select: {
              id: true,
              showId: true,
              startDateTime: true,
              location: true,
              zone: lieuDeCarte,
              marker: lieuDeCarte,
              isPublic: true,
              show: { select: { title: true, description: true, duration: true } },
            },
          })
        : [],
      prisma.editionProgramItem.findMany({
        where: { editionId, ...(peutEditer ? {} : { isPublic: true }) },
        select: {
          id: true,
          title: true,
          description: true,
          startDateTime: true,
          endDateTime: true,
          locationName: true,
          zone: lieuDeCarte,
          marker: lieuDeCarte,
          isPublic: true,
        },
      }),
    ])

    // Le titre et la durée viennent de l'œuvre, le reste du passage : la frise attend les deux
    // à plat.
    const representations = spectacles.map(({ show, ...performance }) => ({
      ...performance,
      title: show.title,
      description: show.description,
      duration: show.duration,
    }))

    const entrees = construireFriseProgramme(
      { workshops, spectacles: representations, elements },
      { inclureBrouillons: peutEditer }
    )

    return {
      success: true,
      data: {
        entrees,
        /** Permet à l'affichage de signaler les brouillons plutôt que de les mêler au reste. */
        inclutBrouillons: peutEditer,
        /**
         * Dit si un lieu peut renvoyer vers la carte du site. Rendu ici plutôt que déduit côté
         * client : l'édition n'y est chargée qu'après le montage, si bien que le rendu serveur
         * n'affichait aucun lien — ils n'apparaissaient qu'après coup, ou pas du tout.
         */
        carteConsultable: edition.siteMapEnabled && edition.mapPublic,
        /**
         * Dit à l'écran qu'il regarde une frise non publiée, pour qu'il puisse le signaler.
         * Rendu ici plutôt que déduit du client : l'édition n'y est chargée qu'après le montage.
         */
        pagePublique: edition.programPagePublic,
        /**
         * Fuseau de la convention, dans lequel les horaires doivent être lus et affichés.
         *
         * Rendu ici plutôt que pris sur l'édition côté client, pour la même raison que
         * `carteConsultable` : l'édition n'est chargée qu'après le montage, si bien que le rendu
         * serveur aurait formaté les heures dans le fuseau du serveur — UTC — avant de les voir
         * changer à l'hydratation.
         */
        fuseau: edition.timezone,
      },
    }
  },
  { operationName: 'Programme d’une édition' }
)
