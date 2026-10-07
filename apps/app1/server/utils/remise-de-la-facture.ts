/**
 * Déposer la facture vaut remise : ce que l'écriture doit poser sur `invoiceProvided`.
 *
 * C'est l'ARTISTE qui fournit sa facture — il la remet à la convention, pas l'inverse. Un fichier
 * déposé est donc la remise elle-même, et laisser la case à décocher produirait l'état que personne
 * ne sait trancher : une facture visible, et l'écran de gestion qui annonce qu'on l'attend encore.
 *
 * ⚠️ UN RETRAIT NE DÉCOCHE PAS, et c'est délibéré. La case reste cochable seule, pour une facture
 * reçue par courriel ou sur papier : la décocher au retrait du fichier effacerait en silence ce
 * qu'un organisateur a saisi à la main. L'absence de pièce n'est pas une rétractation — et
 * l'organisateur garde la main pour décocher lui-même.
 *
 * 📍 Appelé par les DEUX points d'écriture, celui de l'artiste (`my-payment-info.put.ts`) et celui
 * de la gestion (`artists/[artistId].put.ts`). La règle n'est écrite qu'ici : recopiée, elle aurait
 * fini par diverger entre les deux côtés, et le désaccord se serait lu comme une donnée.
 *
 * @param justificatifs les champs de justificatifs effectivement écrits par cet appel. Un champ
 *   ABSENT de cet objet n'est pas touché : il ne dit rien de la facture, et ne doit rien changer.
 */
export function remiseDeLaFacture(justificatifs: Record<string, string | null>): {
  invoiceProvided?: true
} {
  if (!('invoiceUrl' in justificatifs)) return {}
  return justificatifs.invoiceUrl ? { invoiceProvided: true } : {}
}
