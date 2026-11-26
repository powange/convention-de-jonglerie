# Plannings : EventCalendar à la place de FullCalendar premium

Les plannings des **bénévoles** et du **stock** utilisent [EventCalendar](https://github.com/vkurko/calendar)
(`@event-calendar/core`, licence MIT) depuis le 26/11/2026. Leur vue « ligne de temps par
ressource » (`resourceTimeline`) relevait des modules **premium** de FullCalendar, sous licence
commerciale (≈ 480 $), alors que Flowvent est payant.

FullCalendar reste dans app1 pour l'**agenda de l'accueil** seulement, avec ses modules gratuits
(`core`, `daygrid`, `list`, `interaction`, `vue3`) : `apps/app1/app/components/ui/LazyFullCalendar.vue`
et `apps/app1/app/assets/css/fullcalendar.css`. Flowvent n'a plus aucune dépendance FullCalendar.

## Où vit quoi

| Élément                                                  | Fichier                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Composant (chargement différé, pont Vue → EventCalendar) | `layers/ui/app/components/ui/LazyEventCalendar.vue`                             |
| Habillage Nuxt UI (boutons, titre, colonne, sombre)      | `layers/ui/app/assets/css/event-calendar.css`                                   |
| Heures du lieu (dates flottantes)                        | `layers/ui/app/utils/calendrier-flottant.ts`                                    |
| Planning des bénévoles                                   | `layers/volunteers/app/composables/useVolunteerSchedule.ts`, `PlanningCard.vue` |
| Planning du stock                                        | `layers/stock/app/components/stock/StockPlanning.vue`                           |

## Les subtilités, et ce qu'elles sont devenues

| Sous FullCalendar                                       | Sous EventCalendar                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timeZone: 'Europe/Paris'` (greffon luxon)              | **Pas de fuseau nommé** : les créneaux arrivent en heures murales du lieu (`versChampLocal`), sans décalage ; les heures glissées, étirées ou sélectionnées repartent en instants par `versInstant`. `timeZone` ne porte que le décalage ACTUEL du lieu, pour l'instant présent. Exact autour d'un changement d'heure, et indépendant du fuseau du navigateur. |
| `resourceAreaHeaderContent` (« Les équipes »)           | Aucun équivalent : titre posé en CSS (`--entete-ressources` + `::before`).                                                                                                                                                                                                                                                                                     |
| `resourceAreaWidth: '15%'`                              | La colonne est dimensionnée par le contenu (EventCalendar écrit lui-même `--ec-sidebar-width`) : on borne `.ec-sidebar` (`max-inline-size`).                                                                                                                                                                                                                   |
| `eventWillUnmount` (masquer l'infobulle)                | Aucun équivalent : l'infobulle est masquée à chaque envoi des créneaux et au démontage (`masquerInfobulleCreneau`).                                                                                                                                                                                                                                            |
| `scrollTime: '34:00:00'` (premier créneau, lendemain)   | `scrollTime` est **plafonné à la journée** : la position est posée par le composant (prop `defilement`, sur `.ec-main`).                                                                                                                                                                                                                                       |
| Vue semaine rognée à la période autorisée               | EventCalendar montre toute la durée de la vue : `views.resourceTimelineWeek.duration` = jours de la période, 7 au plus (`joursDeLaVueSemaine`).                                                                                                                                                                                                                |
| Ressources triées par identifiant                       | Ordre reçu : « Non assigné » est placé en dernier explicitement.                                                                                                                                                                                                                                                                                               |
| `eventOverlap` / `selectOverlap: true`                  | Comportement par défaut.                                                                                                                                                                                                                                                                                                                                       |
| `slotDuration` changé par `setOption` + `refetchEvents` | Le composant renvoie l'option, le calendrier se redessine ; `slotWidth` suit pour garder ≈ 60 px par heure.                                                                                                                                                                                                                                                    |
| `.fc-timeline-now-indicator-line` + flèche              | `.ec-now-indicator` (bordure gauche) + point `::before`, même rouge (`rgb(255 0 0)`).                                                                                                                                                                                                                                                                          |
| `.fc-license-message` masqué dans app1                  | Plus de module premium : règle retirée.                                                                                                                                                                                                                                                                                                                        |

Mêmes noms de vues (`resourceTimelineDay`, `resourceTimelineWeek`) : les liens `?view=` déjà
partagés restent valides.

## Défauts corrigés au passage

- **Planning du stock** : il passait un fuseau nommé à FullCalendar SANS le greffon luxon, que
  FullCalendar ignorait en silence. Les réservations s'affichaient en UTC (8 h au lieu de 10 h à Paris).
- **Position sur le premier créneau** : sous Flowvent, l'édition arrive en date complète, et la
  fonction y accolait `T00:00:00` → date invalide, la frise ne se posait jamais. Elle vise
  désormais aussi l'heure du LIEU, et non celle du navigateur.
- **Modale de création d'un créneau** : `focus()` appelé sur le composant `UInput` levait une erreur
  à chaque création ; c'est son `inputRef` qui prend le focus.

## Vérifié

- Captures avant/après (clair, sombre, mobile), planning des bénévoles (semaine, jour, infobulle)
  et du stock.
- Glisser (dans l'équipe et vers une autre), étirer, sélectionner pour créer, cliquer : heures
  envoyées justes, navigateur réglé sur Paris comme sur New York.
- Specs Playwright `planning-barre-de-maintenant` et `planning-infobulle-pas-au-doigt` (app1).
