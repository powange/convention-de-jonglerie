// ⚠️ CONTRAT (non encore câblé) — Port « participants » du module billetterie.
//
// Ce fichier définit l'INTERFACE cible permettant de rendre le **contrôle d'accès** de la billetterie
// (validation d'entrée, recherche, stats, accès repas) réutilisable par une 2ᵉ app, SANS que le layer
// lise les modèles d'autres modules (bénévoles / artistes / organisateurs).
//
// Il n'est volontairement PAS branché sur `TicketingPorts` (voir registry.ts) ni implémenté : la forme
// exacte du port doit être guidée par les **vrais types de participants** de la 2ᵉ app (éviter le
// YAGNI / une mauvaise abstraction figée trop tôt). Tant que la 2ᵉ app n'existe pas, les endpoints de
// contrôle d'accès restent dans le cœur jonglerie (cf. docs/ticketing-participants-port.md).
//
// Frontière : la billetterie possède déjà ses **acheteurs de billets** (Order/OrderItem, dans le
// layer). Ce port n'abstrait que les participants « hors billet » qui ouvrent aussi droit à l'entrée
// (jonglerie : bénévoles, artistes, organisateurs) et leur état de validation d'entrée.

/** Type de participant hors-billet, propre au domaine (jonglerie : 'VOLUNTEER' | 'ARTIST' | 'ORGANIZER'). */
export type ParticipantType = string

/** Référence stable d'un participant hors-billet : son type + l'id de son enregistrement. */
export interface ParticipantRef {
  type: ParticipantType
  /** Id de l'enregistrement dans le modèle du type (EditionVolunteerApplication.id, EditionArtist.id…). */
  id: number
}

/** Utilisateur rattaché à un participant (forme commune consommée par le front de contrôle d'accès). */
export interface ParticipantUser {
  id: number
  pseudo: string | null
  prenom: string | null
  nom: string | null
  email: string | null
  emailHash: string | null
  profilePicture: string | null
}

/**
 * Participant hors-billet normalisé. `details` transporte les champs propres au type (bénévole :
 * `teams` ; artiste : `shows` ; etc.) sans que le layer ait à les interpréter — le front les rend via
 * un composant propre au type.
 */
export interface AccessParticipant {
  type: ParticipantType
  id: number
  user: ParticipantUser | null
  entryValidated: boolean
  validatedAt?: Date | string | null
  validatedBy?: ParticipantUser | null
  /** Champs propres au type (opaques pour le layer ; rendus par le front). */
  details: Record<string, unknown>
}

/** Compteurs de validation d'entrée par type (alimente stats.get / stats/validations.get). */
export interface ParticipantEntryStats {
  byType: Array<{
    type: ParticipantType
    total: number
    validated: number
    notValidated: number
  }>
}

/** Accès repas d'un participant (jonglerie : sélections repas artistes). Forme à préciser avec la 2ᵉ app. */
export interface ParticipantMealAccess {
  meals: Array<{
    id: number
    date: Date | string
    mealType: string
    accepted: boolean
    [key: string]: unknown
  }>
}

/**
 * Port « participants » (contrat cible). Chaque méthode correspond à un (ou plusieurs) endpoint(s) de
 * contrôle d'accès actuellement dans le cœur jonglerie :
 *
 * - `listNotValidated`     → artists/volunteers/organizers-not-validated.get
 * - `search`               → search.post
 * - `listRecentlyValidated`→ recent-validations.get
 * - `setEntryValidated`    → validate-entry.post
 * - `setEntryInvalidated`  → invalidate-entry.post
 * - `getEntryStats`        → stats.get, stats/validations.get
 * - `getMealAccess`        → verify.post (sélections repas)
 *
 * L'implémentation jonglerie lirait EditionVolunteerApplication / EditionArtist / EditionOrganizer /
 * ArtistMealSelection ; une 2ᵉ app fournirait ses propres types via setTicketingPorts().
 */
export interface TicketingParticipantsPort {
  /** Participants hors-billet non validés à l'entrée (tous types). */
  listNotValidated(editionId: number): Promise<AccessParticipant[]>
  /** Recherche de participants hors-billet (nom, pseudo, email…). */
  search(editionId: number, query: string): Promise<AccessParticipant[]>
  /** Derniers participants hors-billet validés à l'entrée (ordre antéchronologique). */
  listRecentlyValidated(editionId: number, limit?: number): Promise<AccessParticipant[]>
  /** Marque l'entrée d'un participant comme validée et renvoie son état à jour. */
  setEntryValidated(ref: ParticipantRef, validatedByUserId: number): Promise<AccessParticipant>
  /** Annule la validation d'entrée d'un participant. */
  setEntryInvalidated(ref: ParticipantRef): Promise<AccessParticipant>
  /** Compteurs de validation d'entrée par type pour l'événement. */
  getEntryStats(editionId: number): Promise<ParticipantEntryStats>
  /** Accès repas d'un participant (ou `null` si non applicable au type). */
  getMealAccess(ref: ParticipantRef): Promise<ParticipantMealAccess | null>
}
