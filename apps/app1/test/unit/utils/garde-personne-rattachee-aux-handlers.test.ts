import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

/**
 * Tout handler qui enregistre une personne comme ayant sorti l'argent de sa poche doit vérifier
 * qu'elle est rattachée à l'édition.
 *
 * ## ⚠️ POURQUOI UN TEST STRUCTUREL, ET PAS SEULEMENT DES TESTS DE LA GARDE
 *
 * Le défaut d'origine n'est pas une garde fausse : c'est une garde **absente**. Le périmètre
 * n'existait que dans `advance-candidates.get.ts`, le point d'API qui PROPOSE la liste, et les
 * quatre points qui ENREGISTRENT ne validaient l'identifiant que comme entier positif.
 *
 * Les tests de `assertPersonneRattacheeALEdition` éprouvent la règle. Ils resteraient **tous
 * verts** si quelqu'un retirait l'appel d'un des quatre handlers, ou en ajoutait un cinquième
 * sans y penser — ce qui est précisément l'histoire de ce défaut. C'est ce que ferme ce test-ci.
 *
 * La détection part du **schéma de validation** et non d'une liste de chemins : un nouveau point
 * d'API qui déclare `advancedById` ou `lentById` dans son corps est attrapé dès son premier jour,
 * sans que personne n'ait à se souvenir d'ajouter une ligne ici.
 *
 * ## 📍 CE QUE CE TEST A TROUVÉ EN S'ÉCRIVANT : UN CINQUIÈME POINT D'API
 *
 * La détection par schéma en a relevé **cinq**, là où la fiche d'audit et moi n'en voyions que
 * quatre : `entries/reimburse.post.ts`, qui solde en un versement toutes les avances d'une
 * personne. Il déclare bien `advancedById` — mais il ne l'ÉCRIT pas, il s'en sert comme FILTRE,
 * borné à l'édition.
 *
 * ⚠️⚠️ ET LUI AJOUTER LA GARDE SERAIT UN DÉFAUT, pas un oubli réparé : on ne pourrait plus solder
 * la dette de quelqu'un qui a quitté l'édition depuis — un bénévole dont la candidature a été
 * retirée, un artiste déprogrammé. L'argent a été avancé, il reste dû ; refuser le remboursement
 * parce que la personne n'est plus rattachée reviendrait à transformer une garde de saisie en
 * perte d'une dette réelle.
 *
 * C'est pourquoi l'exception est NOMMÉE avec sa raison, et vérifiée POSITIVEMENT : le test prouve
 * qu'elle ne fait bien que filtrer, en extrayant ses blocs `data:` et en exigeant qu'aucun ne
 * mentionne le champ. Une liste d'exceptions qu'on ne relit pas finit par exempter ce qu'elle
 * devait surveiller — le jour où ce handler se mettrait à écrire l'identifiant, le test tombe.
 *
 * 📍 Les deux champs sont traités ensemble parce qu'ils posent la MÊME question — leurs deux
 * modales (`EntryModal.vue` et `CashFloatModal.vue`) interrogent d'ailleurs le même point d'API
 * pour peupler leur sélecteur. La fiche d'audit ne nommait que l'avance d'une dépense ; le fonds
 * de caisse avait le même trou, et le corriger à moitié aurait laissé la porte ouverte.
 */

const CHAMPS_DE_PERSONNE = ['advancedById', 'lentById']
const GARDE = 'assertPersonneRattacheeALEdition('

/**
 * Les handlers qui NOMMENT un de ces champs sans avoir à le vérifier, avec la raison.
 *
 * ⚠️ Ajouter une ligne ici est un geste délibéré. Le défaut par défaut est d'appeler la garde, et
 * chaque exception est éprouvée positivement ci-dessous : elle doit ne faire que FILTRER.
 */
const EXCEPTIONS: Record<string, string> = {
  'apps/app1/server/api/editions/[id]/treasury/entries/reimburse.post.ts':
    "Solde les avances d'une personne : le champ y est un FILTRE, borné à l'édition, jamais une écriture. Exiger le rattachement rendrait insoldable la dette de quelqu'un qui a quitté l'édition depuis — l'argent a été avancé, il reste dû.",
}

/**
 * Les blocs `data: { … }` d'un fichier, accolades appariées.
 *
 * Écrit à la main plutôt que par expression régulière : un `data:` contient des objets imbriqués,
 * et s'arrêter à la première accolade fermante couperait au milieu — on conclurait alors qu'un
 * champ n'est pas écrit parce qu'on a cessé de regarder avant lui.
 */
function blocsDeDonnees(contenu: string): string[] {
  const blocs: string[] = []
  const marqueur = /\bdata:\s*\{/g
  let trouve: RegExpExecArray | null
  while ((trouve = marqueur.exec(contenu))) {
    let profondeur = 0
    let i = trouve.index + trouve[0].length - 1
    const debut = i
    for (; i < contenu.length; i++) {
      if (contenu[i] === '{') profondeur++
      else if (contenu[i] === '}') {
        profondeur--
        if (profondeur === 0) break
      }
    }
    blocs.push(contenu.slice(debut, i + 1))
  }
  return blocs
}

/** Tous les handlers d'API du dépôt, chemin relatif à la racine. */
function handlers(): { chemin: string; contenu: string }[] {
  const racineDepot = path.resolve(__dirname, '../../../../..')
  const racines = [
    path.resolve(__dirname, '../../../server/api'),
    path.resolve(__dirname, '../../../../../layers'),
  ]
  const trouves: { chemin: string; contenu: string }[] = []

  const parcours = (dossier: string) => {
    if (!fs.existsSync(dossier)) return
    for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
      const complet = path.join(dossier, entree.name)
      if (entree.isDirectory()) {
        if (entree.name === 'node_modules' || entree.name === '.nuxt') continue
        parcours(complet)
      } else if (entree.name.endsWith('.ts')) {
        if (!complet.includes(`${path.sep}server${path.sep}api${path.sep}`)) continue
        trouves.push({
          chemin: path.relative(racineDepot, complet).split(path.sep).join('/'),
          contenu: fs.readFileSync(complet, 'utf8'),
        })
      }
    }
  }
  racines.forEach(parcours)
  return trouves
}

