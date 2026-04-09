#!/bin/bash
# Deploy a Produccion (sura-csr.vercel.app)
echo "Desplegando a PRODUCCION..."
cp .vercel-prod/project.json .vercel/project.json
npx vercel --prod --yes 2>&1
echo "Produccion lista."
