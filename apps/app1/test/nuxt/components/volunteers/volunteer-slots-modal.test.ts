import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'

import VolunteerSlotsModal from '../../../../../../layers/volunteers/app/components/edition/volunteer/planning/VolunteerSlotsModal.vue'

/**
 * La modale « créneaux du bénévole », ouverte depuis la carte « Mes équipes » de la page publique.
 *
 * ⚠️ CE QUE CE TEST GARDE. Elle n'affichait **rien, pour personne** : le filtrage ne connaissait
 * que `assignedVolunteersList`, le nom que le planning de GESTION donne aux affectations après les
 * avoir recopiées, tandis que la page publique passe la réponse de l'API telle quelle —
 * `assignments`. Un responsable cliquait sur un membre et lisait « aucun créneau » alors qu'il en
 * avait. Aucune erreur, aucune trace : les deux formes portent le même sens et l'une était ignorée.
 *
 * 📍 Le test unitaire de `creneauxDuBenevole` éprouve le filtrage ; celui-ci éprouve le CÂBLAGE —
 * que la modale, nourrie comme le fait vraiment la page publique, rende bien des lignes.
 */

const ALICE = { id: 7, pseudo: 'alice' }

const creneauDeLApi = (id: string, debut: string, fin: string, userIds: number[]) => ({
  id,
  title: `Créneau ${id}`,
  startDateTime: debut,
  endDateTime: fin,
  teamId: 'equipe-1',
  assignments: userIds.map((userId) => ({ user: { id: userId } })),
  organizerAssignments: [],
})

const EQUIPES = [{ id: 'equipe-1', name: 'Accueil', color: '#ff0000' }]

/**
 * ⚠️ LE TEXTE SE LIT DANS `document.body`, PAS DANS LE MONTAGE. `UModal` téléporte son contenu
 * hors de l'arbre du composant : `composant.text()` rend la chaîne VIDE. Une première version de
 * ce fichier l'ignorait — et son second cas, qui attendait l'absence d'un créneau, était donc vert
 * pour la mauvaise raison : il n'y avait rien du tout à lire.
 */
const texteAffiche = () => document.body.textContent ?? ''

function monter(timeSlots: unknown[]) {
  return mountSuspended(VolunteerSlotsModal, {
    props: {
      modelValue: true,
      user: ALICE,
      timeSlots: timeSlots as never,
      teams: EQUIPES,
      formatDate: (d: string) => d,
      fuseau: 'Europe/Paris',
    },
  })
}

describe('VolunteerSlotsModal', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it("rend les créneaux de la personne nourris sous la forme de l'API", async () => {
    await monter([
      creneauDeLApi('a', '2026-10-02T09:00:00Z', '2026-10-02T11:00:00Z', [ALICE.id]),
      creneauDeLApi('b', '2026-10-02T14:00:00Z', '2026-10-02T16:00:00Z', [999]),
    ])

    const texte = texteAffiche()
    expect(texte).toContain('Créneau a')
    // Celui d'une autre personne n'y est pas : le filtrage opère, il n'est pas court-circuité.
    expect(texte).not.toContain('Créneau b')
    // Et surtout pas l'état vide, qui était le symptôme.
    expect(texte).not.toContain('no_slot_assigned_yet')
  })

  it("annonce l'absence de créneau quand la personne n'en a réellement aucun", async () => {
    await monter([creneauDeLApi('b', '2026-10-02T14:00:00Z', '2026-10-02T16:00:00Z', [999])])

    const texte = texteAffiche()
    expect(texte).not.toContain('Créneau b')
    // Et l'état vide est bien DIT : un corps vide ne se distinguerait pas d'une panne.
    expect(texte).toContain('no_slot_assigned_yet')
  })
})
