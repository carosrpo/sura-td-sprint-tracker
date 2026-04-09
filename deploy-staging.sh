#!/bin/bash
# Deploy a Staging (sura-csr-staging.vercel.app)
echo "Desplegando a STAGING..."
cp .vercel-staging/project.json .vercel/project.json
git add -A && git stash  # guarda cambios sin commitear si los hay
npx vercel --prod --yes 2>&1
git stash pop 2>/dev/null || true
cp .vercel-prod/project.json .vercel/project.json
echo "Staging listo."
