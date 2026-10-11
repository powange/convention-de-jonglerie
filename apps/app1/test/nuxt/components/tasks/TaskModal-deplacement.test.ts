import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import TaskModal from '../../../../../../layers/tasks/app/components/tasks/TaskModal.vue'

/**
 * Le BRANCHEMENT du déplacement d'une tâche étiquetée — constat B1.
 *
 * ## ⚠️ POURQUOI CE FICHIER EXISTE, alors que le point d'API est éprouvé à part
 *
 * Le serveur a cessé de refuser le déplacement : il ignore désormais les tags de l'ancien groupe
 * au lieu de les valider contre le nouveau. Mais c'est la MODALE qui compose le corps, et c'est
 * elle qui envoyait ces tags sans y penser. Un correctif serveur juste, laissé seul, serait
 * invisible le jour où quelqu'un remettrait la validation « par symétrie » — alors que la modale,
 * elle, n'a aucune raison d'envoyer des étiquettes qu'elle sait condamnées.
 *
 * Et l'autre moitié du défaut n'était pas le 400 : c'était le SILENCE. Déplacer une tâche retire
 * ses étiquettes, et rien ne le disait.
 *
 * ## ⚠️⚠️ CE QUI EST OBSERVÉ : LE CORPS RÉELLEMENT ENVOYÉ
 *
 * `vi.stubGlobal('$fetch', …)` n'intercepte PAS l'appel d'un composant Nuxt — le vrai part, le
 * serveur de test répond 404, et un cas qui assère une ABSENCE passerait alors sans rien prouver.
 * `registerEndpoint` est l'outil, et il donne en prime le corps tel qu'il a voyagé.
 *
 * ## 📍 LE GROUPE EST CHOISI PAR LE VRAI GESTE
 *
 * Un composant en `<script setup>` n'expose RIEN : `wrapper.vm` ne porte que les props, et poser
 * `formData.taskGroupId` de l'extérieur est impossible — vérifié, c'est par là que j'ai commencé.
 * Le sélecteur est donc ouvert puis l'option cliquée, comme le ferait une personne. Reka UI
 * n'ouvre le menu que sur `pointerdown` suivi d'un `click`, et ses options vivent dans un
 * PORTAIL, hors de l'arbre du composant : on les cherche dans le document.
 */
const GROUPE_ACTUEL = { id: 2, name: 'Avant la convention' }
const GROUPE_CIBLE = { id: 3, name: 'Pendant la convention' }

const TACHE = {
  id: 5,
  taskGroupId: GROUPE_ACTUEL.id,
  title: 'Monter le chapiteau',
  description: null,
  status: 'TODO' as const,
  deadline: null,
  assignments: [],
  // Deux étiquettes, donc deux occasions de faire échouer l'enregistrement avant le correctif.
  tagAssignments: [
    { id: 1, tag: { id: 31, name: 'urgent', color: '#ff0000' } },
    { id: 2, tag: { id: 32, name: 'matériel', color: '#00ff00' } },
  ],
}

let corpsEnvoye: Record<string, unknown> | null = null

/**
 * Lit le corps de la requête tel qu'il est arrivé.
 *
 * ⚠️ `readBody` NE PEUT PAS SERVIR ICI, et c'est le piège qui a coûté le plus de tours :
 * `test/setup.ts` remplace `h3` globalement et délègue `readBody` à `globalThis.readBody`, un
 * espion que chaque test d'ENDPOINT règle pour lui-même. Dans un test de COMPOSANT, personne ne
 * le règle — il rend `undefined`. Pas une erreur : une valeur. Et `expect(undefined).not.toBeNull()`
 * est VRAI, donc la garde passait et l'échec tombait une ligne plus loin, en accusant une
 * propriété manquante. Les gardes de ce fichier assèrent donc une valeur VRAIE.
 *
 * 📍 Le serveur de test dépose le corps déjà lu dans `event.node.req.body`, sous forme de CHAÎNE.
 * Ni `event.request`, ni `event.web`, ni `event._requestBody` n'existent dans cet environnement,
 * et itérer sur le flux ne rend rien — il est consommé.
 */
function lireLeCorps(event: unknown): Record<string, unknown> {
  const corps = (event as { node: { req: { body?: unknown } } }).node.req.body
  if (typeof corps === 'string') return corps ? JSON.parse(corps) : {}
  return (corps as Record<string, unknown>) ?? {}
}

registerEndpoint('/api/editions/1/tasks/5', {
  method: 'PUT',
  handler: (event) => {
    corpsEnvoye = lireLeCorps(event)
    return { success: true }
  },
})
/*
 * La modale monte la discussion de la tâche, qui charge ses commentaires d'elle-même. Sans cette
 * réponse, un rejet non géré remonte dans la course et Vitest le compte en « unhandled error » —
 * ce qui fait échouer le fichier en laissant les cas verts.
 */
