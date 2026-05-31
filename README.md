# Check-In WebApp

WebApp mobile-first per certificazione della presenza fisica (visite fiscali, accertamento residenza per Comuni ed enti pubblici).

## Funzionalità Implementate

### Core
- ✅ Form per Codice Fiscale e indirizzo di residenza
- ✅ Geocoding indirizzo (OpenStreetMap Nominatim)
- ✅ Acquisizione GPS con verifica distanza (raggio 30m)
- ✅ Anteprima GPS pre-invio con mappa
- ✅ Sistema check-in a tempo (link univoci, timer 15 min)
- ✅ Pannello admin con salvataggio JSON locale

### Autenticazione & Sicurezza
- ✅ Simulazione autenticazione SPID (precompilazione e blocco CF)
- ✅ Dashboard multi-tenant per Comuni (Comune di Milano, Comune di Roma)
- ✅ Anti-frode: selfie ambientale obbligatorio (Base64)
- ✅ Anti-frode: controllo Mock Location GPS
- ✅ Rate limiting API (100 richieste/minuto per IP)

### MVP Improvements
- ✅ Logging strutturato (file logs/app-YYYY-MM-DD.log)
- ✅ Error handling centralizzato
- ✅ Health check endpoint (`/health`)
- ✅ Validazione input (CF, CAP, provincia, coordinate)
- ✅ Environment variables (.env.example)

## Setup

### Prerequisiti
- Node.js >= 18.0.0

### Installazione
```bash
# Copia file environment variables
cp .env.example .env

# Avvia server
node serve.js
```

### Configurazione
Modifica `.env` per configurare:
- Porte HTTP/HTTPS
- Password admin
- TTL sessioni
- Parametri rate limiting

## API Endpoints

### Health Check
```
GET /health
```
Ritorna stato server, uptime, memoria, environment.

### Autenticazione
```
POST /api/admin/login
Body: { comuneId, password }
```
Credenziali:
- Comune di Milano: comune-a / milano2024
- Comune di Roma: comune-b / roma2024

### Check-In
```
POST /api/checkin
Body: { esito, codiceFiscale, indirizzo, latitudine, longitudine, ... }
```

### Richieste
```
GET /api/richieste?stato=&limit=
POST /api/richieste
Body: { codiceFiscale, via, civico, cap, comune, provincia }
```

### Statistiche
```
GET /api/stats
```
Ritorna: totale, oggi, verificati, falliti, successo % (filtrati per comune)

## Logging

I log vengono salvati in `logs/app-YYYY-MM-DD.log` con formato:
```
[2024-05-31T07:00:00.000Z] [INFO] Messaggio {"meta":"data"}
```

Livelli: INFO, WARN, ERROR, DEBUG

## Multi-Tenancy

Ogni Comune vede solo i propri check-in e richieste:
- Login con selezione comune
- Sessione contiene comuneId
- API filtrano automaticamente per comune
- Dashboard mostra nome comune nell'header

## Anti-Frode

### Selfie Ambientale
- Attivazione fotocamera (MediaDevices API)
- Cattura in Base64
- Obbligatorio prima del check-in definitivo

### Controllo Mock Location
- Analisi precisione GPS (0m o >1000m = sospetto)
- Verifica altitudine mancante
- Controllo timestamp GPS (>1min = sospetto)
- Blocco invio se anomalie rilevate

## Struttura File

```
cursor-tutor-2/
├── index.html          # Frontend check-in
├── admin.html          # Dashboard admin
├── serve.js            # Backend Node.js
├── db.js               # Database check-ins
├── richieste.js        # Gestione richieste
├── logger.js           # Logging strutturato
├── validator.js        # Validazione input
├── data/               # Database JSON
├── logs/               # File di log
└── cert/               # Certificati HTTPS
```

## Roadmap Futura

### Priorità Alta
- Task 4: Notifiche automatiche (SMS/Email via Twilio/SendGrid)
- Task 5: Database relazionale (SQLite/PostgreSQL)
- Deploy cloud + HTTPS reale
- Backup automatico database

### Priorità Media
- PWA manifest + offline support
- Mobile responsive ottimizzato
- Accessibilità (ARIA, keyboard nav)
- API documentation (Swagger)

## Note

- Il sistema usa JSON locale per il database (migrare a PostgreSQL per produzione)
- Certificato HTTPS richiede setup-cert.ps1 per generare server.pfx
- Rate limiting in-memory (per production usare Redis)
