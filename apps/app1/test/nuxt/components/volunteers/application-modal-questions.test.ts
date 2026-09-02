import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'

import ApplicationModal from '../../../../../../layers/volunteers/app/components/edition/volunteer/ApplicationModal.vue'

/**
 * Le formulaire de candidature est le plus long du produit, et sa forme dépend d'une quinzaine
 * de drapeaux posés par l'organisateur : chacun ajoute ou retire une question. Une erreur
 * n'échoue pas — elle pose la mauvaise question, ou tait celle qu'on voulait poser, et personne
 * ne le signale.
 *
 * Ces tests couvrent ce que le fichier voisin (`application-modal-erreurs`) laisse de côté :
 * les questions conditionnelles, la reprise d'une candidature déjà enregistrée, et la garde de
 * l'aperçu.
 */

registerEndpoint('/api/editions/21/volunteer-teams', () => ({ teams: [] }))

const TOUT_FERME = {
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
}

const edition = { id: 21, startDate: '2026-07-10T08:00:00Z', endDate: '2026-07-13T18:00:00Z' }
const utilisateur = { id: '1', email: 'b@example.com', pseudo: 'benevole', nom: 'N', prenom: 'P' }

/** `UModal` téléporte son contenu : c'est le corps du document qu'il faut lire. */
const monter = async (options: Record<string, unknown> = {}) => {
  document.body.innerHTML = ''
  await mountSuspended(ApplicationModal, {
    props: {
      modelValue: true,
      volunteersInfo: { ...TOUT_FERME, ...(options.info ?? {}) },
      edition,
      user: utilisateur,
      applying: false,
      ...options.props,
    } as never,
  })
  return document.body.innerHTML
}

describe('ApplicationModal — questions conditionnelles', () => {
  /**
   * Chaque drapeau est éprouvé seul : on vérifie que la question apparaît quand il est levé et
   * qu'elle est absente quand il ne l'est pas. Éprouver tous les drapeaux ensemble ne dirait pas
   * lequel commande quoi.
   */
  /**
   * Chaque motif accepte le libellé traduit **ou** la clé i18n brute : le banc de test ne charge
   * pas tous les domaines de traduction, et certains libellés s'y affichent sous forme de clé.
   * S'ancrer sur la seule traduction rendrait ces tests dépendants d'un détail d'environnement.
   */
  const QUESTIONS: [string, RegExp][] = [
    ['askDiet', /diet_|régime|alimentaire/i],
    ['askAllergies', /allerg/i],
    ['askPets', /pets|animal|animaux/i],
    ['askMinors', /minors|mineur/i],
    ['askVehicle', /vehicle|véhicule/i],
    ['askCompanion', /companion|aimerais faire mes créneaux/i],
    ['askSkills', /skills|compétence/i],
    ['askExperience', /experience|expérience/i],
    ['askEmergencyContact', /emergency|urgence/i],
  ]

  it.each(QUESTIONS)('%s levé fait apparaître sa question', async (drapeau, motif) => {
    const html = await monter({ info: { [drapeau]: true } })
    expect(html).toMatch(motif)
  })

  it.each(QUESTIONS)('%s baissé retire sa question', async (drapeau, motif) => {
    const html = await monter({ info: { [drapeau]: false } })
    expect(html).not.toMatch(motif)
  })
})

describe('ApplicationModal — reprise d’une candidature enregistrée', () => {
  it('réaffiche ce que le bénévole avait saisi', async () => {
    // Rouvrir sa candidature doit montrer ce qu'on avait répondu : un formulaire qui revient
    // vide donne à croire que rien n'a été enregistré.
    await monter({
      info: { askSkills: true, askExperience: true },
      props: {
        isEditing: true,
        existingApplication: {
          motivation: 'Je viens depuis cinq ans',
          skills: 'Régie lumière',
          // `askExperience` décide de poser la question ; `hasExperience` est la réponse à
          // l'interrupteur, et c'est elle qui découvre le champ de détail. Sans elle, le détail
          // reste masqué — ce qui est le comportement voulu, et non un défaut de reprise.
          hasExperience: true,
          experienceDetails: 'Trois éditions comme bénévole',
        },
      },
    })

    // La valeur d'un `textarea` vit dans le DOM, jamais dans le HTML sérialisé : la lire dans
    // `innerHTML` ne prouverait rien.
    const saisies = [...document.querySelectorAll('textarea')].map((t) => t.value)
    expect(saisies).toContain('Je viens depuis cinq ans')
    expect(saisies).toContain('Régie lumière')
    expect(saisies).toContain('Trois éditions comme bénévole')
  })
})

describe('ApplicationModal — aperçu', () => {
  it('empêche l’envoi tout en laissant parcourir le formulaire', async () => {
    // L'aperçu sert à relire son questionnaire avant d'ouvrir le recrutement : la lecture doit
    // rester possible, l'envoi non.
    const html = await monter({ info: { askSkills: true }, props: { apercu: true } })

    expect(html).toMatch(/compétence/i)
    const boutons = [...document.querySelectorAll('button')]
    // Le libellé suit le mode — « enregistrer » en édition, « postuler » sinon — et le banc de
    // test peut l'afficher en anglais.
    const envoi = boutons.find((b) =>
      /save|enregistrer|postuler|candidater|apply/i.test(b.textContent || '')
    )
    expect(envoi).toBeDefined()
    expect(envoi!.hasAttribute('disabled')).toBe(true)
  })
})
