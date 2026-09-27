import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import ApplicationModal from '../../../../../../layers/volunteers/app/components/edition/volunteer/ApplicationModal.vue'

/**
 * Appuyer sur « Postuler » doit DIRE ce qui manque.
 *
 * Tout était écrit pour cela : une règle par champ, son message traduit, un `showAllErrors` que
 * `handleSubmit` lève, et un `:error` sur chaque `UFormField`. Une seule ligne rendait l'ensemble
 * inatteignable — le bouton portait `:disabled="… || !isFormValid …"`, et un bouton désactivé
 * n'émet pas de clic. `handleSubmit` n'était donc jamais appelé.
 *
 * Conséquence pour le candidat : un champ qu'il n'a pas touché ne se signale pas (c'est voulu, on
 * ne gronde pas avant l'heure), et le bouton refuse de s'actionner sans rien expliquer. Il ne lui
 * reste qu'à chercher.
 *
 * Ces tests partent du cas réel : un formulaire dont AUCUN champ n'a été touché. Le test voisin
 * (`application-modal-erreurs`) remplit le téléphone, donc ce champ est « touché » et son erreur
 * s'affichait déjà — c'est pourquoi la suite ne voyait pas le défaut.
 *
 * ⚠️ Les assertions ne portent pas sur du texte français : l'environnement de test rend
 * l'interface en anglais. Elles confrontent le HTML à ce que le composant a lui-même calculé, ce
 * qui vérifie le maillon réellement rompu — du calcul jusqu'à l'écran — sans dépendre d'une langue.
 */

registerEndpoint('/api/editions/21/volunteer-teams', () => [])

const volunteersInfo = {
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

/** Un compte sans téléphone ni identité : tout ce que le formulaire exige manque. */
const utilisateurSansRien = {
  id: '1',
  email: 'benevole@example.com',
  pseudo: 'benevole',
  nom: null,
  prenom: null,
  phone: null,
}

/** `UModal` téléporte son contenu : c'est le corps du document qu'il faut lire. */
const monter = async () => {
  document.body.innerHTML = ''
  return mountSuspended(ApplicationModal, {
    props: {
      modelValue: true,
      volunteersInfo,
      edition,
      user: utilisateurSansRien,
      applying: false,
      serverErrors: null,
    } as never,
  })
}

const RECAP = 'data-testid="recapitulatif-validation"'

/** Le bouton d'envoi, tel que le candidat l'atteint. */
const boutonEnvoyer = () =>
  document.body.querySelector<HTMLButtonElement>('[data-testid="envoyer-candidature"]')

describe('ApplicationModal — la validation se déclenche au clic', () => {
  it('ne reproche rien avant qu’on ait tenté d’envoyer', async () => {
    const composant = await monter()

    // Le silence initial est délibéré : on n'accueille pas quelqu'un en lui listant ses fautes.
    expect((composant.vm as any).validationErrors).toEqual([])
    expect(document.body.innerHTML).not.toContain(RECAP)
  })

  it('désigne chaque champ manquant après une tentative d’envoi', async () => {
    const composant = await monter()
    const vm = composant.vm as any

    await vm.handleSubmit()
    await nextTick()
    await nextTick()

    // Les règles ont bien trouvé des manquements sur des champs JAMAIS touchés…
    expect(vm.manquements.map((m: { champ: string }) => m.champ)).toContain('phone')
    expect(vm.manquements.length).toBeGreaterThan(1)

    // … et chacun de leurs messages est réellement à l'écran. C'est ce lien qui manquait : les
    // règles trouvaient déjà, personne ne l'affichait.
    const html = document.body.innerHTML
    for (const message of vm.validationErrors as string[]) {
      expect(html, `message affiché : « ${message} »`).toContain(message)
    }
  })

  it('récapitule ce qui manque là où l’on vient d’appuyer', async () => {
    /*
     * Le formulaire compte une trentaine de champs : un encadré rouge tout en haut ne se voit pas
     * depuis le bouton. Le récapitulatif vit donc dans le pied, sous les yeux au moment du clic.
     * Il était calculé (`validationErrors`) mais rendu nulle part.
     */
    const composant = await monter()

    await (composant.vm as any).handleSubmit()
    await nextTick()
    await nextTick()

    expect(document.body.innerHTML).toContain(RECAP)
  })

  it('le bouton s’actionne sur une saisie incomplète, et c’est LUI qui révèle les erreurs', async () => {
    /*
     * Le test qui vaut le plus, et le seul qui voyait le défaut.
     *
     * Les autres appellent `handleSubmit` sur l'instance : ils contournent le bouton, donc ils
     * passaient déjà quand celui-ci était désactivé. Or c'est précisément le bouton qui ne
     * s'actionnait pas — `:disabled="… || !isFormValid …"` — et un bouton désactivé n'émet pas de
     * clic. Le candidat n'avait rien : ni envoi, ni explication.
     */
    const composant = await monter()

    const bouton = boutonEnvoyer()
    expect(bouton, 'bouton d’envoi introuvable').toBeTruthy()
    expect(bouton!.disabled, 'le bouton doit rester actionnable pour pouvoir expliquer').toBe(false)

    bouton!.click()
    await nextTick()
    await nextTick()

    expect(document.body.innerHTML).toContain(RECAP)
    expect((composant.vm as any).validationErrors.length).toBeGreaterThan(0)
    // Et rien n'est parti : le clic valide, il ne soumet pas.
    expect(composant.emitted('submit')).toBeUndefined()
  })

  it('n’envoie rien quand la saisie est incomplète', async () => {
    // La contrepartie du bouton toujours actionnable : le clic valide, il ne soumet pas.
    const composant = await monter()

    await (composant.vm as any).handleSubmit()
    await nextTick()

    expect(composant.emitted('submit')).toBeUndefined()
    expect(composant.emitted('update')).toBeUndefined()
  })

  it('cesse de reprocher un champ dès qu’il est rempli, sans absoudre les autres', async () => {
    const composant = await monter()
    const vm = composant.vm as any

    await vm.handleSubmit()
    await nextTick()

    const reprocheAuPrenom = vm.firstNameError as string
    const reprocheAuNom = vm.lastNameError as string
    expect(reprocheAuPrenom).toBeTruthy()
    expect(document.body.innerHTML).toContain(reprocheAuPrenom)

    vm.formData.firstName = 'Camille'
    await nextTick()
    await nextTick()

    expect(vm.firstNameError).toBeUndefined()
    expect(document.body.innerHTML).not.toContain(reprocheAuPrenom)
    // Corriger un champ n'efface pas les autres reproches, ni le récapitulatif.
    expect(document.body.innerHTML).toContain(reprocheAuNom)
    expect(document.body.innerHTML).toContain(RECAP)
  })
})
