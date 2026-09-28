# Tutoriel « contrôle d'accès » — sources

Le PDF destiné aux bénévoles est `../controle-acces-benevole.pdf`. Ce dossier permet de le régénérer.

## La convention fictive

`apps/app1/scripts/seed-tuto-controle-acces.ts` crée, dans la base de **développement**, la
convention « Balles Perdues (TUTO) » et son édition « Festival des Balles Perdues 2026 — TUTO ».
Relancé, il la supprime et la recrée à l'identique : billets non validés, remboursements non
faits, dates recalées sur le jour même (le créneau de contrôle d'accès de Léo couvre « maintenant »).

Comptes, tous en `@tuto-balles-perdues.test`, mot de passe `TutoBalles2026!` :

| Compte    | Rôle                                                   |
| --------- | ------------------------------------------------------ |
| `camille` | organisatrice, tous les droits                         |
| `leo`     | bénévole en créneau de contrôle d'accès (les captures) |
| `ines`    | bénévole de la buvette, entrée non validée             |
| `malik`   | bénévole du montage, entrée déjà validée               |
| `zoe`     | artiste du « Cabaret du samedi soir »                  |
| `hugo`    | organisateur (trésorier), entrée déjà validée          |

Cas couverts par les commandes : billet HelloAsso payé avec option et tee-shirt (Julie Martin),
homonyme (Pierre Martin), commande familiale de trois billets (Bernard), billet déjà validé
(Chloé Moreau), commande HelloAsso de trois billets dont un annulé à rembourser (Dupont, Karim),
billet annulé déjà remboursé (Lucas Petit), vente sur place avec un billet annulé à rembourser
(Roux, Julien), commande sur place entièrement annulée (Marc Lefebvre), paiement en attente
(Paul Girard), plus douze figurants pour les statistiques.

## Régénérer

Serveur de développement lancé sur `http://localhost:3000`, puis depuis ce dossier :

```bash
./run.sh              # remet la convention à zéro et refait toutes les captures (≈ 10 min)
./run.sh julie,vente  # seulement certaines étapes (voir `etapes` dans capture.mjs)
python3 prep.py       # recadre et annote les captures dans img/
node pdf.mjs          # produit ../controle-acces-benevole.pdf depuis tutoriel.html
```

Le scan est réel : Chromium reçoit une fausse caméra qui filme un QR code généré par `mkvid.py`
(Python, modules `qrcode` et `Pillow`). Les captures mutent les données (validations,
remboursement, vente) : relancer le seed ensuite pour retrouver l'état de départ.

## Recapturer après une modification de l'interface

Les captures figent l'écran tel qu'il était à l'instant du passage. Le 28/09, cinq défauts du
contrôle d'accès ont été relevés **en rédigeant ce tutoriel** puis corrigés : les écrans concernés
ont été recapturés, mais deux fiches prises avant le correctif ont survécu au tri et montraient un
« Tout désélectionner » que le correctif venait de supprimer.

D'où la règle : quand un correctif touche un écran du contrôle d'accès, refaire **toutes** les
captures (`./run.sh` sans argument). Un passage partiel repart d'un seed neuf, et les compteurs
d'entrées des images refaites ne concordent plus avec ceux des images voisines.
