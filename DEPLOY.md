# Déploiement du backend KoliGo

Le serveur `koligoapi.trugroup.cm` suit la branche `preprod`. Un push sur
`preprod` touchant `backend/**` déclenche
[.github/workflows/deploy-backend.yml](.github/workflows/deploy-backend.yml),
qui se connecte en SSH et lance [backend/deploy.sh](backend/deploy.sh) :
`git pull` → `npm ci` → `prisma migrate deploy` → `npm run build` → redémarrage
→ contrôle de santé.

Le workflow échoue si l'API ne répond pas 200 sur `/health`, ou si
`POST /payment/webhook/apisungku` répond 404 — signe que le nouveau code n'est
pas en ligne.

## Secrets à créer

`Settings → Secrets and variables → Actions → New repository secret`.
Sans eux, le workflow s'arrête à la première étape.

| Secret | Rôle | Exemple |
|---|---|---|
| `DEPLOY_HOST` | hôte SSH | `194.163.137.219` |
| `DEPLOY_USER` | compte SSH | `deploy` |
| `DEPLOY_SSH_KEY` | clé privée **dédiée au déploiement**, sans passphrase | contenu de `~/.ssh/id_deploy` |
| `DEPLOY_KNOWN_HOSTS` | empreinte du serveur | sortie de `ssh-keyscan -H <hôte>` |
| `DEPLOY_PATH` | racine du dépôt sur le serveur | `/var/www/koligo` |
| `DEPLOY_PORT` | port SSH, si différent de 22 | `22` |
| `DEPLOY_BASE_URL` | base publique de l'API | `https://koligoapi.trugroup.cm` |
| `DEPLOY_HEALTH_URL` | route de santé | `https://koligoapi.trugroup.cm/health` |

### Préparer la clé de déploiement

Sur votre poste :

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_koligo_deploy -C "github-actions-deploy" -N ""
ssh-copy-id -i ~/.ssh/id_koligo_deploy.pub deploy@<hôte>
ssh-keyscan -H <hôte>              # → DEPLOY_KNOWN_HOSTS
cat ~/.ssh/id_koligo_deploy        # → DEPLOY_SSH_KEY
```

Créez une clé **dédiée**, pas votre clé personnelle : elle vit dans GitHub et
doit pouvoir être révoquée seule. Restreignez-la au strict nécessaire côté
serveur (`command=` dans `authorized_keys` si vous voulez la limiter à
`deploy.sh`).

`DEPLOY_KNOWN_HOSTS` n'est pas facultatif : le workflow épingle l'empreinte du
serveur. Sans elle, un intercepteur pourrait se faire passer pour l'hôte et
récupérer la clé de déploiement.

## Variables d'environnement du serveur

Elles vivent dans `backend/.env` **sur le serveur**, jamais dans git :

```
DATABASE_URL=...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
SMTP_HOST=mx-dc03.ewodi.net
SMTP_PORT=587
SMTP_USER=noreply@trugroup.cm
SMTP_PASS=...
PAYMENT_PROVIDER=apisungku
APISUNGKU_BASE_URL=https://apisungku.trugroup.cm/v1
APISUNGKU_API_KEY=sk_live_...
APISUNGKU_WEBHOOK_SECRET=...
OTP_RETURN_CODE=true
```

`OTP_RETURN_CODE=true` renvoie le code OTP à l'application, qui le valide sans
saisie. Conséquence assumée : quiconque appelle l'endpoint reçoit le code, donc
l'OTP ne prouve plus la possession de l'email ou du numéro. `false` rétablit la
garantie.

## Déploiement manuel

Depuis l'onglet Actions → *Deploy backend* → *Run workflow*, ou sur le serveur :

```bash
cd <DEPLOY_PATH>/backend && bash deploy.sh preprod
```

## Vérifier qu'un déploiement a pris

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://koligoapi.trugroup.cm/payment/webhook/apisungku \
  -H "Content-Type: application/json" -d '{}'
```

**401** : la route existe et rejette une signature absente — le déploiement est
bon. **404** : le code en ligne est antérieur.
