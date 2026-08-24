import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import ApplicationModal from '../../../../../../layers/volunteers/app/components/edition/volunteer/ApplicationModal.vue'

/**
 * Un refus de validation devait rester lisible dans le formulaire.
 *
 * Le point d'API renvoie depuis toujours le détail par champ (`data.errors`), mais la page ne
 * lisait que `error.message` — soit « Données invalides ». Un toast qui s'efface, sur un
 * formulaire d'une trentaine de champs, ne dit pas lequel reprendre. En production, quelqu'un
 * a réessayé trois fois en vingt-cinq secondes avant d'abandonner.
 *
 * Ce test monte la modale avec l'erreur telle que le serveur la rend, et vérifie qu'elle
 * s'affiche. Ni le lint ni le typecheck ne l'auraient vue : c'est une donnée jetée, pas une
 * erreur de type.
 */

// La modale charge les équipes au montage. Sans ce point d'API, la promesse rejetée fait
// échouer le fichier entier, sur un détail étranger à ce qu'on vérifie ici.
registerEndpoint('/api/editions/21/volunteer-teams', () => ({ teams: [] }))

const volunteersInfo = {
  // La modale ne se rend qu'en mode interne (`v-if` sur la racine) : sans ce champ, on
  // n'assertait que sur un commentaire vide.
  mode: 'INTERNAL',
  open: true,
  askDiet: false,
  askAllergies: false,
  askTimePreferences: false,
  askTeamPreferences: false,
  askPets: false,
  askMinors: false,
  askVehicle: false,
  askCompanion: false,
  askAvoidList: false,
  askSkills: false,
  askExperience: false,
  askEmergencyContact: false,
  askSetup: false,
  askTeardown: false,
} as never

const edition = { id: 21, startDate: '2026-07-10T08:00:00Z', endDate: '2026-07-13T18:00:00Z' }

const utilisateur = {
  id: '1',
  email: 'benevole@example.com',
  pseudo: 'benevole',
  nom: 'Nom',
  prenom: 'Prenom',
}

/**
 * `UModal` téléporte son contenu hors du composant : c'est le corps du document qu'il faut
 * lire, pas le HTML rendu par le composant lui-même.
 */
const monter = async (serverErrors: Record<string, string> | null) => {
  document.body.innerHTML = ''
  await mountSuspended(ApplicationModal, {
    props: {
      modelValue: true,
      volunteersInfo,
      edition,
      user: utilisateur,
      applying: false,
      serverErrors,
    } as never,
  })
  return document.body.innerHTML
}

describe('ApplicationModal — remontée des refus du serveur', () => {
  it('affiche dans le formulaire le refus portant sur le téléphone', async () => {
    const html = await monter({ phone: 'Format de téléphone invalide' })
    expect(html).toContain('Format de téléphone invalide')
  })

  it("traduit les noms de champs de l'API vers ceux du formulaire", async () => {
    // `submitVolunteerApplication` remappe `lastName → nom` : le serveur répond donc sur `nom`,
    // que le formulaire ne connaît pas. Sans alias, le refus reviendrait sans marqueur.
    const html = await monter({ nom: 'Nom trop long' })
    expect(html).toContain('Nom trop long')
  })

  it('pose un champ à indicatif de pays, comme la page de profil', async () => {
    const html = await monter(null)
    // `UiPhoneInput` affiche l'indicatif du pays retenu à côté du champ. Sa présence distingue
    // le champ composé du simple champ de texte qu'il remplace — c'est ce remplacement qui
    // normalise la saisie en E.164 et met fin aux refus sur un numéro collé.
    expect(html).toContain('+33')
  })

  it("n'affiche rien quand le serveur n'a rien refusé", async () => {
    const html = await monter(null)
    expect(html).not.toContain('Format de téléphone invalide')
  })
})
