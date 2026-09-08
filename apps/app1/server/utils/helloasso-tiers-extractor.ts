/**
 * Les tarifs d'une billetterie HelloAsso, relevés dans la page.
 *
 * Le JSON-LD de la page annonce bien chaque tarif, mais réduit à un nom et un prix. Or ce qui
 * sert à comprendre une convention est justement ce qu'il jette : « donne accès au gymnase
 * (+douches), aux spectacles+GALA, ateliers, camping & aux petits déj' ! ». Cette phrase-là dit
 * les services offerts, et elle n'existe que dans le corps de la page.
 *
 * Le texte brut la contient aussi, mais noyée : il part en dernier dans le budget envoyé au
 * modèle, et se fait couper avant les tarifs sur une page un peu longue. La relever ici en fait
 * une donnée structurée, transmise avant le reste.
 */

/** Un tarif de billetterie, tel que la page le présente. */
export interface TarifBilletterie {
  /** Intitulé du tarif, ex. « PASS 3 JOURS ». */
  nom: string
  /** Ce que le tarif comprend, tel que l'organisateur l'a écrit. Vide s'il n'a rien précisé. */
  description: string
  /** Prix affiché, ex. « 25€ ». Vide pour un tarif libre ou une valeur absente. */
  prix: string
}

/** Les classes que HelloAsso pose sur chaque bloc de tarif. */
const TITRE = /class="[^"]*tier-item-description__title[^"]*"[^>]*>([\s\S]*?)<\/p>/
const DESCRIPTION = /class="[^"]*tier-item-description__description[^"]*"[^>]*>([\s\S]*?)<\/p>/
const PRIX = /class="[^"]*tier-item-price-fixed[^"]*"[^>]*>([\s\S]*?)<\/p>/

/**
 * Un bloc de tarif court d'un intitulé au suivant : description et prix appartiennent au tarif
 * qui les précède. Découper ainsi évite d'associer le prix d'un tarif à l'intitulé d'un autre.
 */
const BLOCS =
  /class="[^"]*tier-item-description__title[^"]*"[\s\S]*?(?=class="[^"]*tier-item-description__title[^"]*"|$)/g

/** Réduit un fragment de HTML au texte qu'il affiche. */
function texteDeBloc(fragment: string): string {
  return fragment
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;|&apos;/g, "'")
    .replace(/&euro;/g, '€')
    .split('\n')
    .map((ligne) => ligne.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

/**
 * Relève les tarifs d'une page de billetterie HelloAsso.
 *
 * Rend une liste vide pour toute autre page : l'appel est donc sans effet ailleurs, et il n'y a
 * pas à savoir d'avance sur quel site on se trouve.
 */
export function extractHelloAssoTiers(html: string): TarifBilletterie[] {
  const tarifs: TarifBilletterie[] = []

  for (const bloc of html.match(BLOCS) ?? []) {
    // Le bloc commence à l'attribut de classe, pas à la balise : on lui rend son chevron pour
    // que les motifs, qui attendent une balise complète, retrouvent leurs marques.
    const fragment = `<p ${bloc}`

    const nom = texteDeBloc(fragment.match(TITRE)?.[1] ?? '')
    if (!nom) continue

    tarifs.push({
      nom,
      description: texteDeBloc(fragment.match(DESCRIPTION)?.[1] ?? ''),
      prix: texteDeBloc(fragment.match(PRIX)?.[1] ?? ''),
    })
  }

  return tarifs
}
