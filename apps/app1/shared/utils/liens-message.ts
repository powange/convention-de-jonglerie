/**
 * Découpe le texte d'un message en morceaux de texte et en liens, pour rendre les adresses
 * cliquables.
 *
 * On découpe plutôt que de produire du HTML : l'écran affiche chaque morceau par interpolation,
 * que Vue échappe. Un message ne peut donc rien injecter dans la page — ce qu'un `v-html` sur
 * un texte « linkifié » aurait permis au premier `<img onerror>` venu.
 *
 * Ce qui devient un lien : ce qui commence par `http://`, `https://` ou `www.`. Un domaine nu
 * (« site.fr ») reste du texte, délibérément : « fichier.pdf » ou « M.Dupont » y ressemblent
 * trop pour qu'on les distingue sans se tromper.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

export type MorceauDeMessage =
  | { type: 'texte'; texte: string }
  | { type: 'lien'; texte: string; href: string }

// S'arrête au premier blanc ou chevron : `<https://…>` est une manière courante d'encadrer une URL.
const ADRESSE = /\b(?:https?:\/\/|www\.)[^\s<>]+/gi

/**
 * La ponctuation qui termine une phrase n'appartient pas à l'adresse qui la précède :
 * « voir https://site.fr. » vise `https://site.fr`. Une parenthèse fermante n'est retirée que
 * si elle n'a pas d'ouvrante dans l'adresse — `…/wiki/Jonglerie_(art)` la garde.
 */
function retirerPonctuationFinale(adresse: string): string {
  let fin = adresse.length
  while (fin > 0) {
    const car = adresse[fin - 1]
    if ('.,;:!?\'"'.includes(car)) {
      fin--
      continue
    }
    if (car === ')') {
      const partie = adresse.slice(0, fin)
      const ouvrantes = partie.split('(').length - 1
      const fermantes = partie.split(')').length - 1
      if (fermantes > ouvrantes) {
        fin--
        continue
      }
    }
    break
  }
  return adresse.slice(0, fin)
}

export function decouperLiensMessage(texte: string): MorceauDeMessage[] {
  const morceaux: MorceauDeMessage[] = []
  let curseur = 0

  for (const trouve of texte.matchAll(ADRESSE)) {
    const debut = trouve.index ?? 0
    const adresse = retirerPonctuationFinale(trouve[0])
    // « www. » tout seul, ou « https:// » suivi d'une ponctuation : rien à viser.
    if (/^(?:https?:\/\/|www\.)$/i.test(adresse)) continue

    if (debut > curseur) morceaux.push({ type: 'texte', texte: texte.slice(curseur, debut) })
    morceaux.push({
      type: 'lien',
      texte: adresse,
      href: /^https?:\/\//i.test(adresse) ? adresse : `https://${adresse}`,
    })
    curseur = debut + adresse.length
  }

  if (curseur < texte.length) morceaux.push({ type: 'texte', texte: texte.slice(curseur) })
  return morceaux
}
