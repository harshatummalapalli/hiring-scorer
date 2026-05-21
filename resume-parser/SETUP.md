# Karta Resume Parser — Google Cloud Run Setup

## Step 1 — Google Cloud account

1. Go to console.cloud.google.com
2. Create a new project called "karta-parser"
3. Note your PROJECT_ID (shown in top bar)

## Step 2 — Enable APIs

In Cloud Console, go to APIs & Services → Enable:

- Cloud Run API
- Cloud Build API
- Container Registry API

## Step 3 — Set budget alert (free tier protection)

1. Go to Billing → Budgets & Alerts
2. Click "Create Budget"
3. Name: "Karta Parser Free Tier"
4. Budget type: Monthly
5. Amount: $0.01 (we want to catch ANY charges)
6. Alert threshold: 1% (fires before you hit $0.01)
7. Email alert to: your Gmail

This ensures you are notified the moment the service would cost money — well before it does.

## Step 4 — Deploy

In your terminal, from the **repository root** (parent of `resume-parser/`):

```bash
gcloud init
gcloud builds submit --config resume-parser/cloudbuild.yaml \
  --project=YOUR_PROJECT_ID
```

## Step 5 — Get your service URL

After deploy, Cloud Run shows a URL like:

`https://karta-resume-parser-xxxxx-uc.a.run.app`

## Step 6 — Add to Karta

In Vercel dashboard → your Karta project → Environment Variables, add:

- `RESUME_PARSER_URL` = `https://karta-resume-parser-xxxxx-uc.a.run.app`
- `PARSER_SECRET_KEY` = (create a random 32-char string, e.g. `openssl rand -hex 32`)

Set the same `PARSER_SECRET_KEY` on the Cloud Run service:

```bash
gcloud run services update karta-resume-parser \
  --region=us-central1 \
  --set-env-vars=PARSER_SECRET_KEY=your_secret_here
```

## Local development

```bash
cd resume-parser
pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn main:app --port 8001 --reload
```

In Karta `.env.local`:

```
RESUME_PARSER_URL=http://localhost:8001
PARSER_SECRET_KEY=your_secret_here
```
