/**
 * La fiche de restauration d'une journée, préparée pour l'impression.
 *
 * Elle existe pour le moment où l'application ne sert plus à rien : la cuisine, où l'on compte des
 * parts et où personne ne consulte un écran. Ce qu'on emporte sur papier n'est donc pas une copie
 * de la liste — c'est ce qui permet de préparer le bon nombre d'assiettes, et de ne pas servir
 * d'arachide à quelqu'un que cela enverrait à l'hôpital.
 *
 * Ce fichier décide de ce qui sort ; la page décide de la mise en page. La séparation vaut pour
 * une raison précise : une fiche imprimée ne se rattrape pas. Le régime qu'on oublie de compter
 * devient une personne qui ne mange pas, et cela se teste ici, sans jsPDF ni navigateur.
 *
 * ⚠️ Rien n'est traduit ici. Les fonctions rendent des CLÉS et des nombres ; c'est l'appelante qui
 * traduit, parce qu'elle seule a la langue du lecteur. C'est aussi ce qui permet de tester ces
 * règles sans monter i18n.
 */

/** Une personne attendue à un repas, telle que le point d'API la rend. */
export interface ParticipantDeRepas {
  type: string
  nom?: string | null
  prenom?: string | null
  dietaryPreference?: string | null
  allergies?: string | null
  allergySeverity?: string | null
  emergencyContactPhone?: string | null
  afterShow?: boolean | null
  email?: string | null
  phone?: string | null
}

/** Un repas d'une journée, avec ses comptes déjà faits par le serveur. */
export interface RepasDeRestauration {
  mealType: string
  phases: string[]
  totalParticipants: number
  volunteerCount: number
  artistCount: number
  ticketParticipantCount: number
  organizerCount: number
  participants: ParticipantDeRepas[]
}

/** Un compte, désigné par la clé de traduction de son libellé. */
export interface CompteParCle {
  cle: string
  nombre: number
}

/** Ce qu'il faut savoir d'un repas pour en imprimer le résumé. */
export interface ResumeDeRepas {
  /** Clé du type de repas — matin, midi, soir. */
  cleTypeRepas: string
  /** Clés des phases, dans l'ordre reçu : un repas peut appartenir à deux phases. */
  clesPhases: string[]
  total: number
  /**
   * Les populations présentes, dans l'ordre d'affichage.
   *
   * Les deux premières sont toujours là, même à zéro : une fiche qui tait les bénévoles laisse
   * croire qu'on a oublié de les compter. Les deux autres n'apparaissent que si quelqu'un est
   * concerné — une convention sans billetterie n'a pas à lire une ligne vide.
   */
  populations: CompteParCle[]
  /** Combien d'artistes mangent après leur passage. Zéro quand aucun : la ligne disparaît. */
  apresSpectacle: number
  /** Les régimes présents, dans un ordre fixe, les absents omis. */
  regimes: CompteParCle[]
  /** Les personnes à allergie, celles pour qui la cuisine doit faire autrement. */
  allergies: Array<{
    nom: string
    allergies: string
    /** Clé de la gravité, ou `null` quand elle n'est pas renseignée. */
    cleGravite: string | null
    telephoneUrgence: string | null
  }>
}

const CLES_TYPE_REPAS: Record<string, string> = {
  BREAKFAST: 'gestion.meals.breakfast',
  LUNCH: 'gestion.meals.lunch',
  DINNER: 'gestion.meals.dinner',
}

const CLES_PHASE: Record<string, string> = {
  SETUP: 'common.setup',
  EVENT: 'common.event',
  TEARDOWN: 'common.teardown',
}

const CLES_REGIME: Record<string, string> = {
  NONE: 'gestion.meals.diet_none',
  VEGETARIAN: 'gestion.meals.diet_vegetarian',
  VEGAN: 'gestion.meals.diet_vegan',
}

/**
 * L'ordre des régimes sur la fiche, et il n'est pas alphabétique.
 *
 * « Sans régime particulier » vient en premier parce que c'est le gros du service ; les deux
 * autres suivent, du plus large au plus étroit. Un ordre qui changerait d'un repas à l'autre
 * obligerait à relire chaque bloc au lieu de le parcourir.
 */
const ORDRE_DES_REGIMES = ['NONE', 'VEGETARIAN', 'VEGAN'] as const

/**
 * Les quatre gravités de l'énumération `AllergySeverity`, et bien quatre.
 *
 * `CRITICAL` est la raison d'être de cette colonne : c'est celle qui décide si une erreur de
 * service envoie quelqu'un à l'hôpital. En omettre une reviendrait à l'effacer de la fiche.
 */
