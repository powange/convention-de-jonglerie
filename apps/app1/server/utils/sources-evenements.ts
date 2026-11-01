/**
 * Le contrat d'une SOURCE d'événements extérieure.
 *
 * ## Pourquoi ce fichier existe avant qu'il y ait deux sources
 *
 * La veille des conventions commence par JugglingEdge, mais l'écran d'administration ne doit pas
 * être « la page JugglingEdge » : d'autres sites publient des agendas, et les accueillir ne doit
 * pas demander de réécrire l'écran. Ce fichier fixe donc d'emblée ce qu'une source doit savoir
 * faire — énumérer sa liste, et reconnaître une de ses URL d'événement —, et ce qu'elle rend.
 *
 * Il ne contient volontairement **aucune implémentation** : la première vit dans
 * `jugglingedge-scraper.ts`, à côté du scraper d'un événement unique qui existait déjà.
 */

/**
 * Un événement vu dans la liste d'une source, avant tout jugement.
 *
 * ⚠️ Rien n'est NORMALISÉ ici, et c'est délibéré. Le pays est écrit comme la source l'écrit — la
 * version française de JugglingEdge rend « Pays-Bas » et « le Portugal », l'anglaise rendrait
 * autre chose. Normaliser au moment de la lecture reviendrait à décider trop tôt, et à perdre ce
 * que la source a réellement dit. Le tri et l'affichage s'en chargent plus haut.
 */
export interface CandidatExterne {
  /**
   * L'URL CANONIQUE de l'événement, telle que la source la désigne.
   *
   * 📍 C'est la clé de tout le dispositif : le refus que porte un administrateur s'y attache, et
   * c'est elle qu'on compare aux éditions déjà importées. Une source qui désignerait le même
   * événement sous deux URL ferait réapparaître ce qu'on a écarté — d'où l'exigence de prendre
   * l'URL que la source donne elle-même, et jamais celle qu'on a suivie pour arriver là.
   */
  url: string
  /** Son identifiant chez la source, quand elle en expose un. Pour le journal, pas pour la clé. */
  identifiantSource: string | null
  titre: string
  /** Date de début au format ISO court (AAAA-MM-JJ), quand la liste la donne. */
  debut: string | null
  /** Durée annoncée en JOURS. Indice utile, jamais un verdict : voir `SourceEvenements`. */
  jours: number | null
  /** Le pays tel que la source l'écrit. Non normalisé, voir l'avertissement ci-dessus. */
  pays: string | null
  /** Nom du lieu, quand il est distinct de l'adresse. */
  lieu: string | null
  adresse: string | null
}

/**
 * Ce qu'une source d'événements doit savoir faire.
 *
 * ⚠️ Aucune source ne JUGE si un événement est une convention de jonglerie. Elle énumère et elle
 * décrit ; le tri se décide ailleurs, et le dernier mot revient à un humain. Mélanger les deux
 * rendrait chaque source responsable d'une règle qui, elle, doit rester unique et comparable d'une
 * source à l'autre.
 */
export interface SourceEvenements {
  /** Identifiant court et stable, rangé en base avec les candidats. */
  cle: string
  /** Nom lisible, pour l'écran d'administration. */
  nom: string
  /** L'agenda d'où viennent les candidats, pour qu'on puisse l'ouvrir à la main. */
  urlDeLaListe: string
  /** Énumère la liste. Rend un tableau vide plutôt que d'échouer sur une page illisible. */
  lister: () => Promise<CandidatExterne[]>
  reconnaitUrl: (url: string) => boolean
  /**
   * Ramène deux ÉCRITURES de la même URL à une clé commune, pour le rapprochement.
   *
   * ## ⚠️ POURQUOI C'EST À LA SOURCE DE LE FAIRE, et pas à une règle générale
   *
   * MESURÉ le 1er novembre 2026 sur les onze éditions déjà importées depuis JugglingEdge : elles
   * stockent leur URL d'origine sur DEUX hôtes — `www.jugglingedge.com` pour la plupart,
   * `fr.jugglingedge.com` pour au moins deux — tandis que l'énumération de l'agenda canonicalise
   * sur `jugglingedge.com`, sans sous-domaine. Trois écritures pour le même événement.
   *
   * Une comparaison de chaînes n'en apparierait AUCUNE : le calcul « déjà importé » ne trouverait
   * jamais rien, et l'écran reproposerait indéfiniment des conventions déjà en base — sans qu'aucune
   * erreur ne le signale.
   *
   * Une règle générale du type « retirer un sous-domaine de deux lettres » marcherait ici et
   * apparierait à tort, ailleurs, deux ressources distinctes — et un faux appariement est le sens
   * dangereux : il ferait passer pour importé ce qui ne l'est pas, donc disparaître un candidat.
   * Chaque source sait, elle, ce qui désigne le même événement chez elle.
   *
   * Rend `null` quand l'URL ne relève pas de cette source, ou qu'elle n'y est pas identifiable.
   */
  cleDeRapprochement: (url: string) => string | null
}
