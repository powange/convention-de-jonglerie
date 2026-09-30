-- Rattrapage : désigner le bénévole des fils « bénévole ↔ organisateurs » déjà existants.
--
-- La colonne `volunteerId` ajoutée par la migration précédente n'est renseignée que pour les fils
-- créés ensuite. Sans ce rattrapage, la synchronisation des participants ne pourrait rien faire
-- sur les fils d'avant — donc précisément sur ceux où un organisateur révoqué lit encore.
--
-- ⚠️ POURQUOI UNE DÉDUCTION, ET NON UNE LECTURE. Rien n'enregistrait à qui un fil appartient : ses
-- participants sont le bénévole ET les organisateurs habilités, mélangés, et un organisateur peut
-- lui-même être bénévole de l'édition.
--
-- DEUX SIGNAUX INDÉPENDANTS, et il faut les deux :
--
--   1. UNE ASYMÉTRIE STRUCTURELLE — un ORGANISATEUR est participant de TOUS les fils de l'édition,
--      un BÉNÉVOLE d'UN SEUL.
--   2. UNE CANDIDATURE DE BÉNÉVOLE sur l'édition. Seul, le premier signal ne serait qu'une
--      coïncidence statistique ; et il est inopérant sur une édition qui n'a qu'un fil, où TOUS
--      les participants sont « présents dans un seul fil ».
--
-- ⚠️ ET UNE GARDE : `HAVING COUNT(*) = 1`. On n'écrit que si le fil désigne UN SEUL candidat. Un
-- fil qui en désigne plusieurs reste SANS propriétaire, et la synchronisation l'épargnera — mieux
-- vaut une fuite qui persiste qu'un bénévole coupé de sa propre conversation, en silence.
--
-- MESURÉ SUR LA BASE DE DÉVELOPPEMENT : 8 fils, les 8 désignés sans ambiguïté. Le premier signal
-- seul n'en tranchait que 7 — l'édition 22 n'ayant qu'un fil, ses 4 participants y étaient tous
-- candidats. C'est la candidature de bénévole qui a départagé, et c'est bien ce à quoi elle sert.
--
-- Aucune donnée n'est supprimée ni modifiée hors de cette colonne, qui était vide.

UPDATE `Conversation` AS c
JOIN (
  SELECT cand.conversationId, MIN(cand.userId) AS volunteerId
  FROM (
    SELECT cp.conversationId, cp.userId
    FROM `ConversationParticipant` cp
    JOIN `Conversation` cv ON cv.id = cp.conversationId
    WHERE cv.type = 'VOLUNTEER_TO_ORGANIZERS'
      -- Signal 1 : présent dans un seul fil de cette édition.
      AND cp.userId IN (
        SELECT cp2.userId
        FROM `ConversationParticipant` cp2
        JOIN `Conversation` cv2 ON cv2.id = cp2.conversationId
        WHERE cv2.type = 'VOLUNTEER_TO_ORGANIZERS' AND cv2.editionId = cv.editionId
        GROUP BY cp2.userId
        HAVING COUNT(DISTINCT cp2.conversationId) = 1
      )
      -- Signal 2 : réellement bénévole de cette édition.
      AND EXISTS (
        SELECT 1 FROM `EditionVolunteerApplication` a
        WHERE a.userId = cp.userId AND a.eventId = cv.editionId
      )
  ) cand
  GROUP BY cand.conversationId
  HAVING COUNT(*) = 1
) AS choix ON choix.conversationId = c.id
SET c.volunteerId = choix.volunteerId
WHERE c.type = 'VOLUNTEER_TO_ORGANIZERS' AND c.volunteerId IS NULL;