describe("garde sur la personne qui a avancé l'argent — tous les points d'écriture", () => {
  const tous = handlers()

  /**
   * Les handlers qui ÉCRIVENT un de ces champs : ceux dont le corps le déclare.
   *
   * ⚠️ `advance-candidates.get.ts` ne nomme aucun des deux champs et n'est donc pas retenu — c'est
   * voulu : il ne fait que proposer la liste, il n'enregistre rien.
   */
  const ecrivains = tous.filter(({ contenu }) =>
    CHAMPS_DE_PERSONNE.some((champ) => contenu.includes(`${champ}: z.`))
  )

  it('trouve bien les handlers du dépôt', () => {
    // La garde de la garde : un parcours qui ne rendrait rien laisserait tout le reste vert en ne
    // vérifiant rien. Le piège de la « boucle satisfaite par des zéros », déjà payé ici.
    expect(tous.length).toBeGreaterThan(400)
  })

  it("relève tous ceux qui nomment un de ces champs, et c'est la liste du jour du lot", () => {
    /*
     * Le compte est asserté pour que l'ARRIVÉE d'un sixième point se SIGNALE, et non pour figer le
     * dépôt : si ce test tombe, c'est qu'un handler neuf touche à ces champs — il doit alors
     * appeler la garde, ou rejoindre EXCEPTIONS avec sa raison.
     */
    expect(ecrivains.map(({ chemin }) => chemin).sort()).toEqual([
      'apps/app1/server/api/editions/[id]/treasury/cash-float/[floatId].put.ts',
      'apps/app1/server/api/editions/[id]/treasury/cash-float/index.post.ts',
      'apps/app1/server/api/editions/[id]/treasury/entries.post.ts',
      'apps/app1/server/api/editions/[id]/treasury/entries/[entryId].put.ts',
      'apps/app1/server/api/editions/[id]/treasury/entries/reimburse.post.ts',
    ])
  })

  it('chacun appelle la garde, hors exceptions nommées', () => {
    const sansGarde = ecrivains
      .filter(({ chemin }) => !(chemin in EXCEPTIONS))
      .filter(({ contenu }) => !contenu.includes(GARDE))
      .map(({ chemin }) => chemin)

    expect(
      sansGarde,
      `ces handlers enregistrent une personne sans vérifier qu'elle est rattachée à l'édition : appeler ${GARDE.slice(0, -1)}`
    ).toEqual([])
  })

  it("les exceptions existent encore et ne font bien que FILTRER le champ, jamais l'écrire", () => {
    /*
     * ⚠️ LA VÉRIFICATION QUI REND LA LISTE D'EXCEPTIONS SÛRE. Sans elle, une exception justifiée
     * aujourd'hui couvrirait demain une vraie écriture — c'est le défaut d'une garde par liste
     * qu'on ne relit pas, déjà payé ailleurs dans ce dépôt.
     */
    const parChemin = new Map(tous.map(({ chemin, contenu }) => [chemin, contenu]))

    for (const [chemin, raison] of Object.entries(EXCEPTIONS)) {
      const contenu = parChemin.get(chemin)
      expect(contenu, `${chemin} : exception déclarée pour un fichier introuvable`).toBeDefined()
      expect(raison.length, `${chemin} : une exception sans raison écrite`).toBeGreaterThan(40)

      const ecrits = blocsDeDonnees(contenu!).filter((bloc) =>
        CHAMPS_DE_PERSONNE.some((champ) => bloc.includes(champ))
      )
      expect(
        ecrits,
        `${chemin} écrit désormais un de ces champs : retirer son exception et appeler la garde`
      ).toEqual([])
    }
  })

  it('la garde est bien appelée sur les quatre points qui écrivent', () => {
    // Nommés explicitement : le test précédent le dirait déjà, celui-ci dit COMBIEN et LESQUELS.
    const avecGarde = ecrivains
      .filter(({ contenu }) => contenu.includes(GARDE))
      .map(({ chemin }) => chemin)
    expect(avecGarde).toHaveLength(4)
  })

  it("la liste des candidats consomme la définition partagée, et n'en réécrit pas une seconde", () => {
    /*
     * ⚠️ LE POINT QUI COMPTE AUTANT QUE LA GARDE. Si la liste proposée et le contrôle à
     * l'enregistrement répondaient autrement à « qui peut avoir avancé cet argent ? », on
     * reproduirait le défaut d'un cran plus loin : un trésorier choisirait quelqu'un dans la liste
     * et se verrait refuser l'enregistrement, ou l'inverse. Les deux lisent donc littéralement les
     * mêmes clauses.
     */
    const liste = tous.find(({ chemin }) => chemin.endsWith('treasury/advance-candidates.get.ts'))
    expect(liste, 'advance-candidates.get.ts introuvable').toBeDefined()
    expect(liste!.contenu).toContain('clausesDesPersonnesRattachees(')
    // Et elle ne doit plus porter sa propre version du filtre des bénévoles.
    expect(liste!.contenu).not.toContain("status: 'ACCEPTED'")
  })
})
