/**
 * L'heure d'un trajet de covoiturage, telle qu'on l'affiche partout dans le module.
 *
 * ⚠️ FUSEAU DU NAVIGATEUR, délibérément. La décision est prise et documentée à la saisie
 * (`FormBase.vue`, schéma `tripDate`) : contrairement aux horaires d'un programme, d'un atelier ou
 * d'une réservation de matériel, un départ en covoiturage n'est pas une heure de la convention.
 * « Je pars samedi 8 h de Lyon » désigne 8 h à Lyon, pas 8 h sur le lieu de l'événement — et le
 * fuseau de la ville de départ n'est pas connu, seule l'adresse l'est, en texte libre. Le fuseau de
 * qui publie reste le meilleur indice disponible. Ne pas « corriger » par réflexe d'uniformité.
 *
 * POURQUOI CE FICHIER EXISTE. L'affichage ne suivait pas cette règle, et pas de la même façon d'un
 * écran à l'autre : la carte d'une offre forçait `Europe/Paris`, son détail prenait le navigateur,
 * et les deux écrans d'une demande passaient par le `formatDate` partagé, qui force aussi
 * `Europe/Paris`. Hors de France, une même offre affichait donc DEUX heures différentes selon qu'on
 * la lisait dans la liste ou dans son détail — sans que rien ne dise laquelle était la bonne.
 *
 * `formatDate` (`app/utils/date.ts`) n'est pas modifiée : elle est partagée par des surfaces qui ont
 * besoin, elles, d'une heure ancrée sur place.
 *
 * La locale est un PARAMÈTRE et non un appel à `useI18n()` : les quatre composants appelaient ce
 * dernier depuis l'intérieur de leur fonction de formatage, donc hors de leur `setup`. Cela
 * fonctionne au rendu, mais laisse la fonction inutilisable ailleurs — et intestable.
 */

/** Le fuseau n'est pas passé à `Intl` : sans l'option, il utilise celui de la machine. */
const FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
}

/**
 * « samedi 15 juin, 08:00 » — jour et heure, sans l'année.
 *
 * Pas d'année, contrairement à ce que `formatDate(..., { format: 'long' })` rendait sur les deux
 * écrans d'une demande : un trajet se publie pour les jours qui viennent, et l'année n'apporte rien
 * à qui cherche un covoiturage pour ce week-end. Les cartes d'offre n'en affichaient déjà pas.
 *
 * Rend `''` sur une date illisible, comme `formatDate` : mieux vaut une ligne vide qu'un
 * « Invalid Date » dans une carte.
 */
export function formatCarpoolDate(date: string | Date | null | undefined, locale = 'fr'): string {
  if (!date) return ''
  const valeur = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(valeur.getTime())) return ''
  return valeur.toLocaleString(locale, FORMAT)
}
