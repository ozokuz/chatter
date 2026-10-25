# Chatter

Teimme chat palvelun käyttäen Socket.IO:ta. Siinä on SolidJS frontend, Express backend, Better Auth sähköposti- ja salasanatunnistautuminen sekä PostgreSQL-tietokantaan tallennus Drizzle ORM:n kautta.
Sovelluksessa on yksi yhteinen keskustelu, jossa palvelun kaikki käyttäjät voivat viestitellä keskenään.

## Docker

1. Kopioi `.env.example` tiedostoon `.env`.
2. Luo salausavain (secret) komennolla `openssl rand -hex 32` ja sijoita se `BETTER_AUTH_SECRET` muuttujaan.
3. Aja `docker compose up --build -d`.
4. Avaa <http://localhost:3000>.

Tuotantoympäristössä pyöritetään kolmea konttia:

- `frontend` tarjoaa käännetyn SolidJS-sovelluksen Nginxin avulla.
- `app` pyörittää Express- ja Socket.IO-backendiä.
- `db` pyörittää PostgreSQL-tietokantaa.

Vain frontend-kontti julkaisee portin hostille. Nginx välittää `/api` ja `/socket.io` pyynnöt backendille. Todennusevästeet ja WebSocket-yhteydet toimivat saman julkisen osoitteen kautta. Express käsittelee ainoastaan API-pyyntöjä.

Frontend käyttää tiedostoa `apps/web/Dockerfile` ja backend tiedostoa `apps/server/Dockerfile`. Molemmat käyttävät kuvan rakentamisen kontekstina repositoryn juurta. Voit rakentaa kumman tahansa kuvan erikseen komennoilla `docker compose build frontend` ja `docker compose build app`.

Taustapalvelin suorittaa versionhallintaan tallennetut tietokantamigraatiot ennen käynnistymistä. `postgres_data` säilyttää käyttäjätilit ja viestit konttien uudelleenkäynnistysten yli.

## Järjestelmän toiminta

- `apps/server`: Express 5, Better Auth, Socket.IO ja Drizzle-kyselyt.
- `apps/web`: SolidJS, Vite, CSS, ja Socket.IO client.
- `packages/shared`: yhteiset viestien ja socket-tapahtumien tyyppimääritykset.
- `drizzle`: versionhallintaan tallennetut SQL-migraatiot ja schema snapshotit.

Rekisteröityminen vaatii yksilöllisen käyttäjätunnuksen, sähköpostiosoitteen ja 8-128 merkkiä pitkän salasanan. Kaikki käyttäjät voivat lukea ja lähettää pelkkää tekstiä sisältäviä viestejä kaikille yhteiseen keskusteluun. Käyttäjälista näyttää olemassa olevat käyttäjät ja niiden online/offline statuksen.

Viestit tallennetaan tietokantaan ennen niiden lähettämistä muille käyttäjille. Viestit ladataan 50 viestin sivuissa. Yhteyden muodostamisen jälkeen client lataa uudelleen viimeisimmät viestit. Enter lähettää viestin ja Shift + Enter lisää uuden rivin. Viesteissä on 4000 merkin pituusrajoitus.

HTTP-pyynnöt ja socket-yhteydet edellyttävät voimassa olevaa Better Auth -evästettä joka tarkistetaan backendissä.

## Konfigurointi julkiseen käyttöön

Palvelua ottaessa käyttöön Docker pohjaisessa tuotantoympäristössä, aseta `BETTER_AUTH_URL` osoittamaan palvelun julkiseen osoitteeseen kuten `https://chat.example.com`; Compose käyttää tätä osoitetta myös luotettuna frontend-osoitteena. Päätä HTTPS-yhteys reverse proxyssa ja välitä sekä HTTP- että WebSocket-liikenne frontendin julkaistuun porttiin (oletuksena 3000). `PORT` muuttujalla muutetaan hostille julkaistua porttia. Backend kuuntelee porttia 3000 Compose-verkon sisällä, eikä sen porttia julkaista suoraan hostille.

Compose asettaa `TRUST_PROXY_HOPS=1` backendille, jotta se luottaa frontendin välittämiin pyyntöihin. Nginx ylikirjoittaa saapuvat forwarding headerit yhteyden todellisella osoitteella. Jos Nginxin edessä on erillinen välityspalvelin, asiakkaiden IP-osoitteisiin perustuvat rajoitukset käyttävät kyseisen välityspalvelimen osoitetta.

Dockerin oletusasetuksilla PostgreSQL on käytettävissä vain Compose-verkon sisällä. Aseta oma tietokannan salasana ennen käyttöönottoa. Tarkastellaksesi käynnistysvaiheita ja migraatioita aja komento: `docker compose logs -f app` Tarkastellaskesi Nginxin lokeja aja komento: `docker compose logs -f frontend` 

Tämä kokoonpano pyörittää yhtä sovellusinstanssia. Useiden rinnakkaisten backend instanssien pyörittämistä varten täytyy tehdä koodimuutoksia tukemaan yhteistä Socket.IO-sovitinta.
