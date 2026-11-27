# Flowvent — les courriels

## Envoi

Même transport que Juggling Convention (`layers/core/server/socle/envoi-courriel.ts`), réglé par
les variables de la pile : simulation (journal du conteneur) tant que `SEND_EMAILS` n'est pas
`true`, sinon SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_BCC`).
Aucun envoi vers les domaines de test (`example.*`, `.test`, `.invalid`, `.example`, `.localhost`),
même vers Mailpit.

- **Release** (test.flowvent.org) : Mailpit (`SMTP_HOST` = Mailpit, port `1025`, sans identifiants).
- **Production** (flowvent.org) : Resend (`smtp.resend.com`, port `465`, utilisateur `resend`, mot
  de passe = clé API), expéditeur `notifications@flowvent.org`. Le domaine doit être « Verified »
  dans Resend (enregistrements `resend._domainkey`, `send.`, et `_dmarc` dans Cloudflare).

## Habillage

Un seul gabarit, `apps/app2/shared/gabarit-courriel.ts` (`gabaritCourriel`) : en-tête avec le
pictogramme et le nom Flowvent, carte blanche à filet orange, titre, paragraphes, code ou liste,
bouton doublé du lien en clair, note, pied de page (signature, raison de l'envoi, lien du site).
Tableaux et styles en ligne pour les messageries ; tout ce qui vient de l'appelant est échappé ;
typographie française (espaces insécables). Un test vérifie que chaque envoi passe par lui.

## Les courriels, comparés à app1

| Courriel                                       | App1 | Flowvent                                |
| ---------------------------------------------- | ---- | --------------------------------------- |
| Vérification de compte (code)                  | oui  | oui                                     |
| Réinitialisation du mot de passe               | oui  | oui                                     |
| Invitation (compte créé par un organisateur)   | oui  | oui                                     |
| Créneaux de bénévolat                          | oui  | oui                                     |
| Notifications par courriel (selon préférences) | oui  | non : pas de notifications par courriel |
| Changement d'adresse (confirmation, alerte)    | oui  | non : l'adresse ne se change pas        |
| Compte supprimé par un administrateur          | oui  | non : pas de suppression de compte      |
| Adresse invalidée par un administrateur        | oui  | non                                     |
| Revendication d'une convention                 | oui  | sans objet                              |
| Rappel de fin d'abonnement                     | —    | oui                                     |
| Alerte de plafond de formule                   | —    | oui                                     |
