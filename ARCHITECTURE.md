# Architecture — Stage 1

## تصمیم جدید مالک: PostgreSQL بومی Windows

در بررسی نهایی، نصب مستقیم PostgreSQL 17 انتخاب شده است؛ Docker و WSL جزو روش انتخابی نیستند. نصب و اتصال واقعی هنوز انجام نشده‌اند. اطلاعات فعال پایگاه داده و فایل‌های محرمانه باید خارج از OneDrive و مخزن قرار گیرند. فایل محیطیِ نقش محدود برنامه از مسیر خارجی بارگیری می‌شود؛ نقش اجرای migration جداست. حساب superuser فقط برای راه‌اندازیِ مجاز است و نباید DATABASE_URL روزمرهٔ برنامه به آن متصل شود.

هدف پیکربندی پس از مجوز: گوش‌دادن فقط روی loopback، احراز هویت SCRAM-SHA-256، حساب برنامه بدون SUPERUSER/CREATEDB/CREATEROLE و بدون اختیار DDL، نقش مالک migration بدون superuser و مجوزهای محدود به دیتابیس پروژه. این موارد هدف هستند و هنوز اعمال یا آزمایش نشده‌اند. تغییر فایروال و سرویس موجود مجاز نیست. راهنمای پشتیبان‌گیری و بازیابی در docs/BACKUP_RESTORE.md است؛ بازیابی فقط در دیتابیس آزمایشیِ تازه و با اجازهٔ مالک انجام خواهد شد.

Monolithe Nuxt 4 / Vue 3 / TypeScript strict, serveur Nitro/H3, PostgreSQL et Drizzle. Tailwind sert uniquement la présentation. Aucune dépendance cloud obligatoire.

## Organisation

- `app/pages`, `app/components` : interface française et composants de présentation.
- `app/middleware` : redirection des pages ; ne constitue pas la frontière de sécurité.
- `server/api` : transport HTTP, validation Zod, vérification de session et de rôle avant accès métier.
- `server/auth` : hachage, sessions opaques, permissions.
- `server/database` : schéma, contraintes et connexion paresseuse.
- `shared/types`, `shared/validation` : contrats publics et validation sans secret.
- `server/integrations/pos` : port indépendant du transport HTTP et de la base.
- `scripts`, `drizzle`, `tests` : exploitation, migrations immuables et vérifications.

## Données et invariants

Utilisateurs associés à un profil personnel ; rôle ADMIN ou WAITER relu en base à chaque requête. Les catégories contiennent les produits, chaque produit possède des variantes tarifées en centimes entiers d’euro. Une visite référence une table et un membre du personnel. Un index partiel interdit deux visites ouvertes sur une table. Les commandes référencent une visite et un auteur. Les lignes conservent noms et prix unitaires historiques et vérifient l’appartenance de la variante au produit par clé étrangère composite. Suppressions restrictives préservent les références historiques. Les journaux et l’historique ont une date de création ; les entités modifiables ont également updatedAt.

Les mises à jour via Drizzle actualisent updatedAt. Les écritures SQL externes doivent gérer elles-mêmes ce champ. Les mutations de référentiel et leur journal sont atomiques. Aucun endpoint de commande n’est exposé au Stage 1. La logique transactionnelle de commandes, transitions de statut et immutabilité après envoi appartient au Stage 2 ; le schéma seul ne prétend pas la fournir. Ne pas donner d’accès SQL direct à des utilisateurs de l’application.

## Sécurité

Secret de session aléatoire 256 bits ; seul son SHA-256 est stocké en base. Expiration absolue 8 heures, révocation à la déconnexion, cookies HttpOnly, SameSite=Strict, Secure en production. Les comptes inactifs sont refusés immédiatement. Les endpoints relisent le rôle côté serveur. Protection CSRF par contrôle d’origine exacte pour toute mutation, incluant la connexion. Pas de confiance dans les en-têtes proxy pour identifier le client.

Mots de passe hachés avec scrypt et sel aléatoire individuel. Aucune valeur par défaut exploitable. Provisionnement initial CLI exclusivement, transaction et verrou consultatif PostgreSQL. Limiteur de connexion mémoire (10 tentatives par adresse sur 15 minutes) : adapté à une instance, perdu au redémarrage. Derrière proxy, les clients peuvent partager le même quota ; politique proxy et limitation persistante à définir avant exploitation. Récupération de compte, MFA, durée de rétention et journalisation des échecs à arbitrer.

## Intégration caisse (POS)

`PosIntegration` définit seulement un contrat de transmission avec clé d’idempotence. Aucun adaptateur, faux succès ou appel réseau n’existe. L’application restaurant reste propriétaire des commandes. Un adaptateur futur traduira les références internes selon les capacités de la caisse.

À obtenir : fournisseur et version de caisse, documentation/protocole, accès réseau local, authentification, bac à sable, correspondance des produits/variantes/tables, TVA et règles d’arrondi, acquittement, identifiants externes, annulation, erreurs, retries, idempotence et comportement hors ligne. Le port pourra évoluer après réception de ces éléments. Aucun envoi ne doit être annoncé comme réussi avant acquittement réel.
