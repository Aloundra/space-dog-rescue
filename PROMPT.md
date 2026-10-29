# Prompt — Projet « Iron Chouquette »

## Rôle
Tu es un développeur senior TypeScript spécialisé en jeux 2D web. Tu travailles de façon autonome, par étapes, en vérifiant chaque étape avant de passer à la suivante.

## Objectif
Recréer **Iron Chouquette**, un shoot'em up issu de l'ancien site Flash kadokado.com : le joueur pilote un vaisseau qui tente de récupérer son chien kidnappé par des vaisseaux ennemis. Hommage fidèle dans l'esprit, pas une copie de fichiers d'origine (aucun asset original, tout est recréé).

## Stack et contraintes
- TypeScript (strict) + Canvas 2D + Vite. Aucune librairie de jeu (pas de Phaser, etc.). Dépendances de dev uniquement : vite, typescript, vitest.
- Graphismes : **pixel art généré procéduralement** (sprites définis en code sous forme de matrices/palettes, rendus sur canvas hors-écran, mis en cache, `imageSmoothingEnabled = false`). Aucun fichier image externe.
- **Aucun son** (le jeu d'origine n'en avait pas).
- Résolution logique fixe 800×1000 (zone de jeu + cadre + barre du bas), mise à l'échelle dans la fenêtre en conservant le ratio, centrée (échelle < 1 autorisée si la fenêtre est plus petite). Les sprites pixel art sont dessinés sur une grille de pixels « gros » (ex. 1 pixel art = 4×4 px logiques) pour garder le rendu pixelisé à cette résolution.
- Boucle de jeu à pas de temps fixe (60 Hz) découplée du rendu (requestAnimationFrame).
- Persistance : meilleurs scores (top 10) en `localStorage`.
- Code lisible, commentaires en anglais, architecture modulaire (voir plus bas). Textes du jeu en français.

## Contrôles
- Flèches : déplacement
- Espace : tir
- Ctrl ou Shift : sacrifier l'arme la plus récente pour lancer une **salve d'énergie dévastatrice** (efface les projectiles ennemis, inflige de gros dégâts à l'écran ; la puissance dépend de l'arme sacrifiée). Un appui déclenche un seul sacrifice; maintenir la touche ne consomme pas tout l’inventaire.
- Entrée : valider menu ; Échap/P : pause

## Mécaniques
### Armes
- Les armes sont obtenues en détruisant un vaisseau-porteur en forme de **manette de PlayStation** ; la couleur du porteur indique l'arme.
- Inventaire : **3 armes maximum** (extensible par certains bonus/options). Si la limite est dépassée, **l'arme la plus ancienne est sacrifiée automatiquement** (file FIFO).
- Posséder plusieurs exemplaires du même type rend l'arme plus puissante (niveau = nombre d'exemplaires, plafonné raisonnablement).
- Types :
  - **Violette** : petites boules violettes dans tous les sens ; plus de niveaux = plus de boules, zone plus large.
  - **Rose** : augmente la vitesse du vaisseau (cumulatif, plafonné).
  - **Verte** : améliore l'arme de base (cadence, dégâts, largeur).
  - **Jaune** : tir des deux côtés à la fois (latéral/arrière selon le niveau).
  - **Bleue** : lance des missiles (à tête chercheuse légère aux niveaux élevés).
  - **Rouge** : laser en faisceau électrique (rendu zigzag/éclairs).
- Chaque arme a une représentation visuelle d'icône dans le HUD (couleur + niveau).

### Ennemis et points (valeurs exactes)
| Ennemi | Points |
|---|---|
| Ennemi de base | 65 |
| Ennemi secondaire | 80 |
| Ennemi vert | 120 |
| Bombe à billes | 300 |
| Lapin robot | 350 |
| Tourelle de base | 450 |
| Aimant | 500 |
| Boules arrivant en V | 600 |
| Lance-missiles | 800 |
| Rectangle blindé | 1000 |
| Tourelle améliorée | 1500 |
| Tank de base | 2000 |
| Tank vert | 3500 |
| Rectangle à missile | 4800 |
| Disqueuse | 5000 |
| Tank rouge | 8000 |

Chaque ennemi a un comportement distinct (trajectoire, tir, PV) à concevoir de façon cohérente avec son nom : ex. Aimant = attire le vaisseau/les bonus ; Bombe à billes = explose en projectiles ; Lapin robot = déplacements sautillants ; Boules en V = vague en formation V ; Tourelles/tanks = au sol (scrolling), tirs visés ; Disqueuse = projectile/lame rotative ; etc. Le tableau des points est une donnée centralisée (un seul fichier de config).

