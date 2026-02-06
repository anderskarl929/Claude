# EU-Parlamentet Röstningsapp

Röstningsapp för EU-rollspel i klassrummet. Visar resultat i parlamentarisk stil med hemicykel-display, realtidsuppdateringar och gruppfördelning.

## Snabbstart

```bash
cd eu-voting-app
npm install
npm start
```

Appen startar på `http://localhost:3000`.

## Sidor

| Sida | URL | Beskrivning |
|------|-----|-------------|
| Elevlogin | `/` | Elever loggar in och röstar |
| Admin | `/admin.html` | Ordföranden styr omröstningar |
| Monitor | `/monitor.html` | Storskärmsvy med hemicykel |

## Hur det fungerar

### 1. Förberedelse
- Öppna `/admin.html` och logga in (standardlösenord: `eu2026`)
- Varje elev öppnar `/` på sin telefon/dator
- Eleven anger platsnummer (1-58), namn, land och politisk grupp

### 2. Omröstning
- Adminen anger ett ämne och klickar "Öppna omröstning"
- Eleverna ser tre knappar: **JA**, **NEJ**, **AVSTÅR**
- Monitorn (`/monitor.html`) visar rösterna i realtid på hemicykeln

### 3. Resultat
- Adminen stänger omröstningen
- Resultatet visas med ANTAGEN/AVSLAGEN och stapeldiagram
- All historik sparas under sessionen

## Visa på storskärm

Öppna `/monitor.html` i ett eget webbläsarfönster och visa på projektor. Monitorn visar:
- EU-parlamentets hemicykel med 58 platser
- Realtidsröstning med färgkodade platser (grönt/rött/gult)
- Totalsummor och gruppfördelning
- Stort resultatmeddelande vid avslutad omröstning

## Politiska grupper

- EPP - Europeiska folkpartiet
- S&D - Socialdemokraterna
- Renew Europe
- Gröna/EFA
- ECR - Konservativa
- ID - Identitet och Demokrati
- GUE/NGL - Vänsterpartiet
- Grupplösa

## Teknisk info

- Node.js + Express + Socket.io
- All data lagras i minnet (nollställs vid omstart)
- Ingen databas behövs
- Alla elever i samma nätverk behöver nå servern
