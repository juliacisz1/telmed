## Pierwsze uruchomienie:

### w katalogu backendu:
```bash
docker compose up -d
docker compose run --rm web python manage.py migrate
docker compose run --rm web python manage.py import_dictionaries --drugs drugs.csv --diagnoses diagnosis.csv --specialties specialties.csv
```

### w katalogu frontendu:
```bash
npm install
npm run dev
```

## Kolejne uruchomienia:
### w katalogu backendu:
```bash
docker compose up -d
```
### w katalogu frontendu:
```bash
npm run dev
```

### Aplikacja: http://localhost:5173
