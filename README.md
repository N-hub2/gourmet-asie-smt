# GOURMET D’ASIE

Application interne au personnel. Phase 1, Stage 1 uniquement : fondations, authentification et référentiels. Aucun menu, tarif, utilisateur ou secret de production n’est préchargé.

## Prérequis et démarrage

روش انتخاب‌شدهٔ مالک: PostgreSQL 17 بومی Windows، بدون Docker یا WSL. Node.js 24.15+ و pnpm 11.25 موردنیازند. نصب و اتصال PostgreSQL هنوز انجام نشده و به تأیید مشخص مالک نیاز دارند. compose.yaml فقط از پیکربندی قبلی باقی مانده و روش فعال این پروژه نیست.

Si le réseau Windows utilise une autorité de certification locale, définir `$env:NODE_USE_SYSTEM_CA = '1'` avant l’installation. Ne pas désactiver la vérification TLS.

```powershell
pnpm install --frozen-lockfile
```

این دستور فقط برای نصب وابستگی‌ها پس از مجوز لازم است؛ در بررسی پیش از نصب، هیچ نصب جدیدی انجام نشده است.

پروژه داخل OneDrive است. فایل .env واقعی، رمزها، دادهٔ PostgreSQL و پشتیبان‌ها نباید در این پوشه ساخته شوند. .gitignore جلوی همگام‌سازی OneDrive را نمی‌گیرد. .env.example فقط الگوی بدون راز است؛ مقادیر POSTGRES_* آن مربوط به Compose قدیمی‌اند و در نصب مستقیم کاربردی ندارند. برنامه از DATABASE_URL و APP_ORIGIN استفاده می‌کند.

مسیرهای پیشنهادی، هنوز ایجادنشده و نیازمند تأیید: برنامه در C:\Program Files\PostgreSQL\17، داده در C:\ProgramData\GourmetAsie\PostgreSQL17\data و فایل‌های محیطی در %LOCALAPPDATA%\GourmetAsie\config. دسترسی Windows این مسیرها باید به حساب‌های لازم محدود شود. برنامه با نقش روزمرهٔ محدود اجرا خواهد شد؛ نقش migration جداست و هیچ‌کدام نباید superuser باشند.

پس از نصب و تنظیمِ تأییدشده، برای اسکریپت migration می‌توان فایل خارجی migration.env را با DOTENV_CONFIG_PATH معرفی کرد؛ برای توسعه، فایل development.env با نقش محدود برنامه به Nuxt داده می‌شود. این مثال‌ها تا آماده‌شدن محیط اجرا نشوند:

```powershell
$env:DOTENV_CONFIG_PATH = Join-Path $env:LOCALAPPDATA 'GourmetAsie\config\migration.env'
pnpm db:migrate
Remove-Item Env:DOTENV_CONFIG_PATH
$runtimeEnv = Join-Path $env:LOCALAPPDATA 'GourmetAsie\config\development.env'
pnpm exec nuxt dev --host 127.0.0.1 --dotenv $runtimeEnv
```

برای اجرای اسکریپت ساخت مدیر نیز DOTENV_CONFIG_PATH باید به فایل خارجیِ حساب مجاز اشاره کند؛ رمز کاربر برنامه از stdin وارد می‌شود و نباید در فایل کد یا دستور ثبت‌شده باشد. migration و ایجاد مدیر هنوز روی PostgreSQL مستقل آزمایش نشده‌اند.

Créer le premier administrateur : fournir un secret unique de 15 à 128 caractères sur l’entrée standard. Ne pas le mettre dans une commande enregistrée ni dans le dépôt. Exemple PowerShell 7 avec saisie masquée :

```powershell
$adminPassword = Read-Host 'Mot de passe administrateur' -MaskInput
$adminPassword | pnpm admin:create 'adresse-administrateur@restaurant.fr' 'Responsable'
Remove-Variable adminPassword
$runtimeEnv = Join-Path $env:LOCALAPPDATA 'GourmetAsie\config\development.env'
pnpm exec nuxt dev --host 127.0.0.1 --dotenv $runtimeEnv
```

Ouvrir http://localhost:3000. Le provisionnement se ferme dès qu’un compte existe, avec verrou transactionnel contre les créations concurrentes. Les comptes supplémentaires sont créés par un administrateur via `POST /api/management/staff`, avec `email`, `displayName`, `password`, `role`. Aucune inscription publique. La récupération de mot de passe et la gestion complète du cycle de vie du personnel restent à définir.

## Commandes

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm db:generate
pnpm db:migrate
```

Les tests Vitest utilisent PGlite (PostgreSQL embarqué), jamais la base du restaurant. Les tests Playwright utilisent le build et vérifient l’accès anonyme et le formulaire mobile. Aucun identifiant réel n’est nécessaire.

## API de gestion

`/api/management/categories`, `/products`, `/variants`, `/tables` : GET pour ADMIN et WAITER ; POST, PUT et DELETE pour ADMIN. PUT et DELETE prennent `?id=<uuid>`. PUT attend l’objet complet. DELETE est refusé si l’objet est référencé ; préférer `active: false` pour archiver. Les écritures exigent `Content-Type: application/json` et un en-tête `Origin` égal à `APP_ORIGIN`. Le navigateur transmet ce dernier automatiquement. Connexion : `/api/auth/login`, déconnexion : `/api/auth/logout`, session : `/api/auth/me`.

L’interface admin permet la consultation et l’ajout des référentiels. La modification et la suppression sont disponibles via l’API ; leur interface avancée n’est pas livrée ici. Les listes sont limitées à 1 000 entrées ; pagination à prévoir si nécessaire.

## Exécution autonome

```powershell
pnpm build
# Charger DATABASE_URL et APP_ORIGIN dans l’environnement du processus.
# Le serveur compilé ne charge pas automatiquement .env.
$env:NODE_ENV = 'production'
$runtimeEnv = Join-Path $env:LOCALAPPDATA 'GourmetAsie\config\production.env'
node --env-file=$runtimeEnv .output/server/index.mjs
```

Déployer le serveur Node derrière un reverse proxy HTTPS, y compris sur le réseau du restaurant : les cookies de production sont Secure. Définir APP_ORIGIN sur l’URL HTTPS exacte, sans barre finale. Aucun abonnement cloud requis. PostgreSQL reste privé. Prévoir sauvegardes PostgreSQL et tests de restauration avant exploitation. Ne pas utiliser `docker compose down -v` : cela efface les données.

## Références techniques

Configuration Tailwind via le [guide officiel Nuxt](https://tailwindcss.com/docs/installation/framework-guides/nuxt). Migrations générées et versionnées selon le [workflow Drizzle](https://orm.drizzle.team/docs/migrations). Les versions retenues sont validées par les commandes du projet ; voir PROJECT_PROGRESS.md pour les résultats et limites.

راهنمای پشتیبان‌گیری و بازیابی مجاز: [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md). هیچ بازیابی واقعی هنوز اجرا نشده است.
