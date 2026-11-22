# Secret Santa Backend

API per la gestione dei partecipanti e degli abbinamenti Secret Santa, basata su Node.js, TypeScript, Express e PostgreSQL.

## Modalita di deployment

| Modalita | Backend | Database | Quando sceglierla |
| --- | --- | --- | --- |
| Docker con database esterno | Container costruito dal `Dockerfile` | PostgreSQL gestito da un provider o su un altro server | Per gestire il database indipendentemente dall'applicazione |
| Docker Compose | Container costruito dal `Dockerfile` | Container PostgreSQL 17 con volume persistente | Per ospitare entrambi i servizi su una singola VPS |

In entrambi i casi backend e database sono separati. Non occorre installare Node.js sul server: la compilazione avviene nell'immagine Docker.

## Prerequisiti

- Docker Engine e, per la seconda modalita, il plugin Docker Compose aggiornati.
- Repository disponibile sul server e terminale aperto nella sua directory principale.
- Porta HTTP del backend disponibile, predefinita `4000`.
- Per la produzione: dominio, reverse proxy con HTTPS e una strategia di backup del database.

I file `.env` non sono versionati e non vengono inclusi nell'immagine. `.env.example` documenta le variabili senza contenere credenziali reali. Non sovrascrivere un `.env` esistente senza verificarne il contenuto.

## 1. Docker Con Database Esterno

In questa modalita non usare `compose.yaml`: il container backend si collega a un PostgreSQL gia disponibile.

### Passo 1: Preparare PostgreSQL

Crea un database e un utente dedicati sul servizio PostgreSQL scelto. Consenti le connessioni solo dal server del backend, preferibilmente su rete privata, e recupera host, porta, nome del database e credenziali.

Il container deve poter raggiungere l'host indicato nella stringa di connessione. `localhost` dentro il container indica il container stesso, non il server Docker. Su Docker Desktop puoi usare `host.docker.internal` per raggiungere un database sul computer host; su Linux configura una rete o un indirizzo raggiungibile dal container.

### Passo 2: Inizializzare Lo Schema

Da una macchina con il client `psql`, accesso al database e questo repository, esegui lo schema sul database appena creato:

```bash
psql --dbname='postgresql://santa_app:PASSWORD_URL_ENCODED@db.example.com:5432/secret_santa?sslmode=verify-full' \
  --set=ON_ERROR_STOP=1 \
  --file=db/schema.sql
```

Sostituisci i valori dimostrativi con quelli reali. Il file crea tabelle, indici e l'estensione `uuid-ossp`: l'utente che inizializza il database deve avere i permessi necessari. Se il provider limita le estensioni, abilita `uuid-ossp` tramite il suo pannello o un amministratore.

Usa le impostazioni TLS indicate dal provider. L'esempio richiede TLS con verifica del certificato e del nome host; se occorre una CA privata, rendila disponibile anche nel container e configura la connessione secondo le istruzioni del provider. Non disabilitare la verifica del certificato per aggirare errori TLS.

Il backend non esegue automaticamente `db/schema.sql` in questa modalita.

### Passo 3: Configurare Le Variabili

Configura un `.env` sul server con questi valori:

```dotenv
NODE_ENV=production
PORT=4000
CORS_ORIGIN=https://santa.example.com
DATABASE_URL=postgresql://santa_app:PASSWORD_URL_ENCODED@db.example.com:5432/secret_santa?sslmode=verify-full
```

| Variabile | Significato |
| --- | --- |
| `DATABASE_URL` | Obbligatoria. Connessione PostgreSQL completa di utente, password, host, porta, database ed eventuali parametri TLS |
| `PORT` | Porta su cui ascolta Node.js nel container; predefinita `4000` |
| `CORS_ORIGIN` | Origine del frontend, comprensiva di protocollo ed eventuale porta, senza percorso |
| `NODE_ENV` | Ambiente Node.js; l'immagine imposta gia `production` |

