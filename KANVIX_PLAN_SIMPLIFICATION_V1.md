# KANVIX — PLAN DE SIMPLIFICATION FONCTIONNELLE ET UX (V1)

**Base analysée :** `public/poc/kanvix-next-gen-v2.12.0.2.html` (31 498 lignes, source de vérité)
**Documents Astra fournis en référence :** non présents dans le dépôt ni dans les pièces jointes de cette session. Les propositions attribuées à Astra sont donc traitées uniquement à partir de leur formulation dans le brief de mission (§4, §8, questions 7 et 8) — voir section 8 pour la réserve méthodologique complète.
**Méthode :** lecture directe du code produit (fonctions de rendu, gardes `essential`/`pilot`, structures de données), aucune capture visuelle réalisée, aucune modification apportée au fichier.

---

## 1 — Résumé exécutif

**Le problème principal de Kanvix n'est pas un manque de fonctions ni un déficit visuel : c'est l'absence d'un principe unique de divulgation progressive.** Le produit a déjà, aujourd'hui, une remarquable discipline de construction (un seul moteur par règle métier, un seul objet "intervention" qui agrège tout) — mais il expose ses concepts de façon inégale : certaines fonctions avancées (Opérations multi-chantiers, jusqu'à 8 onglets sur une fiche chantier, 3 systèmes de "modèle" différents) sont visibles dès le premier usage, pendant que d'autres, déjà simples, sont noyées dans des menus profonds. Le niveau "Essentiel/Pilotage" existant est une bonne intuition mal exécutée : un simple booléen global qui n'éteint pas grand-chose (la navigation principale reste identique aux deux niveaux) et ne couvre pas tout (les Opérations restent visibles en mode Essentiel).

**Les cinq décisions de simplification les plus importantes :**
1. Fusionner les trois systèmes de "modèle" (modèles démo intégrés, modèles d'entreprise, modèles de chantier) en un seul concept, un seul écran de gestion.
2. Garder le niveau Essentiel/Pilotage comme réglage *global* de densité d'information (il fonctionne déjà ainsi, contrairement à ce qu'on pourrait craindre), mais le rendre réellement cohérent : les Opérations et la profondeur de la fiche Structure doivent aussi en dépendre.
3. Réduire la fiche chantier de 8 onglets (mode Pilotage) à 4 destinations groupées, en gardant l'objet "intervention" (déjà bien conçu) comme pivot plutôt que d'ajouter des onglets.
4. Supprimer les points d'entrée dupliqués (niveau d'affichage et rôle de démonstration accessibles à deux endroits distincts) au profit d'un point d'entrée unique par fonction.
5. Introduire un vocabulaire produit stable pour Gantt/Kanban (à tester avant adoption, voir §8) sans toucher au moteur.

**Bénéfices attendus :** une première mise en route sans concept de "modèle" à comprendre ; une fiche chantier lisible en un écran plutôt qu'en 8 clics d'onglets ; une cohérence totale entre "ce que le niveau Essentiel cache" et "ce qui est réellement avancé".

**Principaux risques :** la fusion des systèmes de modèles touche une fonctionnalité déjà en production (V2.11) et nécessite une migration de données propre (voir lot correspondant) ; réduire les onglets de fiche chantier déplace des habitudes d'utilisateurs pilotes déjà formés.

---

## 2 — Promesse d'expérience

Un utilisateur de Kanvix doit pouvoir dire, après cinq minutes : *"J'ai vu ma journée, j'ai compris ce qui bloque, j'ai su quoi faire."* Il ne doit jamais avoir besoin de comprendre l'architecture du produit (chantiers → structure → tâches → ressources → conditions → contrôles) avant de pouvoir agir sur une seule intervention. Le produit doit se comporter comme un collègue compétent qui prépare le terrain : il ne demande jamais de deviner, il propose une seule action évidente par écran, et il explique toujours la conséquence d'un geste avant de l'appliquer — jamais après.

---

## 3 — Diagnostic synthétique

