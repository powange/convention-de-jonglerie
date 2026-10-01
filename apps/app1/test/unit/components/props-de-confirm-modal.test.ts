import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * Personne ne passe à `UiConfirmModal` une prop qu'elle n'a pas.
 *
 * ⚠️ POURQUOI UN TEST QUI LIT LE DÉPÔT, et pas un test de composant. `apps/app1/app/components/
 * ui/ConfirmModal.vue` n'accepte que `description` ; deux écrans de gestion lui passaient
 * `:message`. Vue dépose SILENCIEUSEMENT un attribut inconnu sur l'élément racine : aucune
 * erreur, aucun avertissement, et le texte voulu n'apparaissait jamais — à sa place, le repli
 * générique « Êtes-vous sûr ? ». Le lecteur était donc averti qu'il allait supprimer quelque
 * chose, sans savoir quoi.
 *
 * Un test de `ConfirmModal` ne peut PAS attraper cela : le composant se comporte correctement,
 * c'est l'appel qui est faux. Et le typage non plus, les props d'un composant auto-importé dans un
 * template n'étant pas vérifiées de cette façon ici. Il restait à regarder les appels.
 *
 * 📍 La liste des props admises est lue dans le composant lui-même plutôt que recopiée : une prop
 * ajoutée demain ne doit pas faire tomber ce test, et une prop RENOMMÉE doit le faire tomber.
 */

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const COMPOSANT = join(RACINE, 'app', 'components', 'ui', 'ConfirmModal.vue')

/** Les dossiers où vivent les templates qui peuvent appeler le composant. */
const DOSSIERS = [join(RACINE, 'app'), join(RACINE, '..', '..', 'layers')]

function fichiersVue(depart: string): string[] {
  const trouves: string[] = []
  const parcourir = (chemin: string) => {
    for (const entree of readdirSync(chemin)) {
      if (entree === 'node_modules' || entree === '.nuxt' || entree === 'dist') continue
      const complet = join(chemin, entree)
      if (statSync(complet).isDirectory()) parcourir(complet)
      else if (entree.endsWith('.vue')) trouves.push(complet)
    }
  }
  parcourir(depart)
  return trouves
}

/** Les noms de props déclarés par l'interface `Props` du composant. */
function propsAdmises(): Set<string> {
  const source = readFileSync(COMPOSANT, 'utf8')
  const bloc = source.slice(source.indexOf('interface Props {'))
  const corps = bloc.slice(0, bloc.indexOf('\n}'))
  const noms = new Set<string>()
  for (const ligne of corps.split('\n')) {
    const trouve = ligne.match(/^\s{2}([a-zA-Z][a-zA-Z0-9]*)\??:/)
    if (trouve?.[1]) noms.add(trouve[1])
  }
  return noms
}

/**
 * Les props passées à chaque balise `<UiConfirmModal …>` d'un fichier.
 *
 * On ne lit que l'intérieur de la balise ouvrante : un `:message` posé plus bas dans le même
 * fichier, sur un autre composant, n'a rien à voir avec celui-ci.
 */
function propsPassees(source: string): string[] {
  const passees: string[] = []
  for (const balise of source.matchAll(/<UiConfirmModal\b([\s\S]*?)\/?>/g)) {
    for (const attribut of (balise[1] ?? '').matchAll(
      /(?:^|\s)(?::|v-bind:)?([a-zA-Z][\w-]*)\s*=/g
    )) {
      const brut = attribut[1]
      if (!brut) continue
      // Les directives ne sont pas des props : `v-model`, `v-if`, `v-for`. Seul `v-bind:` compte,
      // et le motif l'a déjà retiré. Sans ce filtre, `v-model` arrivait ici sous la forme
      // « vModel » et chaque appel du dépôt était déclaré fautif.
      if (brut.startsWith('v-')) continue
      // kebab-case → camelCase : un template écrit `confirm-color`, la prop s'appelle
      // `confirmColor`, et les deux sont corrects.
      passees.push(brut.replace(/-([a-z])/g, (_, lettre: string) => lettre.toUpperCase()))
    }
  }
  return passees
}

describe('les appels à UiConfirmModal', () => {
  const admises = propsAdmises()

  it('le composant déclare bien `description`, et pas `message`', () => {
    // 🔬 Fige la cause plutôt que le seul symptôme : si `message` devenait une vraie prop un jour,
    // ce test le signalerait et l'on saurait reconsidérer la règle ci-dessous.
    expect(admises.has('description')).toBe(true)
    expect(admises.has('message')).toBe(false)
  })

  it('🔬 ne passent que des props que le composant déclare', () => {
    const fautifs: string[] = []

    for (const dossier of DOSSIERS) {
      for (const fichier of fichiersVue(dossier)) {
        const source = readFileSync(fichier, 'utf8')
        if (!source.includes('<UiConfirmModal')) continue
        for (const prop of propsPassees(source)) {
          // Les écouteurs, les directives et le `v-model` ne sont pas des props.
          if (prop.startsWith('on') || prop === 'key' || prop === 'ref') continue
          if (prop === 'modelValue' || prop === 'class' || prop === 'style') continue
          if (!admises.has(prop)) fautifs.push(`${fichier.replace(RACINE, '')} → ${prop}`)
        }
      }
    }

    expect(fautifs, `props inconnues passées à UiConfirmModal :\n${fautifs.join('\n')}`).toEqual([])
  })

  it('trouve réellement des appels à inspecter', () => {
    /*
     * ⚠️ L'ASSERTION QUI EMPÊCHE CE FICHIER D'ÊTRE CREUX. Sans elle, un chemin de dossier devenu
     * faux — une arborescence remaniée, un déplacement de layer — rendrait le test ci-dessus vert
     * en n'inspectant plus RIEN. C'est le mode d'échec propre aux tests qui lisent le disque, et
     * il ne se signale pas.
     */
    const appelants = DOSSIERS.flatMap(fichiersVue).filter((f) =>
      readFileSync(f, 'utf8').includes('<UiConfirmModal')
    )

    expect(appelants.length).toBeGreaterThan(5)
  })
})
