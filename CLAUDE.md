# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Alliance Customer Service is a comprehensive Next.js-based customer service platform for Alliance Chemical. It provides intelligent ticket management, automated routing, AI-powered classification, and seamless integrations with Shopify, QuickBooks, and 3CX phone systems. The service runs on port 3002 and is part of the Alliance Chemical microservices architecture.

## Key Features

- **AI-Powered Operations**: OpenAI/Gemini integration for ticket classification, sentiment analysis, and response suggestions
- **SLA Management**: Automated monitoring with escalation alerts at 75%, 90%, and breach thresholds
- **3CX Phone Integration**: Screen-pop functionality with automatic caller information lookup
- **COA Automation**: Auto-attach Certificates of Analysis based on product/lot matching
- **Freight Management**: RFQ list management for batch processing with carriers
- **Teams Integration**: Microsoft Teams notifications for real-time updates
- **Weekly Reporting**: Automated HTML reports with comprehensive metrics

## Essential Commands

### Development
```bash
npm run dev          # Start development server on port 3002
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Database Operations
```bash
npm run db:migrate    # Apply database migrations
npm run db:generate   # Generate new migration from schema changes
npm run db:studio     # Open Drizzle Studio for database management
npm run db:introspect # Introspect existing database schema
```

## Architecture Overview

### Service Architecture
This microservice follows a layered architecture:
1. **API Layer** (`src/app/api/`): Next.js route handlers with Zod validation
2. **Service Layer** (`src/services/`): Business logic and orchestration
3. **Integration Layer** (`src/services/integrations/`): External API clients (Shopify, QuickBooks, 3CX)
4. **Database Layer** (`src/db/`): Drizzle ORM with PostgreSQL
5. **AI Layer** (`src/services/ai/`): Provider abstraction for OpenAI/Gemini

### Key Design Patterns
- **Provider Abstraction**: AI service supports multiple providers (OpenAI/Gemini) with unified interface
- **Resilient Integration**: Failures in external services don't block core operations
- **Event-Driven Processing**: Webhook handlers for 3CX call events
- **Rate Limiting**: Upstash Redis-based rate limiting for public endpoints
- **HMAC Security**: Webhook signature verification for secure integrations

### Database Schema

#### Core Tables
- `customers`: Customer data with Shopify/QuickBooks IDs
- `customer_addresses`: Multiple addresses per customer
- `customer_sync_log`: Integration audit trail

#### Ticketing Tables
- `tickets`: Main ticket records with AI metadata
- `ticket_actions`: Action history (emails, integrations)
- `attachments`: File attachments including auto-attached COAs
- `calls`: 3CX call records with recordings
- `transcripts`: Call transcripts with AI summaries
- `routing_rules`: Configurable routing rules

#### AI Tables
- `ai_operations`: Audit log of all AI operations
- `suggested_responses`: AI-generated response templates

#### Freight Tables
- `freight_inquiries`: Freight RFQ queue management

## Required Environment Variables

### Core Configuration
```bash
DATABASE_URL                  # PostgreSQL connection string
SERVICE_SECRET               # Inter-service authentication secret
APP_URL                      # Base URL (http://localhost:3002)
ALLOWED_ORIGINS             # Comma-separated CORS origins
```

### Integration Keys
```bash
# Shopify
SHOPIFY_STORE_URL           # Format: https://store-name.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN  # Shopify Admin API token

# QuickBooks
QUICKBOOKS_CLIENT_ID        # QuickBooks app client ID
QUICKBOOKS_CLIENT_SECRET    # QuickBooks app client secret

# 3CX Phone System
THREE_CX_WEBHOOK_SECRET     # HMAC secret for webhook verification
THREE_CX_RECORDING_BASE_URL # Base URL for call recordings

# Microsoft Teams
TEAMS_WEBHOOK_URL           # Teams incoming webhook URL

# AI Providers
AI_PROVIDER                 # 'openai' or 'gemini'
AI_API_KEY                  # API key for chosen provider
AI_MODEL                    # Model name (optional)
AI_TEMPERATURE             # 0.0-2.0 (default: 0.7)
AI_MAX_TOKENS              # Max response tokens (default: 2000)
AI_ENABLE_CACHING          # Cache AI responses (default: true)
AI_CACHE_EXPIRY            # Cache TTL in ms (default: 300000)

# Redis/Upstash (for rate limiting)
KV_REST_API_URL            # Upstash Redis REST URL
KV_REST_API_TOKEN          # Upstash Redis token

# Email
MAILGUN_DOMAIN             # Mailgun domain
MAIL_API_KEY               # Mailgun API key

