import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import ArtistDetailsCard from '../../../../../../layers/ticketing/app/components/ticketing/ArtistDetailsCard.vue'
import VolunteerDetailsCard from '../../../../../../layers/ticketing/app/components/ticketing/VolunteerDetailsCard.vue'

/**
 * Les horaires de la modale « détail du participant », au contrôle d'accès.
 *
 * ⚠️ CE QUE CES CAS GARDENT. Les créneaux d'un bénévole et les représentations d'un artiste
 * s'affichaient par `new Date(x).toLocaleString('fr-FR', …)` : langue figée pour tout le monde, et
 * surtout heure lue dans le fuseau du NAVIGATEUR. Au guichet d'une convention à l'étranger — ou
 * pour un organisateur en déplacement — les horaires étaient décalés, sans rien qui le signale.
 *
 * 🔬 L'ÉPREUVE EST LE DÉCALAGE, pas un libellé. Comparer à une chaîne attendue dépendrait de la
 * locale de l'environnement de test, ce qui a déjà fait tomber une CI dans cette session. Deux
 * fuseaux éloignés doivent produire deux rendus DIFFÉRENTS : c'est faux tant que la prop est
 * ignorée, et ça ne peut pas devenir vrai par accident.
 */

/** 1er août 2026, 22 h UTC : minuit à Paris le 2, 10 h du matin à Auckland le 2 — trois jours. */
const INSTANT = '2026-08-01T22:00:00.000Z'
const FIN = '2026-08-01T23:30:00.000Z'

const UTILISATEUR = {
  id: 1,
  firstName: 'Alice',
  lastName: 'Martin',
  email: 'alice@example.test',
  phone: null,
  isEmailVerified: true,
}

const BENEVOLE = {
  id: 1,
  user: UTILISATEUR,
  teams: [],
  timeSlots: [
    { id: 1, title: 'Accueil', team: 'Accueil', startDateTime: INSTANT, endDateTime: FIN },
  ],
}

const ARTISTE = {
  id: 2,
  user: { ...UTILISATEUR, id: 2, firstName: 'Bob' },
  shows: [
    {
      id: 1,
      title: 'Jonglerie',
      performances: [{ id: 1, startDateTime: INSTANT, location: 'Chapiteau' }],
    },
  ],
}

/** Les champs modifiables du formulaire, requis par les deux cartes. */
const CHAMPS = {
  editableFirstName: 'Alice',
  editableLastName: 'Martin',
  editableEmail: 'alice@example.test',
  editablePhone: null,
}

async function rendu(composant: unknown, donnees: Record<string, unknown>, fuseau: string) {
  const monte = await mountSuspended(composant as never, {
    props: { ...CHAMPS, ...donnees, fuseau },
  })
  return monte.text()
}

describe('fuseau des cartes du contrôle d’accès', () => {
  it("affiche les créneaux d'un bénévole dans le fuseau de l'édition", async () => {
    const auckland = await rendu(VolunteerDetailsCard, { volunteer: BENEVOLE }, 'Pacific/Auckland')
    const losAngeles = await rendu(
      VolunteerDetailsCard,
      { volunteer: BENEVOLE },
      'America/Los_Angeles'
    )

    expect(auckland).not.toBe(losAngeles)
    // Et l'heure n'est pas celle du navigateur qui fait tourner le test.
    expect(auckland).not.toContain(
      new Date(INSTANT).toLocaleString('fr-FR', { timeStyle: 'short' })
    )
  })

  it("affiche les représentations d'un artiste dans le fuseau de l'édition", async () => {
    // Même modale, même défaut, à un clic de là : la correction vaut pour les deux cartes.
    const auckland = await rendu(ArtistDetailsCard, { artist: ARTISTE }, 'Pacific/Auckland')
    const losAngeles = await rendu(ArtistDetailsCard, { artist: ARTISTE }, 'America/Los_Angeles')

    expect(auckland).not.toBe(losAngeles)
  })
})
