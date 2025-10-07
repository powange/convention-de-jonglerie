# Système d'Assignation Automatique des Bénévoles

Le système d'assignation automatique des bénévoles permet d'optimiser l'attribution des créneaux horaires aux bénévoles en fonction de leurs disponibilités, préférences et contraintes organisationnelles.

## Vue d'ensemble

Le système se compose de deux parties principales :

- **API Endpoint** : `/api/editions/{id}/volunteers/auto-assign.post.ts`
- **Algorithme Core** : `VolunteerScheduler` dans `server/utils/volunteer-scheduler.ts`

## Architecture

### Flux de données

```
Données d'entrée → Validation → Préparation → Algorithme d'assignation → Application BDD
```

### Composants principaux

1. **Endpoint API** : Gestion des permissions, validation, interface REST
2. **VolunteerScheduler** : Cœur algorithmique d'optimisation
3. **Base de données** : Application des résultats via transactions Prisma

## Utilisation de l'API

### Endpoint

```
POST /api/editions/{editionId}/volunteers/auto-assign
```

### Paramètres de requête

```typescript
{
  constraints: {
    maxHoursPerVolunteer?: number,    // Max 24h par bénévole
    minHoursPerVolunteer?: number,    // Min 0h par bénévole
    maxHoursPerDay?: number,          // Max 12h par jour
    minHoursPerDay?: number,          // Min 0h par jour
    balanceTeams?: boolean,           // Équilibrer les équipes
    prioritizeExperience?: boolean,   // Prioriser l'expérience
    respectStrictAvailability?: boolean, // Respecter strictement les disponibilités
    respectStrictTeamPreferences?: boolean, // Respecter strictement les préférences d'équipe
    respectStrictTimePreferences?: boolean, // Respecter strictement les préférences horaires
    allowOvertime?: boolean,          // Autoriser les heures supplémentaires
    maxOvertimeHours?: number,        // Max 6h supplémentaires
    keepExistingAssignments?: boolean // Conserver les assignations existantes
  },
  applyAssignments: boolean           // true = appliquer, false = prévisualiser
}
```

### Réponse

```typescript
{
  success: boolean,
  result: SchedulingResult,
  preview: boolean                    // true si prévisualisation seulement
}
```

## Algorithme d'assignation

### Classification algorithmique

Le système implémente un **algorithme glouton multi-passes** (Greedy Algorithm) avec optimisation locale.

#### Type algorithmique principal

- **Algorithme Glouton avec scoring** : Fait des choix localement optimaux à chaque étape
- **Multi-passes** : 3 phases successives avec seuils de qualité différents
- **Heuristique** : Utilise des règles empiriques pour l'optimisation

#### Dans la littérature informatique

Cet algorithme combine plusieurs problèmes classiques :

