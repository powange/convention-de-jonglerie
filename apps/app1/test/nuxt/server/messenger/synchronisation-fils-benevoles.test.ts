import { describe, it, expect, beforeEach, vi } from 'vitest'

import { synchroniserApresChangementDeDroits } from '../../../../server/utils/messenger-droits-benevoles'
import { synchroniserParticipantsDesFilsDeBenevoles } from '../../../../server/utils/messenger-helpers'

const prismaMock = (globalThis as any).prisma

/**
 * Les fils « bénévole ↔ organisateurs » suivent les droits.
 *
 * ⚠️ LE DÉFAUT ÉTAIT UNE FUITE DE CONTRÔLE D'ACCÈS, et rien ne le signalait. La liste des
 * participants d'un fil est un INSTANTANÉ, pris à sa création.
 * `ensureVolunteerToOrganizersConversation` ajoute les organisateurs habilités et réactive ceux
 * qui étaient partis — mais ne retire JAMAIS celui qui a perdu le droit.
 *
 * La dérive était donc à SENS UNIQUE : celui qui GAGNE le droit finit par être ajouté au prochain
 * passage du bénévole dans son fil ; celui qui le PERD reste, et continue de lire les messages
 * privés des bénévoles aux organisateurs. Ni erreur, ni journal — seulement un fil qui reste
 * ouvert dans sa messagerie.
 *
 * ⚠️⚠️ CE QUI REND CE LOT DÉLICAT, et pourquoi `volunteerId` a dû être ajouté : les participants
 * sont le bénévole ET les organisateurs, MÉLANGÉS, et un organisateur peut lui-même être bénévole
 * de l'édition. Retirer « ceux qui ne sont pas organisateurs habilités » aurait coupé le bénévole
 * de sa PROPRE conversation, en silence. Deux tests ci-dessous existent uniquement pour interdire
 * cette solution-là.
 */

const CONVENTION = 9
const EDITION = 42

/** Un participant du fil. */
const participant = (id: string, userId: number, leftAt: Date | null = null) => ({
  id,
  userId,
  leftAt,
})