registerEndpoint('/api/editions/1/tasks/5/comments', () => ({ success: true, data: [] }))

const monter = () =>
  mountSuspended(TaskModal, {
    props: {
      open: true,
      editionId: 1,
      group: GROUPE_ACTUEL,
      task: TACHE,
      assignableUsers: [],
      taskGroups: [GROUPE_ACTUEL, GROUPE_CIBLE],
      availableTags: [
        { id: 31, name: 'urgent', color: '#ff0000' },
        { id: 32, name: 'matériel', color: '#00ff00' },
      ],
    },
  })

/** Ouvre le sélecteur de groupe — le dernier du formulaire — et clique le groupe cible. */
async function choisirLeGroupeCible(composant: Awaited<ReturnType<typeof monter>>) {
  const selecteurs = [...document.querySelectorAll('[role="combobox"]')] as HTMLElement[]
  const selecteurDeGroupe = selecteurs[selecteurs.length - 1]
  expect(selecteurDeGroupe, 'le sélecteur de groupe est introuvable').toBeTruthy()
  selecteurDeGroupe!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  selecteurDeGroupe!.click()
  await new Promise((r) => setTimeout(r, 50))
  await composant.vm.$nextTick()

  const option = ([...document.querySelectorAll('[role="option"]')] as HTMLElement[]).find((o) =>
    o.textContent?.includes(GROUPE_CIBLE.name)
  )
  expect(option, 'le groupe cible ne figure pas dans la liste').toBeTruthy()
  option!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  option!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  option!.click()
  await new Promise((r) => setTimeout(r, 50))
  await composant.vm.$nextTick()
}

/**
 * Enregistre par le formulaire : c'est lui que les deux boutons déclenchent.
 *
 * ⚠️ Le formulaire est cherché dans le DOCUMENT et non dans l'arbre du composant : `UModal`
 * téléporte son contenu dans `document.body`, si bien que `composant.find('form')` ne trouve
 * RIEN — et un `trigger` sur un enveloppeur vide lève, ce qui au moins se voit.
 */
async function enregistrer(composant: Awaited<ReturnType<typeof monter>>) {
  const formulaire = document.querySelector('form')
  expect(formulaire, 'le formulaire est introuvable').toBeTruthy()
  formulaire!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await new Promise((r) => setTimeout(r, 50))
  await composant.vm.$nextTick()
}

describe('TasksTaskModal — déplacer une tâche étiquetée', () => {
  beforeEach(() => {
    corpsEnvoye = null
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('⚠️ N’ENVOIE PLUS LES ÉTIQUETTES DE L’ANCIEN GROUPE avec le déplacement', async () => {
    const composant = await monter()
    await choisirLeGroupeCible(composant)
    await enregistrer(composant)

    expect(corpsEnvoye, "le PUT n'est pas parti").toBeTruthy()
    expect(corpsEnvoye!.taskGroupId).toBe(GROUPE_CIBLE.id)
    /*
     * La clé est ABSENTE, et non vide : pour ce point d'API, « non fourni » et « aucune étiquette »
     * sont deux choses différentes — la seconde retirerait les tags du groupe d'arrivée si la
     * tâche n'y bougeait pas.
     */
    expect(corpsEnvoye!).not.toHaveProperty('tagIds')
  })

  it('les envoie toujours quand la tâche ne change PAS de groupe', async () => {
    /*
     * LE TÉMOIN. Sans lui, une modale qui n'enverrait PLUS JAMAIS `tagIds` satisferait le cas
     * précédent — et l'on ne pourrait plus ni poser ni retirer une étiquette, cette modale étant
     * la seule surface qui le permette.
     */
    const composant = await monter()
    await enregistrer(composant)

    expect(corpsEnvoye, "le PUT n'est pas parti").toBeTruthy()
    expect(corpsEnvoye!).not.toHaveProperty('taskGroupId')
    expect(corpsEnvoye!.tagIds).toEqual([31, 32])
  })

  it('annonce ce que le déplacement va retirer, et seulement alors', async () => {
    const composant = await monter()

    // Au repos, rien n'est annoncé : la tâche ne bouge pas.
    expect(document.querySelector('[data-etiquettes-retirees]')).toBeNull()

    await choisirLeGroupeCible(composant)

    /*
     * ⚠️ L'ANCRE `data-*` ET NON LE TEXTE : l'environnement de test est en anglais, et la clé
     * créée en français seulement y ressort BRUTE — vue-i18n ne faisant aucune interpolation sur
     * une clé absente, le nombre n'apparaîtrait même pas. Asserter le libellé échouerait pour une
     * raison étrangère au lot, et asserter la clé brute serait vrai jusqu'à la synchronisation des
     * traductions.
     */
    expect(document.querySelector('[data-etiquettes-retirees]')).not.toBeNull()
  })
})