La struttura della connessione e `postgresql://UTENTE:PASSWORD@HOST:PORTA/DATABASE`. Codifica con percent-encoding gli eventuali caratteri riservati nelle credenziali: per esempio `@` nella password diventa `%40`.

Il backend legge `DATABASE_URL`, non variabili separate come `DB_HOST`, `DB_USER` o `POSTGRES_PASSWORD`. In questa modalita le variabili `POSTGRES_*` presenti in `.env.example` non configurano la connessione del backend.

Proteggi il file:

```bash
chmod 600 .env
```

### Passo 4: Costruire E Avviare Il Backend

```bash
docker build -t secret-santa-backend:latest .
docker run -d \
  --name secret-santa-backend \
  --restart unless-stopped \
  --env-file .env \
  -p 4000:4000 \
  secret-santa-backend:latest
```

**`--env-file .env` passa le variabili al processo nel container.** La sola presenza di `.env` accanto al Dockerfile non le rende disponibili al container.

In alternativa, puoi passarle esplicitamente con `--env` al posto di `--env-file`:

```bash
docker run -d \
  --name secret-santa-backend \
  --restart unless-stopped \
  -p 4000:4000 \
  --env PORT=4000 \
  --env CORS_ORIGIN=https://santa.example.com \
  --env 'DATABASE_URL=postgresql://santa_app:PASSWORD_URL_ENCODED@db.example.com:5432/secret_santa?sslmode=verify-full' \
  secret-santa-backend:latest
```

Questi sono due avvii alternativi, non consecutivi. Gli esempi inline mostrano la sintassi, ma evita credenziali reali nella cronologia della shell: usa un file protetto o l'iniezione dei segreti offerta dalla piattaforma. Le variabili del container rimangono accessibili a chi amministra Docker.

In `-p PORTA_HOST:PORTA_CONTAINER`, la porta a destra deve corrispondere a `PORT` nel container. Per pubblicare sulla porta `8080` lasciando Node.js su `4000`, usa `-p 8080:4000` senza cambiare `PORT`.

### Passo 5: Verificare Il Deployment

```bash
docker logs --tail 100 secret-santa-backend
curl --fail http://localhost:4000/api/health
curl --fail http://localhost:4000/api/participants
```

`/api/health` verifica che il backend risponda, ma non interroga PostgreSQL. `/api/participants` verifica anche la connessione e la presenza dello schema; su un database vuoto restituisce `[]`.

### Passo 6: Aggiornare O Arrestare

Dopo aver aggiornato il codice, ricostruisci e ricrea il container:

```bash
docker build -t secret-santa-backend:latest .
docker stop secret-santa-backend
docker rm secret-santa-backend
docker run -d \
  --name secret-santa-backend \
  --restart unless-stopped \
  --env-file .env \
  -p 4000:4000 \
  secret-santa-backend:latest
```

Mantieni le eventuali personalizzazioni di porte e configurazione. La procedura comporta una breve interruzione del backend e non modifica il database esterno. Per il solo arresto usa `docker stop secret-santa-backend`.

## 2. Backend E PostgreSQL Con Docker Compose

`compose.yaml` avvia due servizi: `backend` e `postgres`. PostgreSQL non pubblica la porta `5432` sull'host; il backend lo raggiunge sulla rete Docker usando il nome `postgres`.

### Passo 1: Configurare L'Ambiente

Configura il `.env` della directory del progetto seguendo `.env.example`:

```dotenv
PORT=4000
CORS_ORIGIN=https://santa.example.com
POSTGRES_DB=secret_santa
POSTGRES_USER=secret_santa
POSTGRES_PASSWORD=SOSTITUIRE_CON_UNA_PASSWORD_CASUALE
```

Genera una password con:

```bash
openssl rand -hex 32
```

Usa il risultato come `POSTGRES_PASSWORD` e proteggi il `.env` con `chmod 600 .env`. Per questa configurazione usa nomi e credenziali URL-safe, senza caratteri riservati: la password esadecimale generata e adatta.

Compose costruisce automaticamente:

