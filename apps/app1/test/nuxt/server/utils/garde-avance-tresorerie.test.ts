import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  assertPersonneRattacheeALEdition,
  clausesDesPersonnesRattachees,
} from '#server/utils/treasury-guards'

const prismaMock = (globalThis as any).prisma

/**
 * Qui peut être désigné comme ayant avancé de l'argent pour une édition.
 *
 * ## Le défaut que ces tests ferment
 *
 * Le périmètre — organisateurs de la convention, bénévoles ACCEPTÉS, artistes programmés —
 * n'existait que dans `advance-candidates.get.ts`, le point d'API qui PROPOSE la liste. Les quatre
 * points qui ENREGISTRENT (création et modification d'une ligne de trésorerie, création et
 * modification d'un apport au fonds de caisse) ne validaient l'identifiant que comme entier
 * positif : le contrat laissait rattacher une avance à n'importe quel compte du site, et un
 * identifiant inexistant faisait rendre 500 par une violation de clé étrangère Prisma.
 *
 * ## ⚠️ POURQUOI LA FORME DES REQUÊTES EST ASSERTÉE, ET PAS SEULEMENT LE VERDICT
 *
 * Le mock central de Prisma IGNORE le `where` : il rend ce qu'on lui a dit de rendre, quelle que
 * soit la requête. Un test qui ne mesure que « passe / refuse » resterait donc intégralement VERT
 * au-dessus d'une garde qui aurait oublié son périmètre et se contenterait de vérifier que le
 * compte existe — c'est-à-dire au-dessus du défaut d'origine, à un `userId` près. Les assertions
 * sur le `where` sont les seules ici qui ne sont pas creuses.
 */
describe("garde sur la personne ayant avancé l'argent", () => {
  const EDITION = 7
  const CONVENTION = 42
  const PERSONNE = 101

  /** Rien trouvé nulle part : le cas « ce compte n'est pas de cette édition ». */
  const personneIntrouvable = () => {
    prismaMock.conventionOrganizer.findFirst.mockResolvedValue(null)
    prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue(null)
    prismaMock.editionArtist.findFirst.mockResolvedValue(null)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.edition.findUnique.mockResolvedValue({ conventionId: CONVENTION })
    personneIntrouvable()
  })

  describe('les absences, qui sont légitimes', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
    ])(
      "accepte %s sans interroger la base : une dépense que personne n'a avancée est le cas courant",
      async (_libelle, valeur) => {
        await expect(
          assertPersonneRattacheeALEdition(EDITION, valeur as null | undefined)
        ).resolves.toBeUndefined()
        expect(prismaMock.edition.findUnique).not.toHaveBeenCalled()
        expect(prismaMock.conventionOrganizer.findFirst).not.toHaveBeenCalled()
      }
    )
  })

  describe('les trois appartenances qui ouvrent le droit', () => {
    it('accepte un organisateur de la convention', async () => {
      prismaMock.conventionOrganizer.findFirst.mockResolvedValue({ userId: PERSONNE })
      await expect(assertPersonneRattacheeALEdition(EDITION, PERSONNE)).resolves.toBeUndefined()
    })

    it('accepte un bénévole de l’édition', async () => {
      prismaMock.editionVolunteerApplication.findFirst.mockResolvedValue({ userId: PERSONNE })
      await expect(assertPersonneRattacheeALEdition(EDITION, PERSONNE)).resolves.toBeUndefined()
    })

    it('accepte un artiste programmé', async () => {
      prismaMock.editionArtist.findFirst.mockResolvedValue({ userId: PERSONNE })
      await expect(assertPersonneRattacheeALEdition(EDITION, PERSONNE)).resolves.toBeUndefined()
    })
  })

  describe('les refus', () => {
    it('refuse en 400 un compte étranger à l’édition, et le dit', async () => {
      await expect(assertPersonneRattacheeALEdition(EDITION, PERSONNE)).rejects.toMatchObject({
        statusCode: 400,
        message: "Cette personne n'est pas rattachée à cette édition",
      })
    })

    it("refuse en 400 un identifiant qui n'existe pas du tout — c'était un 500 de Prisma", async () => {
      await expect(assertPersonneRattacheeALEdition(EDITION, 999_999)).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('refuse en 404 une édition introuvable', async () => {
      prismaMock.edition.findUnique.mockResolvedValue(null)
      await expect(assertPersonneRattacheeALEdition(EDITION, PERSONNE)).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })

  /*
   * ⚠️ LES ASSERTIONS QUI COMPTENT. Voir l'en-tête : sans elles, une garde qui demanderait
   * seulement « ce compte existe-t-il ? » passerait tous les tests ci-dessus.
   */
  describe('la forme des requêtes : le périmètre doit y être', () => {
    beforeEach(async () => {
      await assertPersonneRattacheeALEdition(EDITION, PERSONNE).catch(() => {})
    })

    it('borne les organisateurs à la convention de l’édition, et à cette personne', () => {
      expect(prismaMock.conventionOrganizer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { conventionId: CONVENTION, userId: PERSONNE } })
      )
    })

    it("n'accepte que les bénévoles ACCEPTED de cette édition", () => {
      expect(prismaMock.editionVolunteerApplication.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventId: EDITION, status: 'ACCEPTED', userId: PERSONNE },
        })
      )
    })

    it('borne les artistes à cette édition, et à cette personne', () => {
      expect(prismaMock.editionArtist.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { editionId: EDITION, userId: PERSONNE } })
      )
    })

    it('relit la convention depuis l’édition de l’URL, jamais depuis le corps de la requête', () => {
      expect(prismaMock.edition.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: EDITION } })
      )
    })
  })

  /*
   * La définition partagée, éprouvée pour elle-même : c'est elle que consomment À LA FOIS la garde
   * ci-dessus et `advance-candidates.get.ts`. Une liste et une garde qui répondraient autrement à
   * « qui peut avoir avancé cet argent ? » reproduiraient le défaut d'un cran plus loin.
   */
  describe('clausesDesPersonnesRattachees', () => {
    const clauses = clausesDesPersonnesRattachees(EDITION, CONVENTION)

    it('exige le statut ACCEPTED pour les bénévoles', () => {
      // Un bénévole en attente ou refusé n'est pas quelqu'un de l'édition : le lister ouvrirait la
      // confidentialité que la recherche par email exact protège délibérément.
      expect(clauses.benevoles).toEqual({ eventId: EDITION, status: 'ACCEPTED' })
    })

    it('rattache les organisateurs à la convention, et les artistes à l’édition', () => {
      // Les deux portées DIFFÈRENT, et ce n'est pas une inattention : un organisateur l'est pour
      // toute la convention, un artiste est programmé sur une édition précise.
      expect(clauses.organisateurs).toEqual({ conventionId: CONVENTION })
      expect(clauses.artistes).toEqual({ editionId: EDITION })
    })
  })
})
