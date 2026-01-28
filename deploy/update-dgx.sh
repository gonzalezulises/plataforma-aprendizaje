#!/bin/bash
# Update backend on DGX Spark
# Usage: ./deploy/update-dgx.sh

set -e

echo "Updating plataforma-aprendizaje backend on DGX Spark..."

ssh dgx-spark "cd ~/plataforma-aprendizaje && git pull && cd backend && npm install && pm2 restart plataforma-api"

echo "Done. Backend updated and restarted on DGX."