```text
postgresql://POSTGRES_USER:POSTGRES_PASSWORD@postgres:5432/POSTGRES_DB
```

**Un eventuale `DATABASE_URL` nel `.env` viene ignorato da questa configurazione Compose.** La connessione viene costruita dai tre valori `POSTGRES_*`. Il file `.env` viene letto da Compose per sostituire le variabili; il blocco `environment` di ogni servizio stabilisce quali valori passare al container.

In questa modalita `PORT` controlla la porta pubblicata sull'host; il backend ascolta sempre su `4000` nel container. Ad esempio `PORT=8080` rende l'API disponibile su `http://localhost:8080`.

### Passo 2: Validare E Avviare

I comandi seguenti usano il nome progetto esplicito `secret-santa`, da mantenere anche negli avvii successivi per riutilizzare lo stesso volume:

```bash
docker compose -p secret-santa config --quiet
docker compose -p secret-santa up -d --build --wait
```

Al primo avvio PostgreSQL inizializza il volume `postgres_data` ed esegue `db/schema.sql`. Compose attende il health check del database prima di avviare il backend. Entrambi i servizi hanno la politica di riavvio `unless-stopped`.

Lo schema viene eseguito **solo quando il volume dati e vuoto**. Modificare il file SQL non aggiorna automaticamente un database esistente: gli aggiornamenti dello schema richiedono una procedura di migrazione separata.

Se Compose segnala `compose build requires buildx 0.17.0 or later`, aggiorna Docker/Buildx oppure separa build e avvio:

```bash
docker build -t secret-santa-backend .
docker compose -p secret-santa up -d --no-build --wait
```

Il tag `secret-santa-backend` corrisponde all'immagine attesa dal servizio `backend` con il nome progetto `secret-santa`.

### Passo 3: Verificare I Servizi

```bash
docker compose -p secret-santa ps
docker compose -p secret-santa logs --tail 100 backend postgres
curl --fail http://localhost:4000/api/health
curl --fail http://localhost:4000/api/participants
```

Adatta la porta dei comandi `curl` se hai cambiato `PORT`. La seconda richiesta verifica anche l'accesso al database e allo schema.

### Passo 4: Aggiornare I Container

Dopo aver aggiornato il codice:

```bash
docker compose -p secret-santa up -d --build --wait
```

Con il problema Buildx descritto sopra, ripeti invece build e avvio separati. I dati restano nel volume anche quando i container vengono ricreati.

Le variabili `POSTGRES_*` inizializzano il database solo alla prima creazione. Cambiare password, utente o nome database nel `.env` non modifica quelli gia presenti nel volume: gestisci questi cambiamenti anche in PostgreSQL, coordinandoli con la configurazione del backend.

### Passo 5: Arrestare Senza Perdere I Dati

```bash
docker compose -p secret-santa down
```

Questo comando rimuove container e rete, ma conserva il volume. Per riavviare usa il comando del passo 2.

**Non aggiungere `--volumes` o `-v` in produzione se vuoi conservare i dati:** `docker compose down --volumes` elimina anche il database del progetto.

## Note Di Produzione

- Usa un reverse proxy con HTTPS. I comandi mostrati pubblicano il backend sulle interfacce dell'host: limita l'accesso con il firewall o pubblica solo su loopback se il proxy gira sullo stesso host, ad esempio `127.0.0.1:4000:4000`.
- Imposta `CORS_ORIGIN` sull'origine reale del frontend. CORS non sostituisce autenticazione e autorizzazione: questo backend non implementa controlli di accesso alle API, quindi valuta protezioni aggiuntive prima di esporlo pubblicamente.
- Prevedi backup automatici fuori dal server e verifica il ripristino. Un volume Docker persistente non e un backup.
- Due container sulla stessa VPS non offrono alta disponibilita: un guasto al server interrompe entrambi i servizi.
- Pianifica gli aggiornamenti di sicurezza di dipendenze e immagini. Non cambiare la versione major di PostgreSQL senza una procedura di aggiornamento dei dati.