- **Assignment Problem** (Problème d'affectation)
- **Weighted Bipartite Matching with Constraints** (Appariement bipartite pondéré avec contraintes)
- **Bin Packing** (Remplissage de conteneurs - les créneaux horaires)
- **Multi-Objective Optimization** (Optimisation multi-critères)
- **Constraint Satisfaction Problem (CSP)** (Satisfaction de contraintes)

#### Caractéristiques spécifiques

- **Bipartite** : Deux ensembles distincts (bénévoles ↔ créneaux)
- **Weighted** : Chaque assignation a un poids calculé (score)
- **Constraints** : Contraintes temporelles, d'heures, de disponibilités
- **Complexité** : O(n²) dans le pire cas

#### Alternatives algorithmiques

- **Algorithme Hongrois** : Solution optimale mais plus complexe (O(n³))
- **Programmation linéaire** : Solution exacte mais coûteuse en ressources
- **Algorithme génétique** : Pour très gros volumes avec exploration globale
- **Simulated Annealing** : Métaheuristique avec acceptation de solutions dégradées
- **Min-Cost Max-Flow** : Approche par flots à coût minimum

L'approche gloutonne choisie offre un excellent compromis entre **performance computationnelle** et **qualité de solution** pour ce domaine d'application.

### Phases d'exécution

L'algorithme fonctionne en **4 phases séquentielles** :

#### 1. Préparation des données

- Filtrage des bénévoles disponibles
- Tri des créneaux par priorité
- Conversion des données vers le format algorithmique

#### 2. Première passe - Assignations évidentes

- Seuil de score élevé (> 50 points)
- Priorise les matches parfaits (expérience + préférences + disponibilité)
- Évite les conflits temporels

#### 3. Deuxième passe - Remplissage optimal

- Seuil de score réduit (> -50 points)
- Complète les créneaux restants
- Vérifie les contraintes d'heures maximales

#### 4. Troisième passe - Équilibrage (optionnel)

- Rééquilibre la charge entre bénévoles
- Transfère des assignations si possible
- Améliore la satisfaction globale

### Système de scoring

Le score d'assignation combine plusieurs facteurs :

#### Facteurs positifs (bonus)

- **Disponibilité respectée** : +20 points
- **Préférence d'équipe** : +15 points
- **Préférences horaires** : +12 points par créneau correspondant
- **Expérience pertinente** : +3 à +8 points selon le type
- **Priorité du créneau** : +3 points × niveau de priorité
- **Urgence** (places restantes ≤ 2) : +10 points
- **Équilibrage des heures** : +1.5 points si sous la moyenne

#### Facteurs négatifs (pénalités)

- **Indisponibilité stricte** : -1000 points (impossible)
- **Indisponibilité souple** : -50 points
- **Équipe non préférée (mode strict)** : -1000 points (bloquant si `respectStrictTeamPreferences`)
- **Créneau horaire non préféré (mode strict)** : -1000 points (bloquant si `respectStrictTimePreferences`)
- **Dépassement heures max** : -100 à -200 points
- **Heures supplémentaires** : -20 points
- **Contraintes quotidiennes** : -80 à -1000 points
- **Sur-utilisation** : -2 points par heure au-dessus de la moyenne

#### Calcul de confiance

Le niveau de confiance (0-100%) est calculé à partir du score :

```typescript
score ≥ 50   → 80-100% (excellente confiance)
score 20-49  → 60-79%  (bonne confiance)
score 0-19   → 40-59%  (confiance moyenne)
score < 0    → 10-39%  (faible confiance)
```

## Contraintes et validations

### Contraintes temporelles

- **Conflits de créneaux** : Aucun chevauchement autorisé
- **Limites quotidiennes** : Respect des heures max/min par jour
- **Limites globales** : Respect des heures max/min par bénévole

### Contraintes de disponibilité

- **Types de créneaux** : Montage, événement, démontage
- **Préférences horaires** : 8 créneaux prédéfinis (matin, soir, nuit...)
- **Créneaux bloqués** : Indisponibilités spécifiques
- **Mode strict horaires** : Si `respectStrictTimePreferences` est activé, les bénévoles ne seront assignés QUE sur leurs créneaux horaires préférés

### Contraintes d'équipe

- **Préférences d'équipe** : Bonus si le bénévole préfère l'équipe
- **Mode strict équipes** : Si `respectStrictTeamPreferences` est activé, les bénévoles ne seront assignés QUE aux équipes qu'ils ont en préférence
- **Équilibrage** : Répartition équitable entre équipes (optionnel)

## Types de données

### Bénévole (VolunteerApplication)

```typescript
{
  id: number,
  user: {
    id: number,
    pseudo: string,
    nom?: string,
    prenom?: string
  },
  availability: string,        // JSON : disponibilités et préférences
  experience: string,          // Description de l'expérience
  motivation: string,          // Motivation du bénévole
  phone?: string,             // Téléphone de contact
  teamPreferences?: any[]      // Préférences d'équipes
}
```

### Créneau (TimeSlot)

```typescript
{
  id: string,
  title: string,              // Nom du créneau
  start: string,              // Date/heure de début (ISO)
  end: string,                // Date/heure de fin (ISO)
  teamId?: string,            // Équipe associée
  maxVolunteers: number,      // Nombre max de bénévoles
  assignedVolunteers: number, // Nombre déjà assignés
  description?: string,       // Description optionnelle
  requiredSkills?: string[],  // Compétences requises
  priority?: number           // Priorité (1-5)
}
```

### Équipe (Team)

```typescript
{
  id: string,
  name: string,               // Nom de l'équipe
  color: string               // Couleur d'affichage
}
```

### Assignation (Assignment)

```typescript
{
  volunteerId: number,        // ID du bénévole assigné
  slotId: string,            // ID du créneau
  teamId?: string,           // ID de l'équipe (si applicable)
  score: number,             // Score de l'assignation
  confidence: number         // Niveau de confiance (0-100%)
}
```

## Résultats et statistiques

### Structure des résultats (SchedulingResult)

```typescript
{
  assignments: Assignment[],           // Liste des assignations
  unassigned: {
    volunteers: number[],              // Bénévoles non assignés
    slots: string[]                    // Créneaux non complétés
  },
  stats: {
    totalAssignments: number,          // Nombre total d'assignations
    averageHoursPerVolunteer: number,  // Moyenne d'heures par bénévole
    satisfactionRate: number,          // Taux de satisfaction (0-1)
    balanceScore: number               // Score d'équilibrage (0-1)
  },
  warnings: string[],                  // Avertissements
  recommendations: string[]            // Recommandations d'amélioration
}
```

### Métriques calculées

- **Taux de satisfaction** : Moyenne des niveaux de confiance
- **Score d'équilibrage** : Basé sur l'écart-type des heures par bénévole
- **Couverture** : Pourcentage de créneaux complétés
- **Utilisation** : Pourcentage de bénévoles assignés

## Gestion des permissions

### Prérequis

- Utilisateur authentifié
- Permissions de gestion des bénévoles pour l'édition
- Édition existante et accessible

### Vérifications

```typescript
// Vérification via canManageEditionVolunteers()
const canManage = await canManageEditionVolunteers(editionId, userId, event)
```

## Application en base de données

### Mode prévisualisation

- `applyAssignments: false`
- Aucune modification en base
- Retourne les résultats pour validation

### Mode application

- `applyAssignments: true`
- Transaction Prisma pour cohérence
- Création des assignations en base
- Mise à jour des équipes des bénévoles

### Processus d'application

1. **Suppression conditionnelle** : Si `keepExistingAssignments = false`
2. **Création des assignations** : Table `VolunteerAssignment`
3. **Attribution d'équipes** : Mise à jour des relations bénévole-équipe
4. **Logging** : Traçabilité de l'opération

## Optimisations et performances

### Stratégies d'optimisation

- **Tri intelligent** : Créneaux par priorité et urgence
- **Filtrage précoce** : Élimination des candidats impossibles
- **Assignations par passes** : Traitement progressif de qualité décroissante
- **Mise en cache** : Calculs de durées et disponibilités

### Gestion mémoire

- Structures de données optimisées
- Évitement des copies inutiles
- Algorithmes en place quand possible

## Exemples d'utilisation

### Prévisualisation simple

```typescript
const response = await fetch('/api/editions/123/volunteers/auto-assign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    constraints: {
      maxHoursPerVolunteer: 8,
      balanceTeams: true,
      respectStrictAvailability: true,
    },
    applyAssignments: false, // Prévisualisation
  }),
})
```

### Application avec contraintes strictes

```typescript
const response = await fetch('/api/editions/123/volunteers/auto-assign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    constraints: {
      maxHoursPerVolunteer: 12,
      minHoursPerVolunteer: 4,
      maxHoursPerDay: 6,
      balanceTeams: true,
      prioritizeExperience: true,
      respectStrictAvailability: true,
      respectStrictTeamPreferences: true,   // Respecter strictement les préférences d'équipe
      respectStrictTimePreferences: true,   // Respecter strictement les préférences horaires
      allowOvertime: false,
      keepExistingAssignments: true,
    },
    applyAssignments: true, // Application réelle
  }),
})
```

## Limitations et considérations

### Limitations actuelles

- **Complexité algorithmique** : O(n²) dans le pire cas
- **Pas de résolution de conflits complexes** : Gestion simplifiée des préférences contradictoires
- **Métadonnées limitées** : Detection automatique limitée des types de créneaux

### Améliorations possibles

- **Algorithme génétique** : Pour de très gros volumes
- **Machine learning** : Apprentissage des préférences organisateur
- **Résolution de conflits avancée** : Négociation automatique des contraintes
- **Interface graphique** : Édition manuelle post-assignation

### Considérations de performance

- **Limite recommandée** : ~500 bénévoles × 100 créneaux
- **Temps d'exécution** : < 5 secondes pour volumes standards
- **Mémoire** : Augmentation quadratique avec la taille

## Troubleshooting

### Erreurs courantes

#### Score négatif global

- **Cause** : Contraintes trop strictes
- **Solution** : Assouplir `respectStrictAvailability` ou augmenter `allowOvertime`

#### Taux de satisfaction faible

- **Cause** : Préférences non respectées
- **Solution** : Vérifier les préférences horaires et d'équipes, ou activer les modes stricts (`respectStrictTeamPreferences` et `respectStrictTimePreferences`)

#### Créneaux non complétés

- **Cause** : Manque de bénévoles disponibles
- **Solution** : Recruter plus ou ajuster les contraintes de temps

#### Bénévoles non assignés

- **Cause** : Disponibilités limitées ou conflits, ou modes stricts trop restrictifs
- **Solution** : Vérifier les disponibilités et assouplir les contraintes, désactiver les modes stricts si nécessaire

### Debugging

```typescript
// Activer les logs détaillés
console.log('Volunteers:', schedulerVolunteers.length)
console.log('Slots:', schedulerTimeSlots.length)
console.log('Result:', result.stats)
```

## Tests et validation

### Tests unitaires

- Calcul de scores individuels
- Gestion des conflits temporels
- Respect des contraintes

### Tests d'intégration

- Assignation complète bout en bout
- Persistance en base de données
- Gestion des permissions

### Validation manuelle

- Vérification des résultats via interface
- Contrôle de cohérence post-assignation
- Tests de charge avec données réelles
