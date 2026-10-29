# Iron Chouquette

Hommage au shoot'em up Flash **Iron Chouquette** (kadokado.com) : pilotez votre vaisseau et récupérez votre chien kidnappé par des vaisseaux ennemis.

TypeScript + Canvas 2D + Vite. Aucune librairie de jeu, aucun fichier image ni son : tout le pixel art est généré par le code.

## Lancer

```bash
npm install
npm run dev        # http://localhost:5280
npm run build      # typecheck + build de production dans dist/
npm run preview    # sert dist/
npm test           # tests unitaires + simulation headless d'une partie complète
```

## Jouer

| Touche | Action |
|---|---|
| Flèches | Déplacer le vaisseau |
| Espace | Tirer (maintenir) |
| Ctrl ou Shift | Sacrifier l'arme la plus récente → salve dévastatrice (1 appui = 1 sacrifice) |
| Échap / P | Pause (Q pendant la pause : retour au menu) |
| Entrée | Valider dans les menus |

- **Barre de vie : 3 PV**, pas de vies. À 0 PV, la partie est terminée.
- Détruisez les vaisseaux en forme de **manette** pour obtenir l'arme de leur couleur.
- **3 armes maximum** (chaque boss lâche un « +1 emplacement », jusqu'à 5). Au-delà, l'arme la plus ancienne est sacrifiée automatiquement (et déclenche sa salve).
- Plusieurs exemplaires d'une même arme = arme plus puissante (niveau max 4).

| Arme | Effet |
|---|---|
| Violette | Petites boules violettes dans tous les sens (plus nombreuses et plus loin par niveau) |
| Rose | Accélère le vaisseau |
| Verte | Améliore l'arme de base (cadence, nombre de tirs, dégâts) |
| Jaune | Tire des deux côtés à la fois (puis diagonales, puis arrière) |
| Bleue | Missiles (tête chercheuse dès le niveau 2) |
| Rouge | Laser en faisceau électrique |

4 niveaux, un boss à la fin de chacun ; le dernier détient votre chien. Top 10 des scores sauvegardé dans le navigateur (`localStorage`).

### Options de développement (URL)

`?level=3` (niveau de départ), `?boss` (aller directement au boss), `?god` (invincible), `?weapons=red,blue,green`.
Exemple : `http://localhost:5280/?level=4&boss&god&weapons=red,red,green`.
En mode dev, l'application est accessible dans la console via `window.__app`.

## Architecture

```
src/
  config.ts          constantes (résolution 800×1000, zone de jeu, PV…)
  core/              boucle à pas fixe 60 Hz, clavier, mise à l'échelle, PRNG
  data/              catalogues : ennemis (points exacts), armes, niveaux/vagues/boss
  game/              logique sans DOM : World, inventaire FIFO, IA ennemis, boss, spawner, score
  render/            sprites pixel art (matrices + générateurs procéduraux), nébuleuse, HUD, rendu
  ui/                machine à états des écrans, meilleurs scores
tests/               Vitest (logique pure + simulation de parties complètes)
```

Les choix de conception non spécifiés par le cahier des charges sont listés dans [PLAN.md](PLAN.md).

## Déploiement local (LAN)

Le jeu est servi en continu sur **http://192.168.0.20:5280** par un service systemd utilisateur
(`deploy/iron-chouquette.service`, installé dans `~/.config/systemd/user/`). Au démarrage, il rebuild puis lance `vite preview` sur `0.0.0.0:5280`.

```bash
systemctl --user restart iron-chouquette   # après une modification du code
systemctl --user status iron-chouquette
systemctl --user disable --now iron-chouquette   # arrêter définitivement
```
Note : `npm run dev` utilise le même port ; arrêtez le service avant de lancer le serveur de dev.