### Progression
- Scrolling vertical, plusieurs niveaux (min. 4) avec décors différents (parallaxe procédural), vagues scriptées via données (pas codées en dur dans la logique), difficulté croissante.
- Un boss à la fin de chaque niveau (le dernier ravisseur détient le chien ; écran de fin avec retrouvailles).
- **Barre de vie avec 3 PV, sans système de vies** : chaque touche retire 1 PV (la barre est découpée en 3 segments), brève invincibilité après dégât, game over à 0 PV. Les armes possédées sont conservées jusqu'à la fin de la partie. Pas de bonus de soin imposé (à décider et documenter dans PLAN.md si l'équilibrage l'exige).
- Score affiché en continu, bonus de fin de niveau.

### Écrans
Menu titre (jouer, comment jouer, meilleurs scores), jeu avec HUD (score, barre de vie 3 PV, armes + niveaux, niveau courant), pause, game over avec saisie du nom si top 10, victoire.

## Références visuelles/gameplay
Étudie ces vidéos pour le rythme, les patterns ennemis, l'aspect des armes et des décors (ignorer le son) :
- https://www.youtube.com/watch?v=Sl3ayGmvMKM
- https://www.youtube.com/watch?v=-efcI7Qn20o
- https://www.youtube.com/watch?v=jpe5Y01jzkE
Le jeu d'origine est rejouable via le projet communautaire Eternaltwin : https://kadokadeo.eternaltwin.org/games/3 (utile comme référence de ressenti si accessible ; ne rien copier de ses fichiers).
Si tu ne peux pas consulter ces références, dis-le explicitement et base-toi sur la description ci-dessous sans inventer de détails présentés comme fidèles.