const CLES_GRAVITE: Record<string, string> = {
  LIGHT: 'gestion.meals.severity_light',
  MODERATE: 'gestion.meals.severity_moderate',
  SEVERE: 'gestion.meals.severity_severe',
  CRITICAL: 'gestion.meals.severity_critical',
}

/** Le nom d'une personne, tel qu'on le lit sur une fiche. */
function nomLisible(p: ParticipantDeRepas): string {
  return `${p.prenom ?? ''} ${p.nom ?? ''}`.trim()
}

/**
 * Le résumé d'un repas : combien de personnes, de quelles populations, avec quels régimes.
 *
 * `NONE` et l'absence de valeur comptent ensemble. Les deux disent la même chose — pas de régime
 * particulier — mais elles n'ont pas la même origine : `NONE` vient de l'énumération des comptes,
 * l'absence vient de la billetterie, qui n'a pas d'énumération. Les séparer ferait deux lignes
 * pour une seule réalité, et le total ne tomberait plus juste.
 */
export function resumerRepas(repas: RepasDeRestauration): ResumeDeRepas {
  // Des clés PLURALISÉES, et non celles de `person_type` : « 12 Bénévole » se lit mal, et le
  // pluriel ne se fabrique pas en collant un « s » — il appartient à chaque langue.
  const populations: CompteParCle[] = [
    { cle: 'gestion.meals.count_volunteers', nombre: repas.volunteerCount },
    { cle: 'gestion.meals.count_artists', nombre: repas.artistCount },
  ]
  if (repas.ticketParticipantCount > 0) {
    populations.push({
      cle: 'gestion.meals.count_participants',
      nombre: repas.ticketParticipantCount,
    })
  }
  if (repas.organizerCount > 0) {
    populations.push({ cle: 'gestion.meals.count_organizers', nombre: repas.organizerCount })
  }

  const comptesParRegime = new Map<string, number>()
  for (const p of repas.participants) {
    const regime = p.dietaryPreference || 'NONE'
    comptesParRegime.set(regime, (comptesParRegime.get(regime) ?? 0) + 1)
  }

  const regimes: CompteParCle[] = []
  for (const regime of ORDRE_DES_REGIMES) {
    const nombre = comptesParRegime.get(regime)
    if (nombre) regimes.push({ cle: CLES_REGIME[regime]!, nombre })
  }

  const allergies = repas.participants
    .filter((p) => p.allergies && p.allergies.trim() !== '')
    .map((p) => ({
      nom: nomLisible(p),
      allergies: p.allergies!.trim(),
      cleGravite: p.allergySeverity ? (CLES_GRAVITE[p.allergySeverity] ?? null) : null,
      telephoneUrgence: p.emergencyContactPhone ?? null,
    }))

  return {
    cleTypeRepas: CLES_TYPE_REPAS[repas.mealType] ?? repas.mealType,
    clesPhases: repas.phases.map((phase) => CLES_PHASE[phase] ?? phase),
    total: repas.totalParticipants,
    populations,
    apresSpectacle: repas.participants.filter((p) => p.type === 'artist' && p.afterShow).length,
    regimes,
    allergies,
  }
}

/** Une ligne du tableau nominatif, chaque colonne déjà décidée. */
export interface LigneDeParticipant {
  nom: string
  prenom: string
  email: string
  telephone: string
  /** Clé du type de personne — bénévole, artiste, participant, organisateur. */
  cleType: string
  /** Le type brut, pour la couleur : lire le suffixe d'une clé de traduction serait fragile. */
  type: string
  /** Clé du régime, ou `null` quand il n'y a rien à signaler à la cuisine. */
  cleRegime: string | null
  allergies: string | null
  cleGravite: string | null
  telephoneUrgence: string | null
  /** Vrai seulement pour un artiste qui mange après son passage. */
  apresSpectacle: boolean
}

/**
 * Les lignes nominatives d'un repas, dans l'ordre reçu.
 *
 * `cleRegime` vaut `null` pour « sans régime particulier » : la colonne reste vide plutôt que de
 * répéter la même mention sur presque chaque ligne. Ce qui doit sauter aux yeux, c'est l'exception.
 */
export function lignesDeParticipants(repas: RepasDeRestauration): LigneDeParticipant[] {
  return repas.participants.map((p) => {
    const regime = p.dietaryPreference || 'NONE'
    return {
      nom: p.nom ?? '',
      prenom: p.prenom ?? '',
      email: p.email ?? '',
      telephone: p.phone ?? '',
      cleType: `gestion.meals.person_type.${p.type}`,
      type: p.type ?? '',
      cleRegime: regime === 'NONE' ? null : (CLES_REGIME[regime] ?? null),
      allergies: p.allergies && p.allergies.trim() !== '' ? p.allergies.trim() : null,
      cleGravite: p.allergySeverity ? (CLES_GRAVITE[p.allergySeverity] ?? null) : null,
      telephoneUrgence: p.emergencyContactPhone ?? null,
      apresSpectacle: p.type === 'artist' && p.afterShow === true,
    }
  })
}