# Cron Jobs
CRON_SECRET                # Secret for cron job authentication
```

## API Endpoints

### Customer Management
- `POST /api/customers` - Create customer with Shopify/QB sync
- `GET /api/customers/email/[email]` - Find by email
- `POST /api/customers/[id]/addresses` - Add address

### Ticket System
- `POST /api/tickets` - Create ticket with AI classification
- `GET /api/tickets` - List tickets (filter by status)
- `GET /api/tickets/[id]` - Get ticket details
- `POST /api/tickets/[id]/suggest-responses` - Generate AI responses

### Call Management
- `POST /api/calls/webhook` - 3CX webhook receiver
- `GET /api/calls/lookup/[callId]` - Caller information lookup

### COA Management
- `GET /api/coa` - Search/list COA documents
- `POST /api/coa` - Add/update COA document

### Freight Management
- `GET /api/freight/list` - Get freight inquiries
- `POST /api/freight/list` - Add to freight list
- `POST /api/freight/rfq` - Send RFQ to carriers

### AI Operations
- `GET /api/ai/test` - Test all AI operations
- `POST /api/ai/test` - Test specific operation
- `GET /api/ai/config` - Get AI configuration
- `POST /api/ai/config` - Update AI configuration
- `GET /api/ai/operations` - AI operation history

### Reports & Jobs
- `GET /api/reports/weekly` - Get weekly statistics
- `POST /api/jobs/sla-check` - Run SLA check (cron)
- `POST /api/jobs/weekly-report` - Send weekly report (cron)

### Health & Testing
- `GET /api/health` - Service health check
- `POST /api/integrations/shopify/test` - Test Shopify
- `POST /api/integrations/quickbooks/test` - Test QuickBooks

## Routing Rules

Default routing based on request type:
- **Quote** → Sales team (Adnan)
- **COA** → COA team (auto-attach if found)
- **Freight** → Logistics team (Lori) + freight list
- **Claim** → Customer service
- **Other** → Customer service

AI-enhanced routing considers:
- Historical assignments
- Customer sentiment
- Urgency indicators
- Agent workload

## SLA Configuration

Default SLA times (in minutes):
- **Quote**: 120 (2 hours)
- **COA**: 60 (1 hour)  
- **Freight**: 240 (4 hours)
- **Claim**: 1440 (24 hours)
- **Other**: 240 (4 hours)

Escalation thresholds:
- **75%**: Warning email to supervisor
- **90%**: Urgent alert to supervisor + manager
- **100%**: Breach notification to supervisor + manager + COO

## Cron Jobs Configuration

Add to `vercel.json` for automated jobs:
```json
{
  "crons": [
    {
      "path": "/api/jobs/sla-check",
      "schedule": "*/5 * * * *"  // Every 5 minutes
    },
    {
      "path": "/api/jobs/weekly-report",
      "schedule": "0 8 * * 1"  // Mondays at 8 AM UTC
    }
  ]
}
```

## Common Development Tasks

### Testing AI Features
```bash
# Test all AI operations
curl http://localhost:3002/api/ai/test

# Test specific operation
curl -X POST http://localhost:3002/api/ai/test \
  -H "Content-Type: application/json" \
  -d '{"operation": "classify", "input": "I need a quote for sulfuric acid"}'
```

### Manually Trigger Jobs
```bash
# Run SLA check
curl -X POST http://localhost:3002/api/jobs/sla-check \
  -H "Authorization: Bearer YOUR_SERVICE_SECRET"

# Send weekly report
curl -X POST http://localhost:3002/api/jobs/weekly-report \
  -H "Authorization: Bearer YOUR_SERVICE_SECRET"
```

### Debug Integration Issues
1. Check `/api/health` for overall status
2. Review specific integration test endpoints
3. Check `customer_sync_log` for sync failures
4. Review `ai_operations` table for AI issues
5. Monitor rate limit headers in responses

## Security Features

- **HMAC Verification**: All webhooks verify signatures
- **Rate Limiting**: Configurable limits per endpoint type
- **Service Authentication**: Bearer token + timestamp validation
- **CORS Protection**: Configurable allowed origins
- **Input Validation**: Zod schemas for all API inputs

## Performance Optimizations

- **AI Response Caching**: Configurable TTL to reduce API costs
- **Database Indexes**: Optimized queries on common fields
- **Parallel Processing**: Dual integrations run concurrently
- **Non-blocking Operations**: Integration failures don't block core functions

## Monitoring & Observability

- **Health Endpoints**: Real-time service status
- **Audit Logging**: Complete trail of AI operations
- **Sync Logs**: Detailed integration history
- **SLA Tracking**: Automated breach detection
- **Weekly Reports**: Comprehensive metrics emails