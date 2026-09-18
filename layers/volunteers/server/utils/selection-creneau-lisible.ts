/**
 * Les champs d'un créneau nécessaires pour l'ANNONCER à quelqu'un.
 *
 * Quatre points d'API décrivaient cette sélection chacun de leur côté, à l'identique : les
 * échanges en cours, ceux en attente, les candidats à l'échange, et mes affectations. Les quatre
 * omettaient `delayMinutes` — et les écrans qui les consomment annonçaient donc l'heure
 * enregistrée plutôt que l'heure réelle d'un créneau décalé.
 *
 * Une règle recopiée quatre fois est une règle qu'on corrigera trois fois. Elle est donc écrite
 * ici, une seule fois, et le test qui l'accompagne tient la présence de `delayMinutes`.
 *
 * ⚠️ Volontairement SANS les personnes affectées : ce qui est décrit ici sert à nommer un
 * créneau, pas à dire qui le tient. Les points d'API qui ont besoin des deux ajoutent leur
 * propre sélection de personnes, avec les règles de confidentialité qui vont avec.
 */
export const selectionCreneauLisible = {
  id: true,
  title: true,
  startDateTime: true,
  endDateTime: true,
  delayMinutes: true,
  team: { select: { id: true, name: true, color: true } },
} as const