### Surcharge cognitive
- **Trois systèmes de "modèle" coexistent** : une constante `PROJECT_TEMPLATES` (3 trames métier intégrées, format "chaîne de tâches"), `app.companyTemplates` (même format, créés par l'utilisateur, sans écran de gestion — seulement une création), et `app.projectTemplates` (V2.11, format riche : structure hiérarchique + tâches + conditions de démarrage, avec un vrai gestionnaire). L'assistant de création de chantier (`renderWizard`, fonction `wizardPickMode`) présente 5 choix dont 3 renvoient vers ces systèmes qui se recouvrent partiellement : "Utiliser un modèle" (`allProjectTemplates()` = les 3 démo + tous les modèles d'entreprise) et "Modèle d'entreprise" (sous-ensemble strict du précédent) mènent à la **même étape** (`template-select`) avec une liste simplement filtrée. Un nouvel utilisateur, qui n'a encore rien créé, se voit déjà proposer une distinction qu'il ne peut pas comprendre.
- **La fiche chantier expose jusqu'à 8 onglets** en mode Pilotage (`projectTabs()` : Aujourd'hui, À venir, Documents, Photos, Planning, Ressources, Structure, Historique), et la fiche Structure d'un niveau en ajoute 4 autres (`STRUCTURE_TABS` : Résumé, Planning, Ressources, Sous-niveaux) — soit potentiellement 12 destinations pour un seul chantier.
- **Le niveau Pilotage active plusieurs blocs indépendants d'un coup** (barre d'analyse avec 3 bascules, bandeau "conflits à vérifier", section dépendances, "détails techniques" repliables) sur des écrans différents (Aujourd'hui, fiche tâche, fiche chantier, Planning) — l'utilisateur ne choisit jamais *quelle* complexité il veut voir, seulement *s'il en veut*.

### Doublons identifiés
- **Le sélecteur de niveau (Essentiel/Pilotage) existe à deux endroits** : le popover du profil (`renderUserMenu`, toujours accessible) et la page Réglages (`renderMore`, section "Expérience Kanvix"). Même contrôle, deux emplacements.
- **Le rôle de démonstration ("Voir comme artisan")** existe lui aussi à deux endroits : popover du profil (raccourci direct) et Réglages → "Mode de démonstration" (cartes de sélection driver/artisan).
- **Deux entrées "Modèle" dans Réglages** avec un déséquilibre de maturité : "Modèles de chantier" a un vrai gestionnaire (`openProjectTemplatesManager`) tandis que "Modèle d'entreprise" n'ouvre qu'un formulaire de création (`openCompanyTemplateForm`) — aucune vue de la liste, aucun renommage, aucune suppression possible depuis Réglages.

### Problèmes de navigation
- La navigation principale (`nav()`) est statique — Aujourd'hui, Chantiers, Planning, Ressources — et **n'est jamais réduite par le niveau Essentiel**. Le niveau ne change donc pas "où on va", seulement "combien de détails on voit une fois arrivé", ce qui est en réalité une bonne nouvelle (voir §4) mais n'est pas explicite pour l'utilisateur : rien sur l'écran ne dit "ce bouton n'a pas changé, seul le contenu en dessous a changé".
- La fonction "Opérations" (pilotage multi-chantiers, `sitesModeSwitch()`) est accessible par un simple onglet segmenté sur la page Chantiers, **sans aucune garde de niveau** — c'est la seule fonctionnalité classée "Pilotage" par le brief de mission qui reste pleinement visible en mode Essentiel.

### Concepts trop exposés dès le début
- **La Structure de chantier** (organisation en niveaux/bâtiments/zones) est un onglet visible aux deux niveaux, y compris pour un chantier tout neuf sans aucune tâche — l'écran vide invite explicitement à "Créer mon premier niveau" avant même qu'une tâche existe.
- **Les Conditions de démarrage** (prérequis bloquants) apparaissent dans la fiche de chaque tâche dès sa création, avec statuts (à confirmer / confirmé / bloqué / non applicable) — utile en cours de chantier, prématuré à la création d'une intervention isolée dans les cinq premières minutes d'usage.

### Fonctions importantes insuffisamment visibles
- Le contrôle qualité en attente (`getTodayPendingControls`) partage sa carte de synthèse avec Décisions/Surveillances sur l'Accueil, ce qui est bien fait — mais **rien n'indique nulle part, sur la fiche tâche ni sur le planning, qu'un chantier entier reste bloqué en clôture** tant qu'un contrôle traîne, sinon en ouvrant chaque tâche une à une.
- L'historique des transactions (Undo/Redo, `historyControls()`) est disponible partout mais visuellement discret (icônes seules dans l'en-tête) — un utilisateur non habitué ne sait pas qu'une action de planning se défait d'un geste.

---

## 4 — Matrice complète de simplification