/**
 * Le nom d'un des fichiers de la journée.
 *
 * La feuille de restauration ne sort plus d'un bloc : le résumé part en cuisine, chaque liste
 * part à son point de distribution. Quatre fichiers téléchargés d'affilée doivent donc se
 * reconnaître sans qu'on les ouvre — d'où la date ET la partie dans le nom.
 *
 * Accents retirés et ponctuation remplacée par un tiret, comme la fiche d'inventaire. L'ancien
 * nom se contentait d'un `replace` sur les caractères non alphanumériques : « Été à Brévent »
 * y devenait « -t-à-Br-vent », un tiret là où il y avait une lettre.
 */
export function nomFichierRestauration(
  nomEdition: string | null | undefined,
  date: string,
  partie: string
): string {
  const morceaux = [nomEdition, date, partie]
    .map((morceau) =>
      (morceau ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
    )
    .filter(Boolean)

  // L'extension à part, jamais collée dans un littéral avec ce qui la précède : une chaîne
  // pointée entière — « restauration.pdf » — se fait prendre pour une clé de traduction par
  // l'analyse i18n, qui la signale alors comme manquante.
  const extension = '.pdf'
  return morceaux.length > 0
    ? `restauration-${morceaux.join('-')}${extension}`
    : `restauration${extension}`
}

/**
 * Le mot le plus long d'une colonne — celui qui décide de sa largeur.
 *
 * Un PDF coupe une cellule trop étroite **au milieu d'un mot** : `gerard@jongli` puis `ertricks.ch`
 * sur la ligne suivante. Sur une adresse ou un nom, c'est illisible, et sur une feuille qu'on
 * emporte au service il n'y a pas d'écran pour aller vérifier.
 *
 * Le remède tient en une phrase : aucune colonne ne doit être plus étroite que son plus long mot.
 * Reste à savoir lequel c'est, et cela dépend des données — d'où cette fonction plutôt qu'une
 * largeur choisie une fois pour toutes, qui serait fausse à la première édition suivante.
 *
 * « Mot » veut dire : suite de caractères sans espace. C'est exactement ce qu'un moteur de rendu
 * refuse de couper tant qu'il peut l'éviter. Une adresse électronique n'en fait qu'un seul, ce
 * qui explique qu'elle soit la première à déborder.
 */
export function motLePlusLong(valeurs: readonly (string | null | undefined)[]): string {
  let plusLong = ''

  for (const valeur of valeurs) {
    for (const mot of (valeur ?? '').split(/\s+/)) {
      if (mot.length > plusLong.length) plusLong = mot
    }
  }

  return plusLong
}

/** Une couleur de cellule : le fond et le texte, en composantes RVB pour jsPDF. */
export interface CouleurDeType {
  fond: [number, number, number]
  texte: [number, number, number]
}

/**
 * La couleur d'un type de personne, sur la feuille imprimée.
 *
 * Les teintes sont celles de l'écran — les statistiques d'entrée du contrôle d'accès les posent
 * déjà : vert pour les bénévoles, jaune pour les artistes, violet pour les organisateurs, bleu
 * pour la billetterie. Reconnaître un type à sa couleur ne doit pas demander de réapprendre un
 * code d'une page à l'autre.
 *
 * Les NUANCES, elles, sont celles du papier : fond en 100 et texte en 700, là où l'écran emploie
 * 50 et 600. Un fond à 50 disparaît à l'impression, surtout sur une imprimante qui rend le jaune
 * plus pâle que l'écran ; et sur une photocopie en niveaux de gris, les quatre teintes doivent
 * rester quatre gris distincts.
 *
 * Un type inconnu ne rend RIEN plutôt qu'une couleur par défaut : une cellule grise au milieu de
 * quatre couleurs se lit comme une cinquième catégorie, et l'on cherche laquelle.
 */
export function couleurDuType(type: string | null | undefined): CouleurDeType | null {
  const couleurs: Record<string, CouleurDeType> = {
    // vert
    volunteer: { fond: [220, 252, 231], texte: [21, 128, 61] },
    // jaune
    artist: { fond: [254, 249, 195], texte: [161, 98, 7] },
    // violet
    organizer: { fond: [243, 232, 255], texte: [126, 34, 206] },
    // bleu
    participant: { fond: [219, 234, 254], texte: [29, 78, 216] },
  }

  return couleurs[type ?? ''] ?? null
}
