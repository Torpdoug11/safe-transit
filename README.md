# Safe Transit Backend API

A Node.js + Express backend API for managing deposit transactions with status tracking.

## Features

- Create deposits with amount, requirements, and time limits
- Track deposit status (created, pending_payment, active, fulfilled, expired, cancelled)
- Update deposit status
- Automatic expiration handling
- Input validation and error handling
- **Stripe payment integration with holds**
- **Webhook handling for payment events**

## Installation

1. Install Node.js (v25.2.1 or higher)
2. Clone or download this project
3. Install dependencies:
   ```bash
   npm install
   ```

4. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your Stripe API keys:
   ```env
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
   STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   ```

## Usage

### Development mode
```bash
npm run dev
```

### Production mode
```bash
npm start
```

The server will start on `http://localhost:3000` by default.

## API Endpoints

### Base URL
`http://localhost:3000`

### Endpoints

#### Health Check
- `GET /health` - Server health status

#### Deposits
- `POST /deposit` - Create a new deposit
- `GET /deposit` - Get all deposits (for testing)
- `GET /deposit/:id` - Get deposit by ID
- `PUT /deposit/:id/fulfill` - Mark requirement fulfilled

#### Payments
- `POST /payment/create-checkout-session` - Create Stripe checkout session
- `POST /payment/capture-payment` - Capture payment (when fulfilled)
- `POST /payment/release-payment` - Release payment hold (when expired)

#### Webhooks
- `POST /webhooks/stripe` - Handle Stripe webhook events

## Deposit Schema

```json
{
  "id": "string (UUID, auto-generated)",
  "amount": "decimal (positive number)",
  "requirement": "text",
  "time_limit": "timestamp (ISO 8601 format)",
  "creator_id": "string (UUID)",
  "receiver_id": "string (UUID)",
  "status": "enum (created, pending_payment, active, fulfilled, expired, cancelled)",
  "payment_status": "enum (pending, processing, completed, failed, cancelled, captured)",
  "stripe_payment_intent_id": "string (Stripe payment intent ID)",
  "stripe_checkout_session_id": "string (Stripe checkout session ID)",
  "created_at": "timestamp (auto-generated)",
  "updated_at": "timestamp (auto-updated)"
}
```

## API Usage Examples

### Create a Deposit
```bash
POST /deposit
Content-Type: application/json

{
  "amount": 100.50,
  "requirement": "Deliver package to location A",
  "time_limit": "2024-12-31T23:59:59.000Z",
  "creator_id": "550e8400-e29b-41d4-a716-446655440000",
  "receiver_id": "550e8400-e29b-41d4-a716-446655440001"
}
```

### Create Stripe Checkout Session
```bash
POST /payment/create-checkout-session
Content-Type: application/json

{
  "deposit_id": "deposit-uuid-here",
  "success_url": "https://your-app.com/success",
  "cancel_url": "https://your-app.com/cancel"
}
```

### Check Deposit Status
```bash
GET /deposit/:id
```

### Fulfill Deposit (Capture Payment)
```bash
PUT /deposit/:id/fulfill
```

## Payment Flow

1. **Create Deposit** - POST /deposit
2. **Create Checkout Session** - POST /payment/create-checkout-session
3. **User Pays** - User completes Stripe checkout
4. **Webhook Updates** - Stripe webhook updates deposit to 'active' status
5. **Fulfill Requirement** - PUT /deposit/:id/fulfill
6. **Capture Payment** - POST /payment/capture-payment (releases funds to receiver)
7. **Or Release Hold** - POST /payment/release-payment (if deposit expires)

## Status Values

### Deposit Status
- `created` - Initial state when deposit is created
- `pending_payment` - Payment initiated, waiting for completion
- `active` - Payment completed, deposit is active
- `fulfilled` - Deposit requirements have been met
- `expired` - Deposit time limit has passed
- `cancelled` - Deposit was cancelled

### Payment Status
- `pending` - Payment not yet initiated
- `processing` - Payment in progress
- `completed` - Payment successfully held
- `captured` - Payment captured (funds transferred)
- `failed` - Payment failed
- `cancelled` - Payment cancelled

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- `400` - Bad Request (validation errors, invalid input)
- `404` - Not Found (deposit doesn't exist)
- `500` - Internal Server Error

## Stripe Setup

1. Create a Stripe account and get API keys
2. Set up webhook endpoints in Stripe Dashboard:
   - `checkout.session.completed`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `payment_intent.succeeded`
3. Configure webhook endpoint: `https://your-domain.com/webhooks/stripe`
4. Add webhook secret to your `.env` file

## Dependencies

- `express` - Web framework
- `uuid` - UUID generation
- `validator` - Input validation
- `stripe` - Payment processing
- `dotenv` - Environment variable management
- `nodemon` - Development auto-restart (dev dependency)

## Notes

- Currently uses in-memory storage (Map) for deposits
- In production, replace with a proper database (MongoDB, PostgreSQL, etc.)
- Includes CORS middleware for development
- Automatic status updates for expired deposits
