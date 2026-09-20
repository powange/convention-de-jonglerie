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
      cleRegime: regime === 'NONE' ? null : (CLES_REGIME[regime] ?? null),
      allergies: p.allergies && p.allergies.trim() !== '' ? p.allergies.trim() : null,
      cleGravite: p.allergySeverity ? (CLES_GRAVITE[p.allergySeverity] ?? null) : null,
      telephoneUrgence: p.emergencyContactPhone ?? null,
      apresSpectacle: p.type === 'artist' && p.afterShow === true,
    }
  })
}
