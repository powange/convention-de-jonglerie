/**
 * Le planning d'un bénévole, pour son agenda — constat B6.
 *
 * ## Ce qui n'allait pas
 *
 * La génération vivait en ligne dans `TimeSlotsList.vue`, par concaténation, **sans aucun
 * échappement** :
 *
 * 1. `SUMMARY:${slot.title}` alors que `title` est **nullable** en base et rendu tel quel par le
 *    serveur. Un créneau sans titre — cas courant, l'équipe faisant office de nom — exportait
 *    littéralement **« null »** dans l'agenda du bénévole ;
 * 2. ni `SUMMARY`, ni `DESCRIPTION`, ni `LOCATION` n'échappaient la virgule, le point-virgule et
 *    l'antislash (RFC 5545 §3.3.11). Une description comme « Prévoir gants, gilet ; se présenter
 *    au point B » est alors tronquée ou rejetée selon l'agenda ;
 * 3. aucune ligne n'était repliée à 75 octets, et un **vrai retour à la ligne** dans la
 *    description cassait l'objet suivant — donc, silencieusement, les créneaux d'après.
 *
 * ## Pourquoi un util pur, sans aucun import
 *
 * Même raison que `planning-pdf.ts`, dont l'en-tête la pose : **en ne rendant que des valeurs, la
 * question de l'échappement ne se pose plus qu'à un seul endroit**, et elle devient vérifiable. Un
 * échappement écrit sur place se paie au premier caractère oublié, et rien à l'écran ne le dit —
 * c'est l'agenda du bénévole qui refuse le fichier, trois jours plus tard.
 */

/** Ce qu'il faut d'un créneau pour l'écrire dans un agenda. */
export interface CreneauIcs {
  id: string
  /** ⚠️ NULLABLE en base, et c'est le défaut d'origine : il sortait en « null ». */
  title?: string | null
  startDateTime: string | Date
  endDateTime: string | Date
  delayMinutes?: number | null
  description?: string | null
  team?: { name?: string | null } | null
}

export interface OptionsIcs {
  /**
   * Libellé quand ni le titre ni l'équipe ne nomment le créneau.
   *
   * Passé par l'appelant plutôt que codé ici : un mot français en dur s'afficherait tel quel dans
   * l'agenda d'un lecteur allemand, et le défaut ne concernerait que lui — donc invisible.
   */
  titreParDefaut: string
  /** Préfixe de la ligne d'équipe dans la description, traduit par l'appelant. */
  libelleEquipe: string
  /** Figeable pour les tests : `DTSTAMP` vaut sinon l'instant courant. */
  maintenant?: Date
}

/**
 * L'échappement de la RFC 5545 §3.3.11.
 *
 * ⚠️ L'ANTISLASH EN PREMIER, et ce n'est pas indifférent : l'échapper après la virgule
 * doublerait les antislashs qu'on vient d'introduire — « a,b » donnerait « a\\,b » au lieu de
 * « a\,b », et l'agenda afficherait l'antislash.
 *
 * Les retours à la ligne, réels ou en `\r\n`, deviennent la séquence `\n` littérale. Sans cela
 * une description multiligne termine l'objet `VEVENT` au milieu, et tout ce qui suit est perdu
 * sans message.
 */