| Écran ou fonction | Utilité réelle | Profil concerné | Classe | Décision | Nouvel emplacement | Justification | Risque |
|---|---|---|---|---|---|---|---|
| Accueil (Aujourd'hui) — hero + 3 cartes attention + actions du jour | Point d'entrée quotidien | Tous | A | Conserver | Inchangé | Déjà conforme au modèle Aujourd'hui → décision → action | Faible |
| Nav "Aujourd'hui / Chantiers / Planning / Ressources" | Les 4 destinations réellement nécessaires | Tous | A | Conserver | Inchangé | Couvre l'essentiel sans sur-segmenter (voir Q3/Q4) | Faible |
| Messagerie (accès transversal, panneau latéral) | Communication terrain ↔ bureau | Tous | A | Conserver | Inchangé | Déjà contextuel, jamais une page dédiée | Faible |
| Mode Chantier (bottom nav 2 onglets) | Consultation terrain rapide, smartphone | Conducteur mobile | A | Conserver | Inchangé | Modèle de sobriété à répliquer ailleurs | Faible |
| Vue Artisan (chat) | Mission du jour, lecture seule | Artisan | A | Conserver | Inchangé | Déjà proche des codes de messagerie mobile | Faible |
| Fiche tâche (openTask) — action, conditions, contrôle, dépendances, pièces, historique | Objet opérationnel central | Tous | A/B | Conserver, réutiliser comme pivot | Inchangé, devient le point d'ancrage des futures fusions d'onglets | Déjà l'exemple de regroupement autour de l'intervention que le brief demande | Faible |
| Sélecteur Essentiel/Pilotage | Densité d'info adaptée au profil | Tous | B | Conserver le principe, corriger l'implémentation | Un seul emplacement (popover profil) | Le concept fonctionne (nav stable, détails masqués) ; il ne doit pas exister en double | Moyen — décider où le retirer sans le rendre invisible |
| Onglets fiche chantier : Planning, Ressources, Historique | Analyse approfondie d'un chantier | Pilote | B | Conserver, regrouper | Sous un onglet unique "Pilotage" à 3 sous-sections | 3 destinations pour une même intention ("j'analyse ce chantier") | Moyen — utilisateurs pilotes habitués aux onglets actuels |
| Onglets fiche chantier : Aujourd'hui, À venir, Documents, Photos, Structure | Suivi courant d'un chantier | Tous | A/B | Conserver | Inchangé (mais Structure devient contextuel, voir ligne suivante) | Ce sont les tâches du niveau Essentiel du brief | Faible |
| Onglet Structure (visible même sans tâche) | Organisation hiérarchique | Pilote / gros chantiers | B | Rendre contextuel | Apparaît seulement après la 1ʳᵉ tâche créée, ou sur demande explicite | Un chantier neuf n'a rien à structurer ; évite un écran vide "à remplir" en semaine 1 | Faible |
| Fiche Structure d'un niveau (4 sous-onglets) | Pilotage détaillé d'un sous-ensemble | Pilote, gros chantiers multi-niveaux | C | Conserver, replier par défaut | Section repliable dans la fiche du niveau plutôt que 4 onglets séparés | Fonction réellement avancée, jamais nécessaire en semaine 1 | Faible |
| Opérations (multi-chantiers) | Pilotage de portefeuille | Pilote multi-chantiers | C | Gater par niveau | Masqué en mode Essentiel, visible en Pilotage | Seule fonction "Pilotage" du brief actuellement non gardée par le niveau | Faible |
| "Utiliser un modèle" (assistant création) | Démarrage rapide via trame prédéfinie | Tous, surtout nouveaux | B/D | Fusionner avec "Modèle d'entreprise" | Un seul choix "Modèle" dans l'assistant | Les deux options mènent au même écran avec une liste presque identique | Moyen — nécessite migration des `companyTemplates` |
| "Modèle d'entreprise" (Réglages, création seule) | Capturer un chantier existant en trame réutilisable | Pilote | D | Fusionner dans "Modèles de chantier" | Devient une simple option de création dans le gestionnaire unique de modèles | Aucun écran de gestion propre aujourd'hui (pas de liste, pas de suppression) ; `app.projectTemplates` couvre déjà ce besoin avec un meilleur outillage | Moyen — format de données différent (chaîne plate vs structure), migration nécessaire |
| "Modèle de chantier" (assistant + Réglages, gestionnaire complet) | Réutiliser structure + tâches + conditions | Pilote | B | Conserver, devient LE système de modèle unique | Inchangé comme fondation ; absorbe les deux précédents | Système déjà le plus complet et le mieux outillé (V2.11) | Faible |
| "Reprendre un chantier en cours" (assistant) | Migrer un suivi papier/Excel existant | Nouveaux utilisateurs | A | Conserver | Inchangé | Cas d'usage réel de première utilisation (Parcours 1) | Faible |
| Barre d'analyse Planning (Baseline / Dépendances / Chaîne d'impact) | Diagnostic avancé d'un planning | Pilote expérimenté | C | Conserver, replier par défaut | Un seul bouton "Analyse" qui déplie les 3 bascules | 3 contrôles simultanés pour un besoin ponctuel | Faible |
| "Détails techniques" (repliables sur cartes de décision) | Cause racine, chaîne d'impact | Pilote | B | Conserver | Inchangé (déjà replié par défaut) | Conforme à la règle "options avancées repliées, jamais introuvables" | Faible |
| Contrôle de bascule mort dans le code (`advanced && !expert`, jamais vrai) | Aucune — reliquat d'une 3ᵉ profondeur abandonnée | — | D | Supprimer | — | `expert` et `pilot` sont la même valeur partout dans le fichier ; ce bouton n'apparaît jamais | Nul — dead code, non observable côté utilisateur |
| Libellés "Gantt" / "Kanban" | Sélecteur de représentation du planning | Pilote (le Kanban surtout) | C | À tester avant renommage | Voir §8 | Vocabulaire technique, mais déjà un standard reconnu par les utilisateurs formés | Moyen — un mauvais renommage nuit à des utilisateurs déjà formés |
| Undo/Redo (icônes seules dans l'en-tête) | Sécurité sur toute action de planning | Tous | A | Conserver, renforcer la visibilité | Inchangé dans son mécanisme, libellé texte ajouté au premier usage | Fonction de confiance critique, sous-exposée visuellement | Faible |
| Export PDF du planning | Partage hors-ligne | Pilote | B | Conserver | Inchangé | Cas d'usage réel (réunion chantier, affichage papier) | Faible |

---

## 5 — Architecture cible de navigation

**Navigation principale (inchangée, confirmée pertinente) :** Aujourd'hui · Chantiers · Planning · Ressources.
Ce sont bien les quatre destinations nécessaires (réponse à la question 3/4) : chacune répond à une question différente ("quoi aujourd'hui", "quels chantiers", "quand", "qui"). Un cinquième item ("Équipe" séparé de "Ressources", ou "Modèles" en item propre) fragmenterait sans ajouter de clarté — les modèles et réglages sont des *actions de préparation*, pas des *destinations de consultation quotidienne*.

**Accès transversal :** Messagerie (panneau latéral, badge de non-lus sur le bouton nav — inchangé), Undo/Redo (en-tête de chaque page mutable — inchangé).

**Fonctions contextuelles (classe B) :** Conditions de démarrage, Contrôles qualité, Dépendances, Pièces liées → toutes déjà regroupées dans la fiche tâche, pivot conservé. Structure de chantier → devient contextuelle (apparaît après la première tâche).

**Fonctions avancées (classe C), point d'accès unique :** un seul sélecteur Essentiel/Pilotage, dans le popover profil uniquement (retiré de Réglages, où seul un texte explicatif renvoie vers le popover). Opérations, gatées par ce même sélecteur. Barre d'analyse Planning, repliée sous un bouton unique.

**Logique mobile :** Mode Chantier (conducteur) et vue Artisan restent les deux points d'entrée mobiles existants, tous deux déjà minimalistes — aucun changement structurel requis, seulement les corrections transversales (modèles fusionnés, Structure contextuelle) qui s'y répercutent automatiquement puisqu'elles réutilisent les mêmes moteurs.

---

## 6 — Écrans cibles

### Accueil (Aujourd'hui)
- **Objectif unique :** comprendre la journée et agir en une décision.
- **Prioritaire :** salutation + résumé chiffré, 3 cartes (Décider/Surveiller/Contrôler), liste des actions du jour.
- **Action principale :** ouvrir une intervention (todayActionRow → openTask).
- **Secondaires :** voir tous les chantiers actifs, voir le planning de la semaine.
- **Repliés/contextuels :** bandeau "À savoir" (n'apparaît que s'il y a une confirmation terrain réelle du jour).
- **Supprimé/déplacé :** rien — cet écran est déjà correctement dimensionné.

### Chantiers
- **Objectif unique :** choisir un chantier ou évaluer le portefeuille.
- **Prioritaire :** cartes chantiers actifs avec badge de santé, compteur risques/surveillance/sous contrôle.
- **Action principale :** ouvrir un chantier.
- **Secondaires :** créer un chantier, filtrer Actifs/Clôturés/Archivés.
- **Repliés/contextuels :** bascule "Opérations" — visible seulement en Pilotage (déplacé, voir §4).
- **Supprimé/déplacé :** aucun contenu supprimé, seule la garde de niveau est ajoutée sur "Opérations".

### Fiche chantier
- **Objectif unique :** piloter un chantier précis.
- **Prioritaire :** cockpit (point bloquant + prochaine étape), onglets Aujourd'hui / À venir / Documents / Photos.
- **Action principale :** résoudre le point bloquant s'il existe, sinon ajouter une intervention.
- **Secondaires :** ouvrir le planning complet, gérer les ressources.
- **Repliés/contextuels :** onglet "Pilotage" (fusion Planning + Ressources + Historique), onglet "Structure" (apparaît après la première tâche).
- **Supprimé/déplacé :** 3 onglets fusionnés en 1 (voir §4).

### Fiche tâche (intervention)
- **Objectif unique :** tout savoir et tout faire sur une intervention précise.
- **Prioritaire :** nom, statut, localisation, ressource, dates, action principale (Démarrer/Terminer).
- **Action principale :** faire progresser le statut.
- **Secondaires :** modifier, signaler un problème, ouvrir une conversation.
- **Repliés/contextuels :** conditions de démarrage (si présentes), contrôle qualité (si applicable), dépendances (Pilotage uniquement), pièces liées.
- **Supprimé/déplacé :** rien — cet écran est déjà la référence à généraliser.

### Planning
- **Objectif unique :** voir et ajuster le calendrier des interventions.
- **Prioritaire :** vue (Gantt/Kanban), navigation temporelle, filtres chantier/ressource.
- **Action principale :** ajouter une tâche.
- **Secondaires :** exporter en PDF, changer de période.
- **Repliés/contextuels :** filtres lot/structure (repliés sous "Plus de filtres" en Essentiel), barre d'analyse (Pilotage, un seul bouton "Analyse").
- **Supprimé/déplacé :** bandeau "mode-hint" reformulé en un lien discret plutôt qu'un encart pleine largeur permanent.

### Mode Chantier / Vue Artisan
- **Objectif unique :** consulter et agir depuis le terrain, en quelques secondes.
- **Prioritaire :** chantier du jour, interventions du jour, alertes.
- **Action principale :** ouvrir une intervention / démarrer sa mission.
- **Secondaires :** signaler, ajouter une photo, écrire un message.
- **Repliés/contextuels :** contrôle qualité, reprises.
- **Supprimé/déplacé :** aucun — déjà conforme, sert de référence.

---

## 7 — Parcours avant/après

### Parcours 1 — Première utilisation
| | Existant | Cible |
|---|---|---|
| Départ | Écran Chantiers vide | Identique |
| Info visible | Bouton "Créer un chantier" | Identique |
| Action principale | Ouvrir l'assistant → **5 choix**, dont 3 renvoient à des notions de "modèle" pas encore comprises | Assistant → **3 choix clairs** : Partir de zéro / Utiliser un modèle (fusionné) / Reprendre un chantier en cours |
| Étapes | ~4 (choix → formulaire → aperçu si modèle → création) | ~3 |
| Révélation progressive | Structure proposée dès l'écran vide du chantier | Structure proposée seulement après la première tâche créée |
| Résultat | Chantier créé, éventuellement avec une trame mal choisie faute de distinction claire | Chantier créé, choix de modèle sans ambiguïté |
| Retour arrière | Annuler à tout moment dans l'assistant (déjà correct) | Inchangé |

### Parcours 2 — Ouverture quotidienne
| | Existant | Cible |
|---|---|---|
| Départ | Accueil | Identique |
| Info visible | Résumé + 3 cartes + actions du jour | Identique |
| Action principale | Ouvrir la carte "À décider" si non vide | Identique |
| Étapes | 1 à 2 (voir la carte, cliquer) | Identique |
| Révélation progressive | Déjà correcte (calme si rien à signaler) | Inchangée |
| Résultat | Conducteur sait quoi faire en moins de 30 s | Déjà atteint — aucun changement requis |
| Retour arrière | N/A (lecture) | N/A |

### Parcours 3 — Retard
| | Existant | Cible |
|---|---|---|
| Départ | Carte "À décider" sur l'Accueil ou fiche tâche | Identique |
| Info visible | Cause, impact (+N jours, N tâches affectées si Pilotage), chaîne d'impact repliée | Identique, mais chaîne d'impact accessible **aussi** en Essentiel via un lien "Voir l'impact" plutôt que masquée complètement |
| Action principale | "Résoudre" → ouvre le scénario d'arbitrage | Identique |
| Étapes | 3 (voir → comprendre → résoudre) | Identique |
| Révélation progressive | Détails techniques repliés (correct) | Inchangée |
| Résultat | Décision prise avec aperçu des conséquences avant validation (déjà conforme à la règle §5 du brief) | Inchangé |
| Retour arrière | Le scénario d'arbitrage est un aperçu non appliqué tant que non validé (déjà correct) | Inchangé |

### Parcours 4 — Intervention terrain (artisan)
| | Existant | Cible |
|---|---|---|
| Départ | Vue Artisan (chat) | Identique |
| Info visible | Mission du jour, horaires, statut, bouton "Je commence" | Identique |
| Action principale | "Je commence" / "J'ai terminé" | Identique |
| Étapes | 1 (déjà minimal) | Identique |
| Révélation progressive | Conditions de démarrage affichées seulement si elles existent et bloquent (déjà correct, `artisanPrerequisiteNote`) | Inchangée |
| Résultat | Photo ajoutée ou problème signalé en 2 clics | Inchangé — déjà conforme |
| Retour arrière | Signalement annulable avant envoi (formulaire standard) | Inchangé |

### Parcours 5 — Pilotage avancé
| | Existant | Cible |
|---|---|---|
| Départ | Planning, mode Pilotage | Identique |
| Info visible | Toutes les bascules d'analyse actives simultanément dès l'activation du mode Pilotage | Bascules regroupées sous un bouton "Analyse", activées à la demande |
| Action principale | Activer Dépendances / Baseline / Chaîne d'impact séparément | Ouvrir "Analyse" une fois, cocher ce qui est utile |
| Étapes | 3 clics dispersés | 1 clic pour ouvrir + sélection groupée |
| Révélation progressive | Tout ou rien (mode global) | Le mode Pilotage ouvre l'accès, le contenu reste à la demande |
| Résultat | Vue d'analyse complète | Identique, plus rapide à configurer |
| Retour arrière | Décoché individuellement | Identique |

---

## 8 — Décisions sur la proposition Astra

**Réserve méthodologique :** ni `rapport-audit-kanvix-astra(1).md` ni `kanvix-astra-challenge-poc(1).html` n'étaient présents dans le dépôt Git ni dans les pièces jointes accessibles à cette session (recherche effectuée sur l'ensemble du système de fichiers). Les décisions ci-dessous portent donc sur les propositions explicitement formulées dans le brief de mission lui-même (§4, questions 7 et 8), qui semblent refléter des recommandations d'Astra, et non sur une lecture complète et indépendante de ses documents. Toute proposition Astra non reprise dans le brief n'a pas pu être évaluée.

