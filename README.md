# Alliance Customer Service

A dedicated microservice for managing customer data with automatic synchronization to Shopify and QuickBooks, enhanced with AI-powered ticket classification, routing, and response generation.

## Features

### Core Features
- **Customer Management**: Create, search, and manage customer records
- **Dual Integration**: Automatically sync customers to both Shopify and QuickBooks
- **Address Management**: Handle multiple shipping addresses per customer
- **Service Authentication**: Secure service-to-service communication
- **Health Monitoring**: Built-in health checks and monitoring endpoints
- **API Documentation**: RESTful API with consistent response format

### AI-Enhanced Features
- **Intelligent Ticket Classification**: Automatically categorize tickets using AI (quote, COA, freight, claim, other)
- **Smart Routing**: AI-powered ticket assignment based on content, priority, and historical patterns
- **Transcript Summarization**: Convert call transcripts into actionable summaries with key points and action items
- **Sentiment Analysis**: Detect customer sentiment and urgency indicators
- **Response Suggestions**: Generate contextual response templates for agents
- **Entity Extraction**: Automatically extract customer info, products, quantities, and dates from text
- **Dual AI Provider Support**: Choose between OpenAI GPT-4 or Google Gemini for AI operations

## Architecture

This service is part of the Alliance Chemical microservices architecture, extracted from the monolithic ticket system to provide:

- Independent scaling of customer operations
- Isolated database for customer data
- Dedicated integration management
- Service-specific error handling and retry logic

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Shopify Admin API access
- QuickBooks Developer account

### Installation

1. **Clone and install dependencies**:
```bash
cd alliance-customer-service
npm install
```

2. **Set up environment variables**:
```bash
cp .env.local.example .env.local
# Edit .env.local with your configuration
```

3. **Run database migrations**:
```bash
npm run db:migrate
```

4. **Start the development server**:

```bash
npm run dev
```

The service will run on [http://localhost:3002](http://localhost:3002).

## AI Integration

### Configuration

The AI service supports both OpenAI and Google Gemini. Configure in `.env.local`:

```bash
# Choose provider: 'openai' or 'gemini'
AI_PROVIDER="openai"
AI_API_KEY="your-api-key"
AI_MODEL="gpt-4o-mini"  # or "gemini-1.5-flash"
AI_TEMPERATURE="0.7"
AI_MAX_TOKENS="2000"
AI_ENABLE_CACHING="true"
AI_CACHE_EXPIRY="300000"
```

### AI-Enhanced API Endpoints

#### Ticket Creation with AI
```bash
POST /api/tickets
{
  "summary": "I need 500 gallons of sulfuric acid urgently",
  "customerEmail": "customer@example.com",
  "enableAI": true  # Enable AI classification and entity extraction
}
```

#### Transcript Summarization
```bash
POST /api/transcripts/{callId}/summarize
# Generates summary, key points, action items, and sentiment analysis
```

#### Response Suggestions
```bash
POST /api/tickets/{id}/suggest-responses
{
  "maxResponses": 3,
  "includeHistory": true
}
```

#### AI Testing
```bash
# Test all AI operations
GET /api/ai/test

# Test specific operation
POST /api/ai/test
{
  "operation": "classify",  # or "route", "sentiment", "extract"
  "input": "Customer message text"
}
```

#### AI Metrics
```bash
GET /api/ai/operations?operation=classify&limit=100
# Returns AI operation history and statistics
```

### Database Schema

The system tracks all AI operations in dedicated tables:
- `tickets` - Enhanced with AI classification, sentiment, and extracted entities
- `ai_operations` - Audit log of all AI operations with performance metrics
- `suggested_responses` - Stores AI-generated response templates
- `transcripts` - Enhanced with AI summaries and sentiment

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
