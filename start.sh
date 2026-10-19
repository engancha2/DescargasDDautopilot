#!/bin/bash

# DescargasDD Manager - Auto-inicio
# Se ejecuta al reiniciar el Mac, arranca el servidor y abre el navegador

# Esperar a que el sistema esté listo
sleep 10

# Arrancar el servidor Next.js
cd /Users/xavi/Projects/descargasdd-manager
npx next dev --hostname 0.0.0.0 --port 3001 &

# Esperar a que el servidor responda
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 | grep -q "200"; then
    break
  fi
  sleep 2
done

# Abrir el navegador
open "http://localhost:3001"