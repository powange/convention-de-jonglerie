---
description: "Rédige l'annonce Discord de ce qui vient d'être livré, en langage d'utilisateur et prête à copier-coller"
thinking: false
---

# Annonce Discord

Produit le message à poster sur le Discord après une livraison. Le lecteur n'est pas un
développeur : c'est un organisateur de convention ou un bénévole, qui veut savoir **ce qui change
pour lui**, pas ce qui a été modifié dans le dépôt.

## 1. Déterminer ce qu'on annonce

L'argument, s'il y en a un, désigne la matière :

| Argument              | Matière                                            |
| --------------------- | -------------------------------------------------- |
| `#399` (ou `399`)     | cette PR                                            |
| `#396 #397 #399`      | ces PR                                              |
| `d52e3a48..HEAD`      | cette plage de commits                              |
| `depuis 3`            | les 3 derniers commits de `origin/main`             |
| _(aucun)_             | le dernier commit de `origin/main`                  |

Le dépôt merge en **squash** : un commit sur `main` = une PR. Le défaut sans argument convient
donc à la livraison d'un seul lot. **Quand un déploiement embarque plusieurs PR, le dire** — le
défaut n'annoncerait que la dernière, silencieusement.

```bash
git fetch origin -q
git log origin/main -5 --format='%h %s'
```

Puis lire les **corps de commit** de la plage retenue, pas seulement les titres :

```bash
git log <plage> --format='%n=== %h %s%n%b'
```

Dans ce dépôt, les corps de commit expliquent le *pourquoi* — c'est la meilleure source pour
écrire l'annonce. Ce qu'ils contiennent est toutefois du raisonnement interne : le traduire, pas
le recopier.

## 2. N'annoncer que ce qui est en ligne

Vérifier que la matière est bien **déployée en production** avant de rédiger. Annoncer un
interrupteur que personne ne trouvera parce que la prod n'a pas encore basculé est pire que ne
rien annoncer.

```bash
git log origin/main -1 --format='%h %s'
curl -s --max-time 20 https://juggling-convention.com/_nuxt/builds/latest.json
```

Si le déploiement n'a pas eu lieu, **s'arrêter** et le dire : proposer `/deploy prod`, ou rédiger
quand même en prévenant que le message ne doit pas être posté avant la bascule.

## 3. Trier

**On annonce** ce que l'utilisateur peut voir ou faire :

- une fonctionnalité, un réglage, un écran, un bouton ;
- un changement de comportement de l'existant — **surtout celui-là** ;
- une correction d'un défaut visible (un affichage cassé, une action qui échouait) ;
- une traduction, une formulation, une accessibilité.

**On n'annonce pas** : remaniement interne, dette de typage, tests, CI, montées de version,
correctifs de fixtures, migrations de base — **sauf** si l'utilisateur en ressent l'effet, auquel
cas c'est l'effet qu'on décrit, jamais le mécanisme.

## 4. Ce qui fait une bonne annonce ici

- **Le langage de l'utilisateur.** Il a des « créneaux », des « bénévoles », des « éditions »,
  une « billetterie ». Il n'a ni endpoint, ni garde, ni hydratation, ni composable.
- **Dire ce qui ne change pas.** Quand un lot touche des données ou un comportement existant, la
  question que le lecteur se pose en premier est « et mes éditions en cours ? ». Y répondre dans
  sa propre section rassure plus que la fonctionnalité elle-même.
- **Une raison, brièvement.** « Pour que vous puissiez construire le planning sans que personne
  note des horaires qui changeront » vaut mieux que « nouvelle option `planningPublished` ».
- **Pas de numéros de PR, pas de noms de fichiers, pas de jargon de version.**
- **Pas de promesse non tenue** : ne rien annoncer qui ne soit dans la plage retenue.

## 5. Le format

- Titre : `**🗓️ Mise à jour du <jour> <mois> <année>**` (date du jour, en toutes lettres).
- Sections : `**<emoji> <titre de section>**`, regroupées **par fonctionnalité**, pas par commit.
- Puces : `-` en un seul niveau. Discord rend mal l'imbrication.
- `**gras**` pour les sections uniquement ; éviter les titres `#`, les tableaux et le HTML, que
  Discord ne rend pas comme le terminal.
- **2000 caractères maximum** par message Discord. Au-delà, découper en deux messages sur une
  frontière de section, et le signaler.

## 6. Rendre le message

Le livrer **dans un bloc de code**, sans quoi le terminal interprète les `**` et l'utilisateur ne
peut plus copier le balisage. Utiliser une clôture à quatre backticks, le message contenant
lui-même du Markdown.

Ne rien écrire d'autre autour, hormis une ligne proposant une variante (plus court, sans telle
section). Le message doit pouvoir être collé tel quel.

## Exemple de rendu attendu

````
**🗓️ Mise à jour du 13 septembre 2026**

**📋 Publier le planning des bénévoles quand il est prêt**
- Un nouvel interrupteur « Publier le planning aux bénévoles » apparaît sur la page de planification.
- Tant qu'il est éteint, les bénévoles ne voient ni leurs créneaux, ni le planning de l'édition. Vous pouvez placer une équipe, vous raviser et déplacer un créneau sans que personne ne note des horaires qui n'existeront plus le lendemain.
- Vous, en revanche, voyez toujours tout : l'interrupteur ne masque jamais rien à l'équipe d'organisation.

**ℹ️ Rien ne change pour vos éditions en cours**
- Toutes les éditions existantes restent publiées : aucun bénévole ne perd l'accès à son planning.
- Seules les **nouvelles** éditions démarrent avec le planning masqué.
````