describe('synchroniserParticipantsDesFilsDeBenevoles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.edition.findUnique.mockResolvedValue({ conventionId: CONVENTION })
    // Seul l'organisateur 10 a encore le droit de gérer les bénévoles.
    prismaMock.conventionOrganizer.findMany.mockResolvedValue([{ userId: 10 }])
    prismaMock.conversationParticipant.update.mockResolvedValue({})
  })

  it('RETIRE l’organisateur dont le droit a été révoqué', async () => {
    /*
     * 🔬 Le cœur du lot. L'organisateur 11 n'est plus habilité : il doit quitter le fil. `leftAt`
     * et non une suppression — l'historique reste lisible pour ceux qui y ont écrit, et le
     * contrôle d'accès lit ce champ.
     */
    prismaMock.conversation.findMany.mockResolvedValue([
      {
        id: 'fil-1',
        volunteerId: 7,
        participants: [participant('p-benevole', 7), participant('p-11', 11)],
      },
    ])

    const bilan = await synchroniserParticipantsDesFilsDeBenevoles(EDITION)

    expect(bilan.retires).toBe(1)
    expect(prismaMock.conversationParticipant.update).toHaveBeenCalledWith({
      where: { id: 'p-11' },
      data: { leftAt: expect.any(Date) },
    })
  })

  it('n’EXPULSE JAMAIS le bénévole de son propre fil', async () => {
    /*
     * ⚠️ LE TEST QUI INTERDIT LA SOLUTION NAÏVE. Le bénévole n'est pas organisateur — c'est même la
     * définition — donc un filtre « garder les organisateurs habilités » le retirerait. Il
     * perdrait l'accès à sa propre conversation sans le moindre message.
     */
    prismaMock.conversation.findMany.mockResolvedValue([
      {
        id: 'fil-1',
        volunteerId: 7,
        participants: [participant('p-benevole', 7), participant('p-10', 10)],
      },
    ])

    const bilan = await synchroniserParticipantsDesFilsDeBenevoles(EDITION)

    expect(bilan.retires).toBe(0)
    expect(prismaMock.conversationParticipant.update).not.toHaveBeenCalled()
  })

  it('garde un organisateur RÉVOQUÉ qui est le bénévole de CE fil', async () => {
    /*
     * ⚠️ LE CAS QUI FAIT TOUTE LA DIFFICULTÉ. Quelqu'un peut être organisateur de la convention ET
     * bénévole de l'édition. S'il perd le droit de gérer les bénévoles, il doit quitter les fils
     * des AUTRES — mais rester dans le sien.
     *
     * C'est `volunteerId` qui permet de faire la différence ; sans lui, il n'y avait aucun moyen
     * de distinguer les deux situations, et c'est pour cela que la colonne a été ajoutée.
     */
    prismaMock.conversation.findMany.mockResolvedValue([
      {
        id: 'son-fil',
        volunteerId: 11,
        participants: [participant('p-11', 11), participant('p-10', 10)],
      },
    ])

    const bilan = await synchroniserParticipantsDesFilsDeBenevoles(EDITION)

    expect(bilan.retires).toBe(0)
    expect(prismaMock.conversationParticipant.update).not.toHaveBeenCalled()
  })

  it('RÉINTÈGRE celui qui retrouve le droit', async () => {
    /*
     * Le sens inverse, et il n'est pas gratuit : sans lui, quelqu'un réhabilité devrait attendre
     * que le bénévole repasse dans son fil pour y revenir — et il n'y repasse pas forcément.
     */
    prismaMock.conversation.findMany.mockResolvedValue([
      {
        id: 'fil-1',
        volunteerId: 7,
        participants: [participant('p-benevole', 7), participant('p-10', 10, new Date())],
      },
    ])

    const bilan = await synchroniserParticipantsDesFilsDeBenevoles(EDITION)

    expect(bilan.reintegres).toBe(1)
    expect(prismaMock.conversationParticipant.update).toHaveBeenCalledWith({
      where: { id: 'p-10' },
      data: { leftAt: null },
    })
  })

  it('n’écrit RIEN quand tout est déjà en accord', async () => {
    // Cette fonction est appelée à chaque modification de droits, sur toutes les éditions d'une
    // convention : elle ne doit pas produire d'écriture inutile à chaque passage.
    prismaMock.conversation.findMany.mockResolvedValue([
      {
        id: 'fil-1',
        volunteerId: 7,
        participants: [participant('p-benevole', 7), participant('p-10', 10)],
      },
    ])

    await synchroniserParticipantsDesFilsDeBenevoles(EDITION)

    expect(prismaMock.conversationParticipant.update).not.toHaveBeenCalled()
  })

  it('ne demande QUE les fils dont le propriétaire est connu', async () => {
    /*
     * ⚠️ UN FIL SANS `volunteerId` EST ÉPARGNÉ, délibérément. La migration de rattrapage s'est
     * abstenue là où la déduction était ambiguë ; y synchroniser les participants reviendrait à
     * DEVINER qui est le bénévole, avec le risque de le couper de sa conversation.
     *
     * La fuite y persiste — c'est le prix assumé —, et elle se referme d'elle-même dès que le
     * bénévole repasse dans son fil, ce qui inscrit son identité.
     *
     * 🔬 Assertion sur la FORME de la requête : le mock rend ce qu'on lui dit, donc seul le `where`
     * dit si les fils sans propriétaire sont bien écartés.
     */
    prismaMock.conversation.findMany.mockResolvedValue([])

    await synchroniserParticipantsDesFilsDeBenevoles(EDITION)

    const où = prismaMock.conversation.findMany.mock.calls[0][0].where
    expect(où.volunteerId).toEqual({ not: null })
    expect(où.type).toBe('VOLUNTEER_TO_ORGANIZERS')
    expect(où.editionId).toBe(EDITION)
  })

  it('emploie la MÊME définition d’« habilité » que l’ajout', async () => {
    /*
     * ⚠️ Deux définitions divergentes produiraient un va-et-vient : retiré par la synchronisation,
     * réintégré par `ensureVolunteerToOrganizersConversation` au passage suivant du bénévole, et
     * ainsi de suite. Le droit se lit sur la convention OU sur l'édition.
     */
    prismaMock.conversation.findMany.mockResolvedValue([])

    await synchroniserParticipantsDesFilsDeBenevoles(EDITION)

    const où = prismaMock.conventionOrganizer.findMany.mock.calls[0][0].where
    expect(où.conventionId).toBe(CONVENTION)
    expect(où.OR).toEqual([
      { canManageVolunteers: true },
      { perEditionPermissions: { some: { editionId: EDITION, canManageVolunteers: true } } },
    ])
  })

  it('ne fait rien pour une édition introuvable', async () => {
    prismaMock.edition.findUnique.mockResolvedValue(null)

    const bilan = await synchroniserParticipantsDesFilsDeBenevoles(EDITION)

    expect(bilan).toEqual({ retires: 0, reintegres: 0 })
    expect(prismaMock.conversation.findMany).not.toHaveBeenCalled()
  })
})

