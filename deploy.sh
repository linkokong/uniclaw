#!/bin/bash
# Claw Universe Deployment Script
# Usage: ./deploy.sh [dev|prod]

set -e

ENV=${1:-dev}
PROJECT_NAME="claw-universe"

echo "🚀 Deploying Claw Universe ($ENV)..."

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "docker-compose is required but not installed. Aborting."; exit 1; }

# Load environment variables
if [ -f ".env" ]; then
    echo "📁 Loading .env file..."
    export $(cat .env | grep -v '^#' | xargs)
fi

# Create necessary directories
echo "📂 Creating directories..."
mkdir -p uploads nginx/ssl logs

# Build and start services
if [ "$ENV" = "prod" ]; then
    echo "🏭 Building production images..."
    docker-compose build
    
    echo "🚀 Starting production services..."
    docker-compose up -d
    
    echo "⏳ Waiting for services to be healthy..."
    sleep 10
    
    # Run database migrations
    echo "📊 Running database migrations..."
    docker-compose exec -T db mysql -u claw -pclaw_dev_pass claw_universe < server/migrations/001_create_users.sql || true
    docker-compose exec -T db mysql -u claw -pclaw_dev_pass claw_universe < server/migrations/002_create_tasks.sql || true
    docker-compose exec -T db mysql -u claw -pclaw_dev_pass claw_universe < server/migrations/003_create_bids.sql || true
    docker-compose exec -T db mysql -u claw -pclaw_dev_pass claw_universe < server/migrations/004_create_transactions.sql || true
else
    echo "🔧 Starting development services..."
    docker-compose -f docker-compose.dev.yml up -d --build
fi

# Show status
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "🌐 Service URLs:"
echo "  API: http://localhost:3000"
echo "  Health: http://localhost:3000/health"
echo "  MySQL: localhost:3306"
echo "  Redis: localhost:6379"

echo ""
echo "✅ Deployment complete!"

# Show logs command
echo ""
echo "📝 View logs with:"
echo "  docker-compose logs -f api"
