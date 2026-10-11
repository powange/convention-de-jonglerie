import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Qui échappe encore le HTML AVANT de stocker — dette nommée par le constat B5.
 *
 * ## Le défaut, et pourquoi il ne se voit pas en relisant le code
 *
 * `sanitizeUserContent` remplace `&`, `<` et `>` par leurs entités **avant écriture en base**. Sa
 * documentation dit à quoi cela sert : un contenu « qui pourrait être affiché via `v-html` ou
 * consommé par des clients tiers ». Mais quand l'écran l'affiche par interpolation `{{ }}` — que
 * Vue échappe **déjà** —, le lecteur voit les entités : « Sac & clés » devient « Sac &amp;amp;
 * clés ».
 *
 * Rien ne lève, rien n'est journalisé, et le défaut ne se découvre qu'en tapant une esperluette.
 *
 * ## 📊 CE QUE LA MESURE A TROUVÉ, et que la fiche ne disait pas
 *
 * La fiche ne nommait que les objets trouvés. Le même appel existe **quatre** fois, et les trois
 * autres sont rendus par interpolation eux aussi — donc atteints du même défaut :
 *
 * | appelant | rendu | état |
 * | --- | --- | --- |
 * | objets trouvés (description) | `{{ }}` + `:alt` | **corrigé** par ce lot |
 * | publications d'édition | `{{ post.content }}` | dette |
 * | commentaires de publication | `{{ comment.content }}` | dette |
 * | message de réservation de covoiturage | `{{ b.message }}` | dette |
 *
 * Chacun demande sa propre migration de rattrapage et sa propre vérification qu'aucun `v-html` ne
 * le rend : c'est pourquoi ils ne sont pas traités ici, et pourquoi ils sont **nommés** plutôt que
 * laissés à découvrir. Un cinquième appelant, lui, fera tomber ce test.
 */
const RACINE = join(process.cwd(), '..', '..')

/** Les répertoires de code SERVEUR, seuls concernés : l'échappement s'applique à l'écriture. */
const RACINES_SERVEUR = ['apps/app1/server', 'layers']

/**
 * La dette, fichier par fichier, avec ce qui la tient ouverte.
 *
 * ⚠️ `validation-helpers.ts` y figure parce qu'il DÉFINIT la fonction : l'exclure par un nom de
 * fichier deviné serait une exemption muette le jour où elle déménage.
 */
const DETTE: Record<string, string> = {
  'apps/app1/server/utils/validation-helpers.ts': 'définit la fonction',
  'apps/app1/server/api/editions/[id]/posts/index.post.ts':
    'publications d’édition, rendues par interpolation — même défaut, migration à part',
  'apps/app1/server/utils/commentsHandler.ts':
    'commentaires partagés (covoiturage), rendus par interpolation',
  'layers/carpool/server/api/carpool-offers/[id]/bookings.post.ts':
    'message de réservation, rendu par interpolation',
}

async function fichiersServeur(): Promise<string[]> {
  const trouves: string[] = []
  const parcourir = async (relatif: string) => {
    for (const entree of await readdir(join(RACINE, relatif), { withFileTypes: true })) {
      if (entree.name === 'node_modules' || entree.name.startsWith('.')) continue
      const chemin = `${relatif}/${entree.name}`
      if (entree.isDirectory()) await parcourir(chemin)
      else if (entree.name.endsWith('.ts')) trouves.push(chemin)
    }
  }
  for (const racine of RACINES_SERVEUR) await parcourir(racine)
  return trouves
}

/** Les commentaires sont retirés AVANT de compter : plusieurs fichiers EXPLIQUENT cet échappement. */
const sansCommentaires = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

async function appelants(): Promise<string[]> {
  const liste: string[] = []
  for (const chemin of await fichiersServeur()) {
    const source = sansCommentaires(await readFile(join(RACINE, chemin), 'utf8'))
    if (
      /sanitizeUserContent\s*\(/.test(source) ||
      /export function sanitizeUserContent/.test(source)
    )
      liste.push(chemin)
  }
  return liste.sort()
}

describe('échappement HTML au stockage', () => {
  it('⚠️ AUCUN APPELANT NOUVEAU — chacun est classé, ou corrigé', async () => {
    const inconnus = (await appelants()).filter((c) => !(c in DETTE))

    expect(
      inconnus,
      `Ces fichiers échappent le HTML AVANT stockage. Si leur contenu est rendu par interpolation ` +
        `— ce que fait la quasi-totalité des écrans — le lecteur verra « &amp;amp; » à la place ` +
        `de « & ». Stocker le texte tel quel, ou inscrire le fichier dans la dette avec sa ` +
        `raison :\n${inconnus.join('\n')}`
    ).toEqual([])
  })

  it('les objets trouvés n’y sont PLUS — c’est ce que ce lot a corrigé', async () => {
    /*
     * L'interdiction ci-dessus est satisfaite par une dette qui grossit. Ce cas-ci fige le gain :
     * la description d'un objet trouvé est stockée telle quelle, et un retour en arrière le dit.
     */
    expect(await appelants()).not.toContain(
      'layers/lost-found/server/api/editions/[id]/lost-found/index.post.ts'
    )
  })

  it('la dette est encore vraie — une entrée périmée exempte en silence', async () => {
    const presents = new Set(await appelants())
    for (const [chemin, raison] of Object.entries(DETTE)) {
      expect(presents.has(chemin), `« ${chemin} » n'appelle plus : retirer « ${raison} »`).toBe(
        true
      )
    }
  })

  it('le balayage lit bien du code serveur — il ne conclut pas sur le vide', async () => {
    // Un chemin qui change laisserait les cas ci-dessus verts en ne lisant rien.
    expect((await fichiersServeur()).length).toBeGreaterThan(400)
  })
})
