import { describe, it, expect } from 'vitest'

import {
  benevoleAccepteEtPresentSurPlace,
  benevolePresentSurPlace,
} from '../../../server/utils/ticketing/benevoles-presents'

/**
 * La règle « bénévole présent sur place », partagée.
 *
 * ⚠️ POURQUOI ELLE EST PARTAGÉE, et ce que cela a réparé. Elle était recopiée SIX fois dans le
 * dépôt — trois dans `ticketing/stats.get.ts`, une dans `ticketing/verify.post.ts`, une dans
 * `ticketing/volunteers-not-validated.get.ts`, une dans `ticketing/search.post.ts`. L'énoncé du
 * lot en annonçait quatre : une règle recopiée l'est toujours plus de fois qu'annoncé.
 *
 * Et elle MANQUAIT dans `my-tickets.get.ts`, qui émettait donc un badge de bénévole — avec son QR
 * code — pour quelqu'un qui a explicitement dit ne pas être là pendant l'événement. Le guichet,
 * lui, appliquait bien la règle et refusait le badge au scan. Les deux surfaces répondaient à la
 * même question et se contredisaient : la personne se présente avec un billet que l'application
 * lui a donné, et s'entend dire qu'il n'est pas valable.
 *
 * 🔬 CE QUE CES TESTS MESURENT est la FORME du fragment Prisma, pas son effet sur une base. C'est
 * le seul niveau où la règle se vérifie sans données : ce qui compte est qu'elle distingue `false`
 * de `null`, et cette distinction se lit dans le `where`.
 */

describe('benevolePresentSurPlace', () => {
  it('🔬 retient aussi le bénévole du MONTAGE ou du DÉMONTAGE', () => {
    /*
     * ⚠️ SIGNALÉ SUR LA BASE DE DÉVELOPPEMENT : une bénévole acceptée, cherchée au contrôle d'accès
     * par son prénom, son nom et son adresse, ne ressortait pas. Elle avait répondu « non » à la
     * présence PENDANT l'événement et « oui » au montage. Cinq bénévoles acceptés dans ce cas sur
     * cette édition, neuf toutes éditions confondues.
     *
     * Elle est pourtant physiquement là, et il faut bien la faire entrer. La règle ne regardait
     * que `eventAvailability` : c'est ce que ce cas corrige, et il échoue si on y revient.
     */
    const fragment = benevolePresentSurPlace()

    expect(fragment.OR).toContainEqual({ setupAvailability: true })
    expect(fragment.OR).toContainEqual({ teardownAvailability: true })
  })

  it('accepte `true` ET `null`, jamais `false`', () => {
    /*
     * ⚠️ LA DISTINCTION QUI PORTE TOUT LE LOT. `null` veut dire « on ne lui a pas posé la
     * question » — la colonne a été ajoutée après coup, et les candidatures antérieures la portent
     * à `null`. `false` veut dire « il a répondu non ».
     *
     * Les confondre dans un seul test de vérité (`eventAvailability: { not: false }` aurait l'air
     * équivalent) rouvrirait le défaut dans un sens ou dans l'autre : soit on retire leur badge à
     * des bénévoles historiques, soit on en donne un à quelqu'un qui a dit ne pas venir.
     */
    const fragment = benevolePresentSurPlace()

    expect(fragment.OR).toContainEqual({ eventAvailability: true })
    expect(fragment.OR).toContainEqual({ eventAvailability: null })
    /*
     * ⚠️ `false` N'APPARAÎT NULLE PART, et c'est ce qui survit à l'élargissement : celui qui a
     * répondu « non » aux TROIS questions reste écarté. Sans cette borne, « présent sur place »
     * finirait par vouloir dire « accepté », et le réglage ne servirait plus à rien.
     */
    expect(JSON.stringify(fragment)).not.toContain('false')
  })

  it('rend un objet NEUF à chaque appel', () => {
    /*
     * Une constante partagée serait le même objet en mémoire pour tous les appelants. Ni Prisma ni
     * un `where` composé par étalement n'en font rien de dangereux — mais une modification
     * accidentelle sur place se propagerait aux six surfaces d'un coup, et le défaut apparaîtrait
     * loin de sa cause.
     */
    const a = benevolePresentSurPlace()
    const b = benevolePresentSurPlace()

    expect(a).not.toBe(b)
    expect(a.OR).not.toBe(b.OR)
    expect(a).toEqual(b)
  })
})

describe('benevoleAccepteEtPresentSurPlace', () => {
  it('porte l’édition, le statut ACCEPTÉ et la présence', () => {
    // Les six recopies écrivaient toutes ces trois conditions ensemble.
    expect(benevoleAccepteEtPresentSurPlace(42)).toEqual({
      eventId: 42,
      status: 'ACCEPTED',
      OR: [
        { eventAvailability: true },
        { eventAvailability: null },
        { setupAvailability: true },
        { teardownAvailability: true },
      ],
    })
  })

  it('emploie `eventId`, PAS `editionId`', () => {
    /*
     * `EditionVolunteerApplication` nomme sa clé `eventId`, pas `editionId` — et un `where` Prisma
     * portant un champ inexistant fait échouer la requête ENTIÈRE. Le piège s'est déjà produit
     * dans ce dépôt, sur les conversations d'équipe.
     */
    const où = benevoleAccepteEtPresentSurPlace(7) as Record<string, unknown>

    expect(où.eventId).toBe(7)
    expect(où).not.toHaveProperty('editionId')
  })

  it('s’étale sans écraser les conditions voisines', () => {
    // La forme d'emploi réelle : `{ userId, ...benevoleAccepteEtPresentSurPlace(id) }`. Aucune de ses clés
    // ne doit entrer en collision avec celles qu'un appelant ajoute.
    const où = { userId: 3, entryValidated: false, ...benevoleAccepteEtPresentSurPlace(42) }

    expect(où.userId).toBe(3)
    expect(où.entryValidated).toBe(false)
    expect(où.eventId).toBe(42)
  })
})