## Observations tirées des vidéos (à respecter dans l'esprit)
Ces notes viennent d'images extraites des 3 vidéos (runs de record, ~7 min chacune, scores jusqu'à ~350 000 ; une vidéo est un run « WR 350k »).
- **Format** : zone de jeu **portrait, quasi carrée-haute (~ 4:5)**, entourée d'un cadre clair bleu-cyan « glacé ». Prévoir cette ambiance d'interface (cadre + barre du bas), pas un plein écran noir.
- **Fond** : nébuleuse **violet/indigo foncé** avec champ d'étoiles blanches, scrolling vertical lent et continu. Le fond est le même sur la durée visionnée : les variations de « niveaux » sont à créer par teintes/densité (le jeu d'origine semble surtout une progression continue de difficulté avec peu de ruptures visuelles). Garder des écrans-titres de niveau discrets plutôt qu'une grosse cinématique.
- **HUD (barre du bas, clair/cyan)** : à gauche une petite icône/compteur, puis une **barre de vie rose/rouge horizontale** (dans notre version : 3 segments de PV, un segment perdu par touche), et à droite le **score sur 7 chiffres** (ex. `0129595`) en grands chiffres contour bleu clair. **Colonne de petites cases carrées en bas à gauche** de la zone de jeu = **emplacements d'armes** (chaque case colorée selon l'arme possédée : jaune, vert, violet…). Les scores gagnés s'affichent brièvement en **petits nombres blancs flottants** à l'endroit du kill (ex. « 350 », « 3500 »).
- **Vaisseau du joueur** : petit, clair (blanc/bleu pâle), avec réacteurs orange en bas ; une **lueur/aura jaune** apparaît devant lui quand l'arme de base/jaune est active.
- **Tirs du joueur** : nombreux petits projectiles **jaune-vert allongés (en forme de goutte/flamme)** en éventail serré ; la densité augmente avec les armes. Un **missile bleu** laisse un petit sillage tournoyant bleu clair ; des anneaux/halos concentriques translucides accompagnent certains tirs/explosions (effet « onde »).
- **Ennemis vus** : petits appareils blancs/crème à bulbes dorés (ennemi de base) ; **disques orange à spirale concentrique (« escargot »/ondes orange)** arrivant en nombre et en formation, ils descendent en essaims ; **rectangles gris-blanc type boîtier/cartouche avec petit écran vert** (rectangles blindés / « rectangle à missile »), souvent en colonnes de 2-3 qui descendent ; **gros capsules/tourelles grises à cylindre** ; petits **lapins robots blancs à grandes oreilles** (nombre « 350 » vu à l'écran, cohérent avec le tableau) ; grosses **unités rose/saumon à pinces/ailes** (tanks/disqueuse) avec traînée rouge ou lames ; **cercles/anneaux blancs** (type lame circulaire).
- **Tirs ennemis** : petites pastilles **rouge/rose**, carrés **jaune pâle** et **billes vertes**, en grandes nappes lentes (le jeu devient un « bullet hell » léger en fin de run) ; quelques orbes violet foncé aux contours sombres. Les couleurs de tirs ennemis doivent rester bien lisibles sur le fond violet et distinctes de celles du joueur.
- **Explosions** : boules de feu orange/jaune stylisées, avec fumée/traînée **rouge sombre** persistante pour les gros ennemis détruits.
- **Rythme** : le joueur est constamment sous une pluie de vagues ; l'écran est dense mais lisible ; les ennemis arrivent par le haut et par les côtés. Les gros ennemis (tanks/rectangles) sont pris en charge par concentration de tir.
- **Fin de partie** : écran de score du site (hors périmètre — à remplacer par notre propre écran game over / high scores).

### Notes d'adaptation
- Les designs d'origine (formes de « cartouche » grise à écran vert notamment) doivent être **redessinés de façon originale** (ex. caisson blindé gris à hublot vert), sans reproduire d'objet de marque.
- **Décision imposée : barre de vie de 3 PV seule, sans système de vies.** Quand la barre tombe à zéro, c'est le game over. Pas de compteur de vies ni de continue.
- Score en 7 chiffres, avec zéros de tête.

## Architecture suggérée
`src/` : `main.ts`, `core/` (loop, input, scaling, state machine), `game/` (player, weapons, enemies, bullets, bosses, levels, collisions, score), `data/` (enemies.ts, weapons.ts, levels.ts), `render/` (sprites procéduraux, palettes, parallaxe, HUD), `ui/` (menus, high scores), `tests/`.
Utilise un pool d'objets pour projectiles/particules, et des collisions AABB/cercles simples.

## Méthode de travail (obligatoire)
1. **Plan** : commence par écrire un `PLAN.md` (jalons, décisions ouvertes, hypothèses). Pose au plus quelques questions bloquantes, sinon décide et documente.
2. **Jalons incrémentaux**, chacun jouable et vérifié avant le suivant :
   1. Scaffold Vite/TS, boucle, input, mise à l'échelle
   2. Vaisseau + tir de base + scrolling
   3. Ennemis de base + collisions + score + barre de vie (3 PV)
   4. Système d'armes (inventaire FIFO, niveaux, 6 types) + salve sacrifiée
   5. Catalogue complet des ennemis (16 types) + porteurs « manette »
   6. Niveaux, vagues en données, boss
   7. Menus, pause, game over, high scores localStorage, écran de victoire
   8. Polish : particules, effets, équilibrage, perf
3. **Vérification** : tests unitaires (Vitest) pour la logique pure (inventaire d'armes FIFO, sacrifice de l'arme la plus récente, niveaux d'armes, PV/game over, table des scores, high scores) ; `tsc --noEmit` et build Vite sans erreur ; lancement réel du jeu dans un navigateur avec captures d'écran à chaque jalon pour contrôle visuel.
4. Ne déclare jamais une étape terminée sans l'avoir exécutée ; rapporte honnêtement ce qui ne marche pas.
5. Commits Git par jalon, messages clairs.

## Critères d'acceptation
- Les contrôles, la limite de 3 armes avec sacrifice FIFO, la salve Ctrl/Shift et les 6 armes (avec montée en puissance par doublons) fonctionnent comme décrit.
- Les 16 ennemis existent avec les points exacts du tableau.
- Barre de vie à 3 PV, game over à 0 PV, aucun système de vies.
- Ctrl/Shift : un appui = un seul sacrifice (l'arme la plus récente) ; une salve sans arme ne fait rien.
- Colonne d'emplacements d'armes colorés, nombres de points flottants, effet d'onde/halo sur certains tirs, tirs ennemis lisibles en forte densité à 60 FPS.
- ≥ 4 niveaux avec boss, fin avec le chien retrouvé.
- 60 FPS stables sur un PC standard, zéro asset image/audio externe.
- `npm run dev`, `npm run build`, `npm test` fonctionnent ; un README explique comment lancer et jouer.

## Livrable final
Rapport court : ce qui est fait, ce qui est vérifié (et comment), limites connues, choix de conception non spécifiés (comportements ennemis, équilibrage).
