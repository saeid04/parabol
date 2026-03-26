# Easily deploy Parabol on Dokku

Upstream parabol have some issue that makes end user can’t deploy to their self hosted dokku instance or simply running `docker-compose up -d` on their local

Some of the problems are the outdated Dockerfile and misconfigured env. Most of the scripts in the root project either need dependencies that are only available in sub-packages, or require a fully connected and migrated database before they can run.

> Features:
>
> - Enterprise org by default (via `IS_ENTERPRISE=true`)
> - Single-stage Docker build with migration at container startup
> - PostgreSQL 16 with pgvector, Valkey (Redis-compatible), no RethinkDB
> - Uses pnpm (Node 24)
> - `APP_ORIGIN` env var for correct HTTPS URLs behind a reverse proxy (OAuth callbacks, lazy-loaded assets, email links)

---

There are two way to deploy the app:

## The docker-compose way

The easiest way, you just need to clone this repo and then you should be able to `cp .env.example .env` and run `docker-compose up -d` that should be the bare minimum to run it

Then you can config the other .env value later. Please refer to upstream repo for available .env config https://github.com/ParabolInc/parabol

> You might wanna run
> `docker-compose -f docker-compose.yml -f ./docker/docker-compose.selfHosted.yml up -d`
> instead to make the storage persistance

If you saw connection refused when try to open the parabol app, since the migration and build need fully connected DB, after the container is created you might need to check parabol app log until you saw something like

```
2023-02-10T02:45:26.698581809Z app[web.1]: 🔥🔥🔥 Server ID: 1. Ready for Sockets: Port 80 🔥🔥🔥
2023-02-10T02:45:30.390679700Z app[web.1]: 💧💧💧 Server ID: 11. Ready for GraphQL Execution 💧💧💧
2023-02-10T02:45:31.257729102Z app[web.1]: 💧💧💧 Server ID: 1. Ready for GraphQL Execution 💧💧💧
```

Then after that you can try to open again in the browser

## Dokku Deployment

The most preferred way if you want to deploy it on server