/**
 * La synchronisation déclenchée par un changement de droits ne doit JAMAIS faire échouer le point
 * d'API qui l'appelle.
 *
 * ⚠️ UNE PREMIÈRE VERSION NE TENAIT PAS CETTE PROMESSE, alors que son commentaire l'affirmait :
 * seule la boucle sur les éditions était protégée, pas la LECTURE de ces éditions. Une base
 * indisponible à cet instant faisait donc remonter une 500 sur une modification de droits DÉJÀ
 * ENREGISTRÉE — l'administrateur voyait échouer une opération réussie, et la relançait.
 *
 * Ce sont les tests des deux points d'API concernés qui l'ont montré, avant la mise en ligne.
 * Ceux-ci figent la garantie à sa source, pour qu'elle ne dépende plus d'eux.
 */
describe('synchroniserApresChangementDeDroits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('n’échoue PAS quand les éditions sont illisibles', async () => {
    prismaMock.edition.findMany.mockRejectedValue(new Error('base indisponible'))

    await expect(synchroniserApresChangementDeDroits(CONVENTION)).resolves.toBeUndefined()
  })

  it('n’échoue PAS quand une édition ne peut pas être synchronisée', async () => {
    /*
     * Et les SUIVANTES sont tout de même traitées : laisser la moitié des éditions non
     * synchronisées serait pire que d'en manquer une seule.
     */
    prismaMock.edition.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }])
    prismaMock.edition.findUnique
      .mockRejectedValueOnce(new Error('panne passagère'))
      .mockResolvedValue({ conventionId: CONVENTION })
    prismaMock.conventionOrganizer.findMany.mockResolvedValue([])
    prismaMock.conversation.findMany.mockResolvedValue([])

    await expect(synchroniserApresChangementDeDroits(CONVENTION)).resolves.toBeUndefined()

    // La seconde édition a bien été tentée malgré l'échec de la première.
    expect(prismaMock.conversation.findMany).toHaveBeenCalledTimes(1)
  })

  it('traite TOUTES les éditions de la convention', async () => {
    /*
     * ⚠️ On synchronise LARGE, et c'est délibéré : le droit de gérer les bénévoles peut être
     * GLOBAL à la convention, auquel cas il vaut pour toutes ses éditions d'un coup. Ne traiter
     * que les éditions citées dans le corps de la requête laisserait la fuite ouverte partout
     * ailleurs — c'est-à-dire là où l'on croirait précisément l'avoir fermée.
     */
    prismaMock.edition.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }])
    prismaMock.edition.findUnique.mockResolvedValue({ conventionId: CONVENTION })
    prismaMock.conventionOrganizer.findMany.mockResolvedValue([])
    prismaMock.conversation.findMany.mockResolvedValue([])

    await synchroniserApresChangementDeDroits(CONVENTION)

    expect(prismaMock.conversation.findMany).toHaveBeenCalledTimes(3)
  })
})
