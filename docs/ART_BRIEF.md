# Brief artistique — Space Dog Rescue

Objet : remplacer les sprites générés en TypeScript (matrices de caractères et fonctions procédurales) par des sprites pixel-art dessinés à la main.

## 1. Règles générales

- **Pixel-art natif** : 1 pixel d'image = 1 pixel d'art. Le jeu agrandit ensuite les sprites (x6 en jeu, x4 dans les menus). Ne pas dessiner à la taille agrandie.
- **Pas d'anti-aliasing** : pixels entièrement opaques ou entièrement transparents. Pas de demi-transparence, sauf effets volontaires (voir section 5).
- **Fond transparent** (PNG avec canal alpha).
- **Contour** : un contour sombre autour de chaque sprite (ce que le jeu fait aujourd'hui avec `#120c2a`). Couleur libre, mais contour continu.
- **Dimensions fixes** : respecter les tailles de la section 3. Si une taille doit changer, le signaler, car la hitbox en dépend.
- **Symétrie** : les vaisseaux et ennemis étaient symétriques. Livrer la **version complète** (pas de demi-sprite).
- **Palette** : libre. Aucune couleur liée à une arme sauf les marqueurs de recoloration (section 4).

## 2. Format de livraison

- **Un fichier PNG par sprite**, nommé exactement comme dans la liste (section 3). Exemple : `player.png`, `vBall_0.png`.
- **Animations** : une image par frame, suffixe `_0`, `_1`, etc.
- Dossier de livraison : `public/sprites/` dans le dépôt (servi tel quel par Vite).
- Pas de redimensionnement ni de compression avec perte (pas de JPEG, pas de WebP).
- Fichiers sources (PSD, Aseprite, etc.) bienvenus à part, dans un dossier `art-source/` (non versionné si trop lourd).

## 3. Liste des sprites

Dimensions en pixels d'art, largeur × hauteur. Ce sont les tailles actuelles du code.

### 3.1 Vaisseau, chien et ramassage

| Fichier | Taille | Description |
|---|---|---|
| `player.png` | 13 × 12 | Vaisseau du joueur (vue de dessus) |
| `dog.png` | 11 × 12 | Chien à sauver |
| `heart.png` | 9 × 9 | Cœur (soin et chien heureux) |
| `slot.png` | 9 × 9 | Emplacement d'arme (HUD) |
| `pickup.png` | 9 × 8 | Capsule d'arme. **Recolorée par arme**, voir section 4 |
| `carrier.png` | 17 × 9 | Porteur d'arme (gamepad). **Corps gris neutre** : la couleur est fixée par le code |

### 3.2 Ennemis fixes

| Fichier | Taille | Description |
|---|---|---|
| `basic.png` | 11 × 10 | Ennemi de base |
| `secondary.png` | 11 × 9 | Ennemi secondaire |
| `green.png` | 11 × 9 | Ennemi vert |
| `robotRabbit.png` | 11 × 12 | Robot-lapin |
| `magnet.png` | 11 × 9 | Aimant |
| `missileLauncher.png` | 13 × 10 | Lance-missiles |
| `armoredRect.png` | 13 × 13 | Rectangle blindé |
| `missileRect.png` | 15 × 13 | Rectangle à missiles |

Les canons sont dessinés par le code, à l'orientation de l'ennemi. Ne pas les dessiner dans le sprite.

### 3.3 Ennemis et projectiles animés ou pivotants

| Fichier | Frames | Taille | Description |
|---|---|---|---|
| `vBall_0..3.png` | 4 | 9 × 9 | Boule orange en spirale (formation en V). Les 4 frames forment une rotation |
| `grinder_0..2.png` | 3 | 17 × 17 | Lame de scie (ennemi grinder). Dents en rotation |
| `disc_0..1.png` | 2 | 7 × 7 | Petite lame (projectile). Rotation |
| `marbleBomb.png` | 1 | 11 × 11 | Bombe sphérique. **Le code la fait pivoter par pas de 22,5°** : elle doit rester lisible tournée |
| `turret.png` | 1 | 13 × 13 | Tourelle au sol |
| `turretPlus.png` | 1 | 15 × 15 | Tourelle améliorée |
| `tank.png` | 1 | 15 × 14 | Char (bleu) |
| `tankGreen.png` | 1 | 17 × 15 | Char vert |
| `tankRed.png` | 1 | 19 × 17 | Char rouge |

Les tourelles et chars sont vus de dessus. Les sprites au sol reçoivent une ombre dessinée par le code.

### 3.4 Boss (10 niveaux)

Chaque boss est un sprite complet. Taille = largeur × hauteur indiquées. Ils sont **dessinés à la main, un par niveau**, avec leur identité propre (couleurs et formes libres).

| # | Boss | Taille | Particularité |
|---|---|---|---|
| 1 | Greedy Cruiser | 29 × 25 | |
| 2 | Indigo Fortress | 31 × 27 | |
| 3 | Iron Jellyfish | 33 × 29 | |
| 4 | Ember Sentinel | 35 × 29 | |
| 5 | Emerald Hydra | 37 × 29 | |
| 6 | Frost Leviathan | 39 × 30 | |
| 7 | Golden Colossus | 39 × 31 | |
| 8 | Crimson Reaper | 41 × 31 | |
| 9 | Void Warden | 43 × 32 | |
| 10 | The Kidnapper | 41 × 33 | Porte le chien dans une cage. **La cage est dessinée par le code** : ne pas la dessiner |

Fichiers : `boss_0.png` à `boss_9.png` (index de niveau, 0 = premier boss).

Le flash blanc à l'impact est calculé par le code à partir de la silhouette. Aucune frame spéciale à dessiner.

## 4. Recoloration des capsules d'arme

`pickup.png` est une seule image. Le code la recolore selon l'arme (6 types). Pour cela, trois zones sont peintes avec des **couleurs marqueurs exactes** :

| Marqueur | Hex | Zone |
|---|---|---|
| Principale | `#FF00FF` | Couleur principale de l'arme |
| Claire | `#00FF00` | Reflets clairs |
| Sombre | `#0000FF` | Ombres et bord de la zone colorée |

Règles :
- Ces trois couleurs sont **réservées** à ces zones, rien d'autre dans le sprite ne doit les utiliser.
- Les contours, le fond de capsule et les détails restent dessinés en couleurs normales.
- Le tracé doit être lisible avec les 6 couleurs : éviter les dégradés complexes.

## 5. Effets et couleurs de fond

- **Pas de sprite** pour : le fond nébuleux, le cadre, les particules, les effets d'explosion, les barres HUD, la police des chiffres. Ces éléments restent en code pour l'instant.
- Si l'artiste veut dessiner la police des chiffres (`DIGITS`), le signaler : c'est un autre chantier.

## 6. Contrôle avant livraison

Avant de livrer, vérifier :

- [ ] Chaque fichier de la section 3 est présent, nommé exactement, au bon format PNG avec alpha.
- [ ] Les dimensions correspondent aux tableaux (ou la différence est signalée et justifiée).
- [ ] Pas de pixel semi-transparent (sauf effets volontaires).
- [ ] Les 4 frames `vBall`, 3 `grinder`, 2 `disc` ont la même taille et forment une boucle propre.
- [ ] `marbleBomb` reste lisible tournée de 22,5°.
- [ ] `pickup.png` contient les marqueurs exacts et aucune autre couleur de marqueur.
- [ ] Les boss n'ont pas de cage (boss 10) ni de canon suspendu dessiné à part, sauf s'ils font partie du sprite.

## 7. Questions ouvertes

- Licence et crédit de l'artiste : à définir plus tard (le développeur pourrait dessiner lui-même).
- Les tailles de la section 3 sont celles du code actuel. Si l'artiste veut plus grand, la hitbox doit être revue : à valider avant.
