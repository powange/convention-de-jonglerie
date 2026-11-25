/**
 * Régime, allergies et contact d'urgence : le profil fait foi.
 *
 * Ces cinq informations décrivent une PERSONNE, pas une participation. Elles vivent désormais
 * sur `User`, et c'est là qu'il faut les lire — plutôt que sur la copie que chaque
 * `EditionVolunteerApplication` en conservait, qui pouvait diverger d'une édition à l'autre.
 *
 * Un repli sur la fiche a accompagné la transition, le temps de vérifier que la reprise des
 * données n'avait rien laissé de côté. Le contrôle a été fait sur les données de production —
 * 63 valeurs portées par une fiche, toutes présentes sur le profil correspondant, zéro
 * manquante — et les colonnes dupliquées ont été supprimées dans la foulée. Le repli n'a donc
 * plus d'objet.
 */

export type RegimeAlimentaire = 'NONE' | 'VEGETARIAN' | 'VEGAN'
export type GraviteAllergie = 'LIGHT' | 'MODERATE' | 'SEVERE' | 'CRITICAL'

export interface InfosPersonnelles {
  dietaryPreference: RegimeAlimentaire
  allergies: string | null
  allergySeverity: GraviteAllergie | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
}

/** À étendre dans un `select` Prisma sur `user`. */
export const infosPersonnellesSelect = {
  dietaryPreference: true,
  allergies: true,
  allergySeverity: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
} as const

type Source = Partial<InfosPersonnelles> | null | undefined

/** Les informations à afficher : celles du profil, qui est désormais la seule source. */
export function infosPersonnelles(profil: Source): InfosPersonnelles {
  return {
    dietaryPreference: profil?.dietaryPreference ?? 'NONE',
    allergies: profil?.allergies ?? null,
    allergySeverity: profil?.allergySeverity ?? null,
    emergencyContactName: profil?.emergencyContactName ?? null,
    emergencyContactPhone: profil?.emergencyContactPhone ?? null,
  }
}

/**
 * Ce qu'il faut écrire sur le profil quand quelqu'un renseigne ces informations ailleurs.
 *
 * Ne remplit que les vides : une candidature ne doit pas pouvoir écraser ce que la personne a
 * elle-même mis dans son profil. Rend `{}` s'il n'y a rien à compléter, pour éviter une
 * écriture inutile.
 */
export function complementsPourLeProfil(
  profil: Source,
  saisie: Source
): Partial<InfosPersonnelles> {
  const patch: Partial<InfosPersonnelles> = {}

  const regimeProfil = profil?.dietaryPreference
  const regimeSaisi = saisie?.dietaryPreference
  if ((!regimeProfil || regimeProfil === 'NONE') && regimeSaisi && regimeSaisi !== 'NONE') {
    patch.dietaryPreference = regimeSaisi
  }

  for (const champ of [
    'allergies',
    'allergySeverity',
    'emergencyContactName',
    'emergencyContactPhone',
  ] as const) {
    const valeur = saisie?.[champ]
    if (!profil?.[champ] && valeur) patch[champ] = valeur as never
  }

  return patch
}

/**
 * Ce qu'il faut écrire sur le profil quand quelqu'un soumet un formulaire qui porte ces champs.
 *
 * Deux régimes bien distincts, selon qui remplit :
 *
 * — **L'intéressé lui-même.** Son formulaire a été pré-rempli depuis son profil ; ce qu'il
 *   renvoie EST sa déclaration, y compris quand il corrige ou efface. Se contenter de combler
 *   les vides annulerait silencieusement toute correction : le profil garderait l'ancienne
 *   valeur, et comme c'est lui qui fait foi à la lecture, la modification n'apparaîtrait nulle
 *   part. Défaut constaté après coup, d'où ce traitement séparé.
 * — **Quelqu'un d'autre** — un organisateur qui corrige la candidature d'un bénévole. Il
 *   complète ce qui manque, il ne réécrit pas le profil d'autrui.
 *
 * Un champ absent de la saisie (`undefined`) n'est jamais touché : toutes les éditions ne
 * demandent pas les mêmes informations, et ce qui n'est pas demandé ne doit rien effacer.
 */
export function misesAJourDuProfil(
  profil: Source,
  saisie: Source,
  options: { estLInteresse: boolean }
): Partial<InfosPersonnelles> {
  if (!options.estLInteresse) return complementsPourLeProfil(profil, saisie)

  const patch: Partial<InfosPersonnelles> = {}

  const regimeSaisi = saisie?.dietaryPreference
  if (regimeSaisi !== undefined && regimeSaisi !== profil?.dietaryPreference) {
    patch.dietaryPreference = regimeSaisi
  }

  for (const champ of [
    'allergies',
    'allergySeverity',
    'emergencyContactName',
    'emergencyContactPhone',
  ] as const) {
    const valeur = saisie?.[champ]
    if (valeur === undefined) continue
    const normalisee = (valeur === '' ? null : valeur) as never
    if (normalisee !== (profil?.[champ] ?? null)) patch[champ] = normalisee
  }

  return patch
}

/** Les seuls champs alimentaires, pour les porteurs qui n'ont pas de contact d'urgence. */
export type InfosAlimentaires = Pick<
  InfosPersonnelles,
  'dietaryPreference' | 'allergies' | 'allergySeverity'
>

/**
 * Variante restreinte au régime et aux allergies.
 *
 * Artistes et organisateurs ne déclarent pas de contact d'urgence : leur rendre les cinq champs
 * ferait échouer la compilation sur les propriétés en trop, et laisserait croire à une donnée
 * qui n'existe pas de leur côté.
 */
export function infosAlimentaires(profil: Source): InfosAlimentaires {
  const { dietaryPreference, allergies, allergySeverity } = infosPersonnelles(profil)
  return { dietaryPreference, allergies, allergySeverity }
}