export function echapperIcs(valeur: string): string {
  return valeur
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Le repli des lignes longues : 75 **octets**, pas 75 caractères.
 *
 * ⚠️ C'EST LA DISTINCTION QUI COMPTE. « é » pèse deux octets en UTF-8 : couper à 75 caractères
 * dépasse la limite, et couper au milieu d'un caractère produit un octet orphelin que l'agenda
 * refuse — sur un planning français, où les accents sont partout.
 *
 * Les lignes de continuation commencent par une espace, que le lecteur retire en recollant. Elle
 * compte dans les 75 octets, d'où 74 utiles à partir de la deuxième.
 */
export function replierLigne(ligne: string): string {
  const encodeur = new TextEncoder()
  if (encodeur.encode(ligne).length <= 75) return ligne

  const morceaux: string[] = []
  let courant = ''
  let octets = 0
  let limite = 75

  for (const caractere of ligne) {
    const poids = encodeur.encode(caractere).length
    if (octets + poids > limite) {
      morceaux.push(courant)
      courant = caractere
      octets = poids
      // Dès la deuxième ligne, l'espace de continuation prend un octet sur les 75.
      limite = 74
    } else {
      courant += caractere
      octets += poids
    }
  }
  morceaux.push(courant)

  return morceaux.map((m, i) => (i === 0 ? m : ` ${m}`)).join('\r\n')
}

/** `YYYYMMDDTHHMMSSZ` — en UTC, donc sans ambiguïté de fuseau pour l'agenda qui le lit. */
function instantIcs(date: Date): string {
  const deuxChiffres = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getUTCFullYear()}${deuxChiffres(date.getUTCMonth() + 1)}${deuxChiffres(date.getUTCDate())}` +
    `T${deuxChiffres(date.getUTCHours())}${deuxChiffres(date.getUTCMinutes())}${deuxChiffres(date.getUTCSeconds())}Z`
  )
}

/**
 * Le nom affiché du créneau, avec son repli.
 *
 * L'ordre est celui de l'écran : son titre s'il en a un, sinon le nom de l'équipe — qui fait
 * office de nom dans la plupart des plannings —, sinon le libellé fourni.
 */
function titreDuCreneau(creneau: CreneauIcs, options: OptionsIcs): string {
  const titre = creneau.title?.trim()
  if (titre) return titre
  const equipe = creneau.team?.name?.trim()
  if (equipe) return equipe
  return options.titreParDefaut
}

export function genererIcs(creneaux: readonly CreneauIcs[], options: OptionsIcs): string {
  const horodatage = instantIcs(options.maintenant ?? new Date())

  const lignes: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Convention de Jonglerie//Planning Bénévoles//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const creneau of creneaux) {
    const debut = new Date(creneau.startDateTime)
    const fin = new Date(creneau.endDateTime)
    const retard = creneau.delayMinutes ?? 0
    if (retard) {
      debut.setMinutes(debut.getMinutes() + retard)
      fin.setMinutes(fin.getMinutes() + retard)
    }

    /*
     * La description est composée de MORCEAUX échappés séparément, puis recollés par la séquence
     * `\n` littérale.
     *
     * ⚠️ Échapper la chaîne déjà recollée transformerait ce séparateur VOULU en `\\n`, et
     * l'agenda afficherait « \n » au milieu du texte. C'est le piège de tout échappement appliqué
     * après composition.
     */
    const morceaux: string[] = []
    const equipe = creneau.team?.name?.trim()
    if (equipe) morceaux.push(echapperIcs(`${options.libelleEquipe} ${equipe}`))
    const description = creneau.description?.trim()
    if (description) morceaux.push(echapperIcs(description))

    lignes.push(
      'BEGIN:VEVENT',
      `UID:${creneau.id}@convention-de-jonglerie.fr`,
      `DTSTAMP:${horodatage}`,
      `DTSTART:${instantIcs(debut)}`,
      `DTEND:${instantIcs(fin)}`,
      replierLigne(`SUMMARY:${echapperIcs(titreDuCreneau(creneau, options))}`)
    )
    if (morceaux.length > 0) {
      lignes.push(replierLigne(`DESCRIPTION:${morceaux.join('\\n')}`))
    }
    if (equipe) {
      lignes.push(replierLigne(`LOCATION:${echapperIcs(equipe)}`))
    }
    lignes.push('STATUS:CONFIRMED', 'SEQUENCE:0', 'END:VEVENT')
  }

  lignes.push('END:VCALENDAR')

  return lignes.join('\r\n')
}
