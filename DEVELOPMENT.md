# OpenWay Development Guide

This guide walks through developing, testing, and debugging OpenWay locally.

---

## Prerequisites

- **Node.js**: v18.17+ or v20+ / v22+
- **npm**: v9+
- Optional: Ring Developer Account with access to the [Ring Developer Portal](https://developer.ring.com)

---

## Quickstart

```bash
# 1. Clone repository
git clone https://github.com/subodhkant7/openway.git
cd openway

# 2. Install dependencies
npm install

# 3. Create local environment configuration
cp .env.example .env.local

# 4. Start local development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the Operator Dashboard.

---

## Available Scripts

| Script | Purpose | Command |
| :--- | :--- | :--- |
| `npm run dev` | Starts Next.js development server on port 3000 | `next dev` |
| `npm run build` | Builds optimized production bundle | `next build` |
| `npm run start` | Runs production server | `next start` |
| `npm run test` | Executes Vitest test suite | `vitest run` |
| `npm run test:watch` | Runs tests in interactive watch mode | `vitest` |
| `npm run typecheck` | Performs strict TypeScript type analysis | `tsc --noEmit` |
| `npm run lint` | Runs Next.js ESLint checks | `next lint` |

---

## Working with the Ring Developer Playground

To connect OpenWay to live Ring devices via the Amazon Vision API:

1. Navigate to the [Ring Developer Portal](https://developer.ring.com) and sign in.
2. Go to **Developer Playground**.
3. Generate a temporary Access Token (valid for ~30–60 minutes in the Playground environment).
4. Edit your `.env.local`:
   ```env
   OPENWAY_PROVIDER=playground
   RING_ACCESS_TOKEN=your_token_here
   RING_API_BASE_URL=https://api.amazonvision.com
   RING_OAUTH_BASE_URL=https://oauth.ring.com
   ```
5. Restart your dev server or click the **"Playground"** button in the dashboard's mode switcher.
6. Click **"Verify"** to test live device discovery.

---

## Working with the Local Deterministic Simulator

OpenWay includes a complete in-memory simulator that requires no internet connection or external credentials.

Set in `.env.local`:
```env
OPENWAY_PROVIDER=simulator
```

In the dashboard, the **Deterministic Simulator Workbench** enables:
- Triggering simulated motion notifications.
- Simulating a delivery package obstructing an accessible ramp.
- Verifying accessibility restoration with fresh synthetic camera snapshot evidence.
- Simulating device disconnects, battery drops, and camera offline states.

---

## Working with DynamoDB Storage

By default, OpenWay uses the deterministic in-memory store (`OPENWAY_STORAGE=memory`) for local development and unit tests.

To run against Amazon DynamoDB (or DynamoDB Local):

1. Set environment variables in `.env.local`:
   ```env
   OPENWAY_STORAGE=dynamo
   DYNAMODB_TABLE_NAME=OpenWayAssurance-dev
   AWS_REGION=us-east-1
   # Optional: local endpoint if using DynamoDB Local
   DYNAMODB_ENDPOINT=http://localhost:8000
   ```
2. Ensure the DynamoDB table exists with primary key schema (`PK: String`, `SK: String`) and Global Secondary Index `GSI1` (`GSI1PK: String`, `GSI1SK: String`). See [docs/deployment.md](docs/deployment.md) for AWS CLI table creation commands.
3. OpenWay will automatically bootstrap the demo tenant (`venue_maple_cafe`, `entrance_side_accessible`) on server initialization.

---

## Testing Guidelines

OpenWay maintains a comprehensive automated test suite in `src/test/`:
- `ringClient.test.ts`: Client timeouts, rate limits (429), authentication errors (401), and retries.
- `ringProvider.test.ts`: Provider state normalization and domain assurance rules.
- `webhook.test.ts`: HMAC signature verification, malformed payload rejections, and idempotency caching.
- `api.test.ts`: Next.js App Router API endpoints.
- `ui.test.tsx`: Component rendering, WCAG accessibility roles, and loading/empty states.
- `deployedDemoContract.test.ts`: Phase 6 judge demo lifecycle, state persistence, failure paths, and tenant boundary.
- `dynamoPersistence.test.ts`: Single-table schema validation, optimistic concurrency retries, and AES-256-GCM token encryption.
- `securityPhase6.test.ts`: Rate limiting, tenant mutation isolation, and SSRF domain protection.

Run tests at any time with:
```bash
npm run test
```

---

## Deploying to AWS Amplify Hosting

OpenWay is configured for AWS Amplify Hosting using Next.js 14 SSR:
1. Connect the GitHub repository `subodhkant7/openway` in the AWS Amplify Console.
2. Ensure Amplify uses the root `amplify.yml` build specification.
3. Configure environment variables in the Amplify Console (`OPENWAY_STORAGE=dynamo`, `DYNAMODB_TABLE_NAME`, `AWS_REGION`, `BEDROCK_MODEL_ID`).
4. Follow the step-by-step instructions in [docs/deployment.md](docs/deployment.md).

