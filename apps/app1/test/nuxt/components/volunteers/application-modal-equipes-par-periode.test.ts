import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import ApplicationModal from '../../../../../../layers/volunteers/app/components/edition/volunteer/ApplicationModal.vue'

/**
 * Les équipes préférées suivent les périodes de présence annoncées.
 *
 * Une équipe n'intervient pas forcément sur toute la convention. Demander à quelqu'un qui ne vient
 * qu'au montage s'il préfère l'équipe de plonge du dimanche soir n'a pas de sens, et son choix
 * n'aurait servi à personne.
 *
 * Le jeu d'équipes est choisi pour qu'un cas puisse ne RIEN proposer — c'est la situation demandée
 * explicitement, où le champ disparaît. Aucune des deux équipes ne couvre le montage.
 */

const ACCUEIL = {
  id: 'accueil',
  name: 'Accueil E2E-unit',
  isRequired: false,
  isVisibleToVolunteers: true,
  coversSetup: false,
  coversEvent: true,
  coversTeardown: false,
}
/** Obligatoire, et pourtant absente au montage : c'est là que se joue le cas intéressant. */
const PLONGE = {
  id: 'plonge',
  name: 'Plonge E2E-unit',
  isRequired: true,
  isVisibleToVolunteers: true,
  coversSetup: false,
  coversEvent: false,
  coversTeardown: true,
}

registerEndpoint('/api/editions/21/volunteer-teams', () => [ACCUEIL, PLONGE])

const volunteersInfo = {
  mode: 'INTERNAL',
  open: true,
  askTeamPreferences: true,
  askDiet: false,
  askAllergies: false,
  askTimePreferences: false,
  askPets: false,
  askMinors: false,
  askVehicle: false,
  askCompanion: false,
  askAvoidList: false,
  askSkills: false,
  askExperience: false,
  askEmergencyContact: false,
  askSetup: true,
  askTeardown: true,
} as never

const edition = { id: 21, startDate: '2026-07-10T08:00:00Z', endDate: '2026-07-13T18:00:00Z' }

const utilisateur = {
  id: '1',
  email: 'benevole@example.com',
  pseudo: 'benevole',
  nom: 'Nom',
  prenom: 'Prenom',
  phone: '+33711111111',
}

/**
 * Monter ET attendre le chargement des équipes.
 *
 * Le composable les récupère par `$fetch` après le montage : lire la liste tout de suite la trouve
 * vide, et les assertions passent alors à vide — ce qui est arrivé, sur trois tests d'un coup.
 * L'attente se termine donc par une affirmation : sans les deux équipes, rien de ce qui suit ne
 * prouve quoi que ce soit.
 */
const monterEtAttendre = async () => {
  const composant = await monter()
  const vm = composant.vm as any
  for (let i = 0; i < 100 && (vm.volunteerTeams?.length ?? 0) === 0; i++) {
    await new Promise((resoudre) => setTimeout(resoudre, 10))
    await nextTick()
  }
  expect(vm.volunteerTeams, 'les équipes ne sont jamais arrivées').toHaveLength(2)
  return composant
}

const monter = async () => {
  document.body.innerHTML = ''
  return mountSuspended(ApplicationModal, {
    props: {
      modelValue: true,
      volunteersInfo,
      edition,
      user: utilisateur,
      applying: false,
      serverErrors: null,
    } as never,
  })
}

/**
 * Poser les TROIS disponibilités, jamais une seule.
 *
 * `eventAvailability` vaut `true` à l'ouverture, et le formulaire la force même à `true` quand la
 * présence pendant l'événement n'est pas facultative sur l'édition (ApplicationModal.vue:738 et
 * :1443). N'en poser qu'une laissait donc les autres dans un état hérité, et deux de ces tests
 * mesuraient autre chose que ce qu'ils annonçaient.
 *
 * Corollaire à retenir : « je ne viens qu'au montage » n'est atteignable que sur une édition où la
 * présence pendant l'événement est facultative.
 */
const cocher = async (vm: any, montage: boolean, evenement: boolean, demontage: boolean) => {
  Object.assign(vm.formData, {
    setupAvailability: montage,
    eventAvailability: evenement,
    teardownAvailability: demontage,
  })
  await nextTick()
  await nextTick()
}

const idsProposes = (vm: any) => (vm.equipesProposees as { id: string }[]).map((e) => e.id)

describe('ApplicationModal — équipes proposées selon les périodes', () => {
  it('propose toutes les équipes tant qu’aucune période n’est cochée', async () => {
    // Le formulaire s'ouvre vierge : filtrer ici viderait la liste et ferait disparaître le champ
    // avant que le candidat ait dit quand il vient.
    const composant = await monterEtAttendre()

    await cocher(composant.vm, false, false, false)

    expect(idsProposes(composant.vm)).toEqual(['accueil', 'plonge'])
  })

  it('ne propose que les équipes de la période annoncée', async () => {
    const composant = await monterEtAttendre()
    const vm = composant.vm as any

    await cocher(vm, false, true, false)

    expect(idsProposes(vm)).toEqual(['accueil'])
  })

  it('impose l’équipe obligatoire quand elle recoupe bien les périodes', async () => {
    const composant = await monterEtAttendre()
    const vm = composant.vm as any

    await cocher(vm, false, false, true)

    expect(vm.formData.teamPreferences).toContain('plonge')
  })

  it('n’impose pas une équipe obligatoire hors des périodes du bénévole', async () => {
    /*
     * « Plonge » est obligatoire mais n'existe qu'au démontage. L'ajouter d'office à quelqu'un qui
     * ne vient qu'au montage le placerait là où il ne sera pas — et le serveur refuserait l'envoi
     * sur un champ qui ne lui est même pas montré.
     */
    const composant = await monterEtAttendre()
    const vm = composant.vm as any

    await cocher(vm, true, false, false)

    expect(vm.formData.teamPreferences).not.toContain('plonge')
  })

  it('retire une équipe choisie quand sa période est décochée', async () => {
    /*
     * Le comportement qui coûte le plus cher s'il manque : le champ ne montre plus ce choix, mais
     * le serveur le refuse. L'envoi échouerait sur une case invisible.
     */
    const composant = await monterEtAttendre()
    const vm = composant.vm as any

    await cocher(vm, false, true, false)
    vm.formData.teamPreferences = [...new Set([...vm.formData.teamPreferences, 'accueil'])]
    await nextTick()
    expect(vm.formData.teamPreferences).toContain('accueil')

    // Le bénévole se rétracte : il ne vient finalement qu'au démontage.
    await cocher(vm, false, false, true)

    expect(vm.formData.teamPreferences).not.toContain('accueil')
  })

  it('masque le champ quand aucune équipe ne correspond', async () => {
    // Aucune des deux équipes ne couvre le montage : la liste est vide, et le champ disparaît
    // plutôt que d'afficher un intitulé au-dessus de rien.
    const composant = await monterEtAttendre()
    const vm = composant.vm as any

    await cocher(vm, true, false, false)

    expect(idsProposes(vm)).toEqual([])
    // Les noms d'équipe sont des données, pas des traductions : l'assertion tient quelle que soit
    // la langue dans laquelle l'environnement de test rend l'interface.
    expect(document.body.innerHTML).not.toContain(ACCUEIL.name)
    expect(document.body.innerHTML).not.toContain(PLONGE.name)
  })
})