| Proposition (telle que formulée dans le brief) | Décision | Justification |
|---|---|---|
| Sélecteur global Essentiel/Pilotage | **MODIFIER** | Le concept existe déjà et fonctionne bien (nav stable, détails masqués) — mais il est dupliqué (2 emplacements) et incomplet (Opérations non gardées). Ne pas le remplacer par une révélation purement contextuelle : un réglage persistant évite à l'utilisateur de re-décider à chaque écran. Le corriger, pas le refaire. |
| Révélation contextuelle plutôt que sélecteur global (§4 du brief) | **REJETER comme remplacement, CONSERVER comme complément** | Le produit pratique déjà les deux à la fois avec succès (détails techniques repliés = contextuel ; niveau Essentiel/Pilotage = global). Les opposer serait une régression : la contextualisation seule laisserait un utilisateur "Essentiel" découvrir des dépendances complexes sans y avoir consenti globalement. |
| Vue "Agenda" comme planning par défaut (question 7) | **À TESTER** | Aucune vue "Agenda" n'existe dans le code actuel (seuls Gantt et Kanban). L'introduire demanderait un nouveau mode de rendu ; sa pertinence dépend du profil (un conducteur multi-chantiers a besoin du Gantt, un artisan n'a jamais besoin d'aucun des deux — il a déjà sa vue Mission). À valider par test utilisateur avant tout développement, en priorité côté Mode Chantier (où l'équivalent existe déjà sous forme de liste "Aujourd'hui" — c'est peut-être déjà la réponse). |
| Renommer "Gantt"/"Kanban" en "Chronologie"/"Avancement" (question 8) | **À TESTER** | Bénéfice réel pour un non-spécialiste, mais risque de désorienter les utilisateurs pilotes déjà formés au vocabulaire actuel. Recommandation : introduire les nouveaux libellés en infobulle/sous-titre d'abord ("Kanban · Avancement"), mesurer la compréhension, ne remplacer complètement qu'après validation. |
| Regrouper les fonctions autour de l'intervention (question 10) | **CONSERVER** | Déjà largement réalisé (`openTask` agrège statut, conditions, contrôle, dépendances, pièces, historique). La recommandation de ce plan est d'étendre ce pivot à la fiche chantier plutôt que de créer un nouvel objet. |
| Codes visuels de messagerie type WhatsApp sur mobile (§5 du brief) | **CONSERVER** | Déjà en place côté Artisan (bulles, accusés ✓✓, horodatage) — aucune action requise, seulement vigilance à ne pas dériver vers des fonctions que WhatsApp a et que Kanvix n'a pas besoin de reproduire (réactions, statuts de présence). |

---

## 9 — Plan d'implémentation progressif

Nomenclature de travail : `SIMPLIFICATION-R1` à `R4`. Ne présuppose aucun numéro de version finale.

### SIMPLIFICATION-R1 — Corriger les doublons de réglages
- **Objectif :** un seul point d'entrée pour le niveau d'affichage et le rôle de démonstration.
- **Écrans concernés :** popover profil, Réglages.
- **Fonctions déplacées/modifiées :** retirer le sélecteur de niveau et les cartes de rôle de `renderMore()` ; y laisser un texte "Modifiable depuis le menu profil" avec lien direct.
- **Fonctions gelées :** `setDepth`, `setRole`, tout moteur de rendu des pages.
- **Risques :** aucun — retrait d'UI pure, aucune donnée touchée.
- **Tests nécessaires :** vérifier que `setDepth`/`setRole` restent atteignables et que l'état persiste (localStorage) à l'identique.
- **Critères d'acceptation :** un seul emplacement par réglage, comportement fonctionnel inchangé.
- **Retour arrière :** trivial (réintégrer le bloc retiré).

### SIMPLIFICATION-R2 — Gater "Opérations" par le niveau, nettoyer le code mort
- **Objectif :** cohérence totale du niveau Essentiel/Pilotage.
- **Écrans concernés :** Chantiers (`sitesModeSwitch`).
- **Fonctions déplacées/modifiées :** ajouter la garde `app.settings.level !== "essential"` sur l'affichage du switch Chantiers/Opérations ; supprimer la condition morte `advanced && !expert` dans `renderPlanning()`.
- **Fonctions gelées :** `renderOperationsList`, tous les moteurs d'opération.
- **Risques :** un utilisateur Essentiel ayant déjà créé des opérations les verrait disparaître de la navigation (pas de perte de données — juste d'accès) ; prévoir un message ou un accès de secours si `app.operations.length > 0`.
- **Tests nécessaires :** scénario "utilisateur Essentiel avec des opérations existantes" ; scénario bascule Essentiel↔Pilotage sur la page Chantiers.
- **Critères d'acceptation :** Opérations invisible en Essentiel sans opération existante, accessible sinon ; aucune régression sur `renderPlanning`.
- **Retour arrière :** retirer la garde ajoutée.

### SIMPLIFICATION-R3 — Structure contextuelle
- **Objectif :** ne plus proposer l'organisation en niveaux avant qu'une tâche existe.
- **Écrans concernés :** `projectTabs()`, fiche chantier.
- **Fonctions déplacées/modifiées :** condition d'apparition de l'onglet "Structure" : `getProjectTasks(id).length > 0` en plus de la condition de niveau existante.
- **Fonctions gelées :** tout le moteur Structure (`structureCompactTree`, `getStructureRoots`, etc.) — aucune donnée ni règle métier modifiée, seule la condition d'affichage de l'onglet change.
- **Risques :** un chantier structuré puis vidé de ses tâches perdrait temporairement l'accès à sa structure existante — prévoir l'exception "onglet visible si `getProjectStructure(id).length > 0` OU tâche existante".
- **Tests nécessaires :** chantier neuf (onglet absent), chantier avec structure mais 0 tâche (onglet doit rester si des niveaux existent déjà), chantier avec 1 tâche (onglet apparaît).
- **Critères d'acceptation :** aucune structure existante ne devient inaccessible ; un chantier neuf n'affiche plus l'invitation à structurer avant sa première tâche.
- **Retour arrière :** retirer la condition ajoutée.

### SIMPLIFICATION-R4 — Fusion des systèmes de modèle (lot le plus lourd, à découper)
- **Objectif :** un seul concept "Modèle", un seul écran de gestion, un seul choix dans l'assistant de création.
- **Écrans concernés :** assistant de création (`renderWizard`), Réglages (`renderMore`), gestionnaire de modèles (`openProjectTemplatesManager`).
- **Fonctions déplacées/modifiées :** écrire un convertisseur `companyTemplate → projectTemplate` (chaîne plate de tâches → structure à une seule racine implicite, sans niveaux) ; retirer l'étape `template-select`/`template-preview` de l'assistant au profit d'un unique embranchement vers `ptpl-select` élargi aux modèles convertis ; retirer `openCompanyTemplateForm` de Réglages au profit de "Enregistrer comme modèle" existant (déjà disponible depuis l'onglet Structure).
- **Fonctions gelées :** `PROJECT_TEMPLATES` (constante démo) peut être conservée telle quelle et simplement présentée dans la même liste unifiée, sans conversion nécessaire si son format est adapté à l'affichage seul.
- **Risques :** **le plus élevé du plan** — touche une fonctionnalité en production, des données utilisateur existantes (`app.companyTemplates`), et une recette de non-régression dédiée existe déjà pour les modèles de chantier (`recette-modeles-chantier-*`) qui devra être étendue, jamais affaiblie.
- **Tests nécessaires :** migration de `companyTemplates` existants sans perte ; recette de non-régression complète sur la création de chantier par les 3 anciens chemins ; test utilisateur sur le nouvel assistant à 3 choix.
- **Critères d'acceptation :** aucun modèle existant perdu ou inaccessible ; assistant de création réduit à 3 choix de premier niveau ; un seul écran de gestion des modèles.
- **Retour arrière :** lot le plus risqué — prévoir un export/sauvegarde automatique avant migration, et un chemin de restauration explicite (le produit a déjà un mécanisme de sauvegarde/restauration complet, à réutiliser).

---

## 10 — Tests utilisateurs

Protocole court, 4 profils, ~15 minutes chacun, sur poste ou mobile selon le profil.

| Profil | Scénario | Mesures |
|---|---|---|
| Nouvel utilisateur | Créer son premier chantier, ajouter 2 interventions, affecter un intervenant | Temps total, nombre d'actions, nombre d'hésitations sur le choix "modèle", demandes d'aide, compréhension vérifiée par question ("que se passerait-il si vous cliquiez sur Structure maintenant ?") |
| Conducteur de travaux | Ouvrir Kanvix un matin simulé avec 2 décisions et 1 surveillance en attente | Temps jusqu'à la première action, erreurs de clic, satisfaction déclarée (1-5) |
| Artisan | Consulter sa mission du jour sur mobile, ajouter une photo, signaler un problème | Temps, nombre d'étapes, compréhension du statut de sa tâche |
| Utilisateur avancé | Basculer en Pilotage, ouvrir la barre d'analyse, activer la chaîne d'impact sur une tâche en retard | Temps, nombre de clics, confusion éventuelle entre les 3 bascules séparées (mesure clé pour valider R-Analyse groupée) |

Mesures communes à consigner pour chaque session : temps nécessaire, nombre d'actions, erreurs (clics sur zone inactive, retours en arrière), demandes d'aide verbalisées, capacité à expliquer la conséquence de sa dernière action avant de valider, satisfaction perçue (échelle 1-5).

---

## 11 — Recommandation finale

**À simplifier en premier :** SIMPLIFICATION-R1 (doublons de réglages) et R2 (garde sur Opérations) — risque nul, bénéfice de cohérence immédiat, aucune dépendance sur les autres lots.

**À laisser inchangé :** l'Accueil, la fiche tâche, le Mode Chantier et la vue Artisan — ces quatre écrans sont déjà conformes au principe Aujourd'hui → décision → action et servent de référence pour tout le reste. Ne pas les toucher tant que les lots ci-dessus n'ont pas démontré leur valeur.

**À tester avant toute décision de développement :** le renommage Gantt/Kanban et l'introduction d'une vue "Agenda" (§8) — ce sont les deux seules propositions du brief qui n'ont pas d'équivalent fonctionnel déjà présent dans le produit, et qui méritent une validation utilisateur avant tout investissement.

**À ne pas développer maintenant :** toute évolution de la Structure de chantier ou des Opérations multi-chantiers au-delà des gardes de niveau proposées (R2, R3) — ce sont des fonctions déjà correctement construites pour un usage avancé ; leur seul défaut est une exposition prématurée, pas une lacune fonctionnelle.

---

**Fichier créé :** `KANVIX_PLAN_SIMPLIFICATION_V1.md`

**Trois décisions les plus importantes :**
1. Fusionner les trois systèmes de "modèle" en un seul (lot R4).
2. Corriger le sélecteur Essentiel/Pilotage plutôt que le remplacer : un seul emplacement, et cohérence étendue aux Opérations (lots R1-R2).
3. Rendre la Structure de chantier contextuelle plutôt que visible par défaut sur un chantier vide (lot R3).

**Points nécessitant encore un test utilisateur :** le renommage Gantt/Kanban, l'opportunité d'une vue "Agenda" dédiée, et la réaction des utilisateurs pilotes déjà formés au regroupement des onglets de fiche chantier (Planning/Ressources/Historique → un onglet "Pilotage").