> Pre-req to using this guideline:
>
> - You need to have Dokku (https://github.com/dokku/dokku) installed on your server and you need to understand Dokku
> - Better if a domain already pointed to your server and you already config it as global domain in dokku
> - Your local computer SSH public key already registered on your dokku server (so you can deploy 🚀)

### 1. Create Parabol app

```
sudo dokku apps:create parabol
sudo dokku proxy:ports-set parabol http:80:80
sudo dokku storage:ensure-directory parabol-data
sudo dokku storage:mount parabol /var/lib/dokku/data/storage/parabol-data:/parabol/self-hosted
```

That will create the app and mount the self hosted directory

### 2. You need to install 2 plugins: `postgres`, `redis`

> Note: RethinkDB is no longer required — the upstream has fully migrated to PostgreSQL 16.

```
sudo dokku plugin:install https://github.com/dokku/dokku-postgres.git postgres
sudo dokku plugin:install https://github.com/dokku/dokku-redis.git redis
```

### 3. Then create DB

```
sudo dokku postgres:create pb-pg --image "pgvector/pgvector" --image-version "0.8.0-pg16"
sudo dokku redis:create pb-redis
```

Save the `postgres` DSN printed after creation, e.g. `postgres://username:thepassword@the-db-host:5432/pb_pg` — you'll need it in step 5.

### 4. Link created DB

```
sudo dokku postgres:link pb-pg parabol -a "POSTGRES_URL"
sudo dokku redis:link pb-redis parabol
```

### 5. Submit ENV

For postgres we need to manually set this value first, because by default it’s not using DSN
Based value that you’re copied on step 3, for example: `postgres://username:thepassword@the-db-host:5432/pb_pg` then you can run

```
sudo dokku config:set parabol POSTGRES_DB=pb_pg --no-restart
sudo dokku config:set parabol POSTGRES_HOST=the-db-host --no-restart
sudo dokku config:set parabol POSTGRES_PASSWORD=thepassword --no-restart
sudo dokku config:set parabol POSTGRES_USER=username --no-restart
```

Then excluding:

- `POSTGRES_DB`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_USER`
- `REDIS_URL`

You can copy the rest of environments on `.env.example`

Then using nano editor to paste it to dokku ENV file (instead of set up one by one like above)

```
sudo nano /home/dokku/parabol/ENV
```

Paste the environment variable there and `Ctrl + X` >>>> `Y` >>>> `Enter` to save

This should give you bare minimum to run the app, you can config it again later (Refer to https://github.com/ParabolInc/parabol
for more config)

### 6. Installing letsencrypt to activate SSL

```
sudo dokku plugin:install https://github.com/dokku/dokku-letsencrypt.git
sudo dokku letsencrypt:set --global <your@email.address>
sudo dokku letsencrypt:enable parabol
sudo dokku letsencrypt:cron-job --add
```

### 6b. Set APP_ORIGIN (required for HTTPS)

After enabling SSL, set `APP_ORIGIN` to your public HTTPS URL. This is used for OAuth callbacks, email links, and — critically — the webpack public path for lazy-loaded assets. Without it, dynamically imported JS chunks will load over HTTP even when your site is on HTTPS.

```
sudo dokku config:set parabol APP_ORIGIN=https://<your.domain> --no-restart
```

### 7. Decide using Heroku buildpack / Dockerfile

You can actually skip this step if you want to use Heroku buildpack

> But I'm not tested it again since it's just too slow

If you choose to use Heroku buildpacks, then go straight to step 8, otherwise 👇🏻

So the other option is try to use dockerfile instead heroku buildpack (dockerfile is faster as well)

```
sudo dokku builder-dockerfile:set parabol dockerfile-path docker/Dockerfile.prod
```

But the trade off are the migration process and build will happens AFTER the container is up, because as i mention earlier even the build process need to be connected to fully migrated database, and the Dockerfile build process is not connected yet to database and not exposed to ENV
Probably need to skip check as well

> 🔥 BEWARE 🔥 This will disable zero downtime deployment, you might need to wait up to 10 mins after deployment until the migration finish successfully and the app will unaccessible during that time

```
sudo dokku checks:skip parabol
```

### 8. Deploy the app

Assuming your SSH key already setted up on pre-req

First you need to clone this repo on your local computer

```
git remote add dokku@<your-server-domain-or-ip>:parabol
```

then

```
git push dokku master
```

After push success, go to your server console, then monitor it using

```
sudo dokku logs parabol -t
```

Until you saw something like

```
2023-02-10T02:45:26.698581809Z app[web.1]: 🔥🔥🔥 Server ID: 1. Ready for Sockets: Port 80 🔥🔥🔥
2023-02-10T02:45:30.390679700Z app[web.1]: 💧💧💧 Server ID: 11. Ready for GraphQL Execution 💧💧💧
2023-02-10T02:45:31.257729102Z app[web.1]: 💧💧💧 Server ID: 1. Ready for GraphQL Execution 💧💧💧
```

then try to open it on your browser, for example if your domain is `foo.com` then by default it should be

```
https://parabol.foo.com
```

This isn’t ideal, but the easiest way. You could actually use CI/CD to spin up temporary database, migrate it, and building all the assets before actually pushing it to dokku, feel free to refer to circle ci `config.yaml` if you want to do that.

# FAQ

If postgres fails to connect, check the logs:

```
sudo dokku postgres:logs pb-pg -t
```

Make sure you're using the `pgvector/pgvector:0.8.0-pg16` image.

# Another known config

## Update invitation link

For example if your parabol domain is `parabol.foo.com` then on your server run:

```
sudo dokku config:set parabol INVITATION_SHORTLINK=parabol.foo.com/invitation-link
```

## Mixed HTTP/HTTPS assets (some JS loads over HTTP)

If you see some static assets (especially lazy-loaded chunks like `UnpaidTeamModalRoot_xxx.js`) loading over HTTP while others load over HTTPS, `APP_ORIGIN` is not set. The server uses it to build `__webpack_public_path__` at runtime — without it, dynamic imports fall back to `http://`.

```
sudo dokku config:set parabol APP_ORIGIN=https://<your.domain> --no-restart
sudo dokku ps:restart parabol
```

## Enable Google Sign In

```
sudo dokku config:set parabol GOOGLE_OAUTH_CLIENT_ID='client_id' --no-restart
sudo dokku config:set parabol GOOGLE_OAUTH_CLIENT_SECRET='secret' --no-restart
sudo dokku config:set parabol APP_ORIGIN=https://<your.domain>
sudo dokku ps:restart parabol
```

The value of `client id` and `secret` can be gather on google cloud console https://developers.google.com/identity/protocols/oauth2. You don't need to pay anything to enable it

You need to set Authorized redirect URI's to `https://<your.domain>/auth/google` on google cloud console

> Make sure to set `APP_ORIGIN` to your public URL (e.g. `https://your.domain`), since it is used in `packages/server/appOrigin.ts` to construct the app origin for OAuth callbacks. If you see `Invalid Login Code` during Google login, check this value and the redirect URI you set in the Google Cloud Console.

## Enable JIRA integration

You need to create account on developer.atlassian.com https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/
set auth callback url to `https://<your.domain>/auth/callback`
and set `OAUTH2_REDIRECT` env

```
sudo dokku config:set parabol OAUTH2_REDIRECT=https://<your.domain>/auth/callback
```

from attlasian developer console you can receive `client_id` and `secret`. Then on your server run:

```
sudo dokku config:set parabol ATLASSIAN_CLIENT_ID="your_client_id" --no-restart
sudo dokku config:set parabol ATLASSIAN_CLIENT_SECRET="your_secret" --no-restart
sudo dokku ps:restart parabol
```

## Other things?

Other things please refer to the upstream repo https://github.com/ParabolInc/parabol, The change in here probably will breaking to upstream so it's not possible to merge it there, will try keep maintain to be up to date with upstream.
