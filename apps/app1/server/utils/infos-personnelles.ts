/**
 * Régime, allergies et contact d'urgence : le profil fait foi.
 *
 * Ces cinq informations décrivent une PERSONNE, pas une participation. Elles vivent désormais
 * sur `User`, et c'est là qu'il faut les lire — plutôt que sur la copie que chaque
 * `EditionVolunteerApplication` en conservait, qui pouvait diverger d'une édition à l'autre.
 *
 * Un repli sur la candidature reste en place pendant la transition. Il ne contredit jamais le
 * profil : il ne s'applique qu'aux champs que le profil laisse vides. Sans lui, une allergie
 * saisie il y a six mois dans une candidature disparaîtrait de la vue des organisateurs le jour
 * du déploiement, sans que personne ne l'ait décidé. Il disparaîtra avec les colonnes
 * dupliquées, une fois la reprise vérifiée en production.
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

/**
 * Les informations à afficher : celles du profil, complétées par celles de la candidature là où
 * le profil ne dit rien.
 *
 * `NONE` vaut « rien dit » pour le régime : c'est la valeur par défaut de la colonne, on ne peut
 * pas la distinguer d'un choix délibéré. Pendant la transition, mieux vaut donc afficher le
 * régime déclaré dans la candidature que de le remplacer par un « aucun régime » qui ferait
 * servir de la viande à quelqu'un qui n'en mange pas.
 */
export function infosPersonnelles(profil: Source, repli?: Source): InfosPersonnelles {
  const regimeProfil = profil?.dietaryPreference
  return {
    dietaryPreference:
      regimeProfil && regimeProfil !== 'NONE'
        ? regimeProfil
        : (repli?.dietaryPreference ?? regimeProfil ?? 'NONE'),
    allergies: profil?.allergies ?? repli?.allergies ?? null,
    allergySeverity: profil?.allergySeverity ?? repli?.allergySeverity ?? null,
    emergencyContactName: profil?.emergencyContactName ?? repli?.emergencyContactName ?? null,
    emergencyContactPhone: profil?.emergencyContactPhone ?? repli?.emergencyContactPhone ?? null,
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
