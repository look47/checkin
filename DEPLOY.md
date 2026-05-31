# Guida Deploy Gratuito su Render

## Cosa ho fatto per te
Ho configurato il progetto per Render (hosting gratuito):
- ✅ Aggiornato package.json
- ✅ Configurato porta automatica
- ✅ Pronto per deploy

## Passaggi (5 minuti totali)

### 1. Crea account GitHub (se non l'hai)
- Vai su github.com
- Crea account gratuito
- Crea nuovo repository (nome: checkin-app)

### 2. Carica il progetto
Apri terminale nella cartella del progetto e scrivi:

```bash
git init
git add .
git commit -m "Primo commit"
git branch -M main
git remote add origin https://github.com/TUO_USERNAME/checkin-app.git
git push -u origin main
```

### 3. Deploy su Render
1. Vai su https://render.com
2. Crea account gratuito (usa GitHub per login)
3. Clicca "New" → "Web Service"
4. Clicca "Connect" sul tuo repository GitHub
5. Render rileverà automaticamente le impostazioni
6. Clicca "Create Web Service"

### 4. Attendi 2-3 minuti
Render:
- Installa Node.js
- Avvia il server
- Crea HTTPS automatico
- Ti darà un URL tipo: https://checkin-app.onrender.com

### 5. Usa l'app
Apri l'URL che ti dà Render:
- Per check-in: https://checkin-app.onrender.com
- Per admin: https://checkin-app.onrender.com/admin.html

## Credenziali Admin
- Comune di Milano: comune-a / milano2024
- Comune di Roma: comune-b / roma2024

## Note importanti
- **Gratuito**: Sì, completamente gratuito
- **HTTPS**: Automatico, non devi configurare nulla
- **Riattivazione**: Se non lo usi per 15 minuti, si "addormenta". Quando lo riapri, si riattiva in 30 secondi
- **Dati**: I dati salvati restano anche quando è addormentato
- **Per prove occasionali**: Perfetto per il tuo caso d'uso

## Se non funziona
Vai su Render → Dashboard → Il tuo progetto → Logs per vedere errori.

## Perché Render?
- ✅ Completamente gratuito
- ✅ HTTPS automatico
- ✅ Deploy da GitHub (facile)
- ✅ Si riattiva quando serve
- ✅ Database incluso (gratis 90 giorni, poi puoi migrare o continuare con JSON locale)
