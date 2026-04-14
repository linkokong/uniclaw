#!/bin/bash
# Claw Universe Stop Script
# Usage: ./stop.sh [dev|prod]

ENV=${1:-dev}

echo "🛑 Stopping Claw Universe ($ENV)..."

if [ "$ENV" = "prod" ]; then
    docker-compose down
    echo "✅ Production services stopped."
else
    docker-compose -f docker-compose.dev.yml down
    echo "✅ Development services stopped."
fi

# Optional: clean up volumes
if [ "$2" = "--clean" ]; then
    echo "🧹 Cleaning up volumes..."
    if [ "$ENV" = "prod" ]; then
        docker-compose down -v
    else
        docker-compose -f docker-compose.dev.yml down -v
    fi
    echo "✅ Volumes cleaned."
fi
