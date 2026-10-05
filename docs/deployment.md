# OpenWay — AWS Production Deployment Guide

This guide details how to deploy OpenWay as a durable, cloud-hosted application using **AWS Amplify Hosting**, **Amazon DynamoDB**, and **Amazon Bedrock**.

---

## 1. Prerequisites

- **AWS Account**: Active AWS account with permissions for AWS Amplify, Amazon DynamoDB, and Amazon Bedrock.
- **GitHub Repository**: Fork or push access to [https://github.com/subodhkant7/openway.git](https://github.com/subodhkant7/openway.git).
- **Node.js**: Node.js 18.17+ or Node 20.
- **Bedrock Model Access**: Access granted to `amazon.nova-lite-v1:0` (or `anthropic.claude-3-5-sonnet-20241022-v2:0`) in your selected AWS region (e.g., `us-east-1` or `us-west-2`).

---

## 2. Architecture Overview

```text
Judge / Operator Browser
          │ (HTTPS)
          ▼
   AWS Amplify Hosting (Next.js 14 SSR)
          │
          ├──> Amazon DynamoDB (Single-Table Persistence)
          │       - Table: OpenWayTable
          │       - GSI1: GSI1PK / GSI1SK
          │       - Idempotency & Concurrency Locks
          │
          ├──> Amazon Bedrock Runtime (Multimodal Vision)
          │       - Model: amazon.nova-lite-v1:0
          │       - Ephemeral in-memory image analysis
          │
          └──> Amazon Ring Infrastructure
                  - Partner API / Developer Playground
                  - Webhooks v1.1 HMAC Verification
```

---

## 3. Step 1: Provision Amazon DynamoDB Table

Create the single-table DynamoDB resource via AWS Management Console or AWS CLI:

```bash
aws dynamodb create-table \
    --table-name OpenWayTable \
    --attribute-definitions \
        AttributeName=PK,AttributeType=S \
        AttributeName=SK,AttributeType=S \
        AttributeName=GSI1PK,AttributeType=S \
        AttributeName=GSI1SK,AttributeType=S \
    --key-schema \
        AttributeName=PK,KeyType=HASH \
        AttributeName=SK,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --global-secondary-indexes \
        "[
            {
                \"IndexName\": \"GSI1\",
                \"KeySchema\": [
                    {\"AttributeName\":\"GSI1PK\",\"KeyType\":\"HASH\"},
                    {\"AttributeName\":\"GSI1SK\",\"KeyType\":\"RANGE\"}
                ],
                \"Projection\": {\"ProjectionType\":\"ALL\"}
            }
        ]" \
    --region us-east-1
```

Enable Time to Live (TTL) on the `expiresAt` attribute:

```bash
aws dynamodb update-time-to-live \
    --table-name OpenWayTable \
    --time-to-live-specification "Enabled=true, AttributeName=expiresAt" \
    --region us-east-1
```

---

## 4. Step 2: Least-Privilege IAM Policy

Attach the following least-privilege policy to the AWS Amplify Service Role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "OpenWayDynamoAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:TransactWriteItems"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/OpenWayTable",
        "arn:aws:dynamodb:*:*:table/OpenWayTable/index/*"
      ]
    },
    {
      "Sid": "OpenWayBedrockVisionAccess",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/amazon.nova-lite-v1:0",
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0"
      ]
    }
  ]
}
```

---

## 5. Step 3: Deploy to AWS Amplify Hosting

1. Open the [AWS Amplify Console](https://console.aws.amazon.com/amplify).
2. Choose **Deploy an app** &rarr; **Host web app**.
3. Select **GitHub** as the source repository and authorize AWS Amplify.
4. Select repository: `subodhkant7/openway`, branch: `main`.
5. In **App settings**, verify that `amplify.yml` is automatically detected from the repository root.
6. Under **Advanced settings &rarr; Environment variables**, configure:

| Variable | Recommended Value | Purpose |
| :--- | :--- | :--- |
| `OPENWAY_ENV` | `production` | Declares production environment mode. |
| `OPENWAY_STORAGE` | `dynamo` | Enables durable DynamoDB single-table persistence. |
| `DYNAMODB_TABLE_NAME` | `OpenWayTable` | Name of the provisioned DynamoDB table. |
| `AWS_REGION` | `us-east-1` | Target AWS region. |
| `BEDROCK_MODEL_ID` | `amazon.nova-lite-v1:0` | Multimodal foundation model for vision analysis. |
| `OPENWAY_PROVIDER` | `simulator` (or `playground`) | Provider mode: simulator for public judging, or playground with token. |
| `RING_ACCESS_TOKEN` | *(Optional for Playground)* | Short-lived Ring Playground Bearer token. |
| `RING_WEBHOOK_SECRET` | *(Optional for Webhooks)* | HMAC-SHA256 signing secret for Ring webhooks. |

7. Click **Save and deploy**. Amplify will build and deploy the Next.js SSR application.

---

## 6. Step 4: Health & Deployment Verification

1. Once the deployment finishes, open:
   ```text
   https://<your-amplify-domain>.amplifyapp.com/api/health
   ```
2. Confirm the JSON payload returns:
   - `status: "APPLICATION_HEALTHY"`
   - `components.database.status: "CONNECTED"`
   - `components.database.storageType: "dynamodb"`
   - `components.bedrock.status: "CONFIGURED"`
3. Open the root URL:
   ```text
   https://<your-amplify-domain>.amplifyapp.com
   ```
4. Verify the dashboard loads with **Maple Street Cafe** and **Side Accessible Entrance** in `AVAILABLE` state.
5. Execute the canonical demo sequence via the **Phase 6 Judge Demo & Assurance Workbench**.
6. Refresh the browser; confirm that state changes persist durably across reloads.

---

## 7. Step 5: Demo Reset

If you need to reset the public demo tenant to its baseline state:
- Click **"Reset Demo Narrative"** in the operator dashboard workbench, or
- Issue an authenticated POST request:
  ```bash
  curl -X POST https://<your-amplify-domain>.amplifyapp.com/api/demo/reset \
       -H "Content-Type: application/json" \
       -d '{"entranceId": "entrance_side_accessible"}'
  ```

---

## 8. Rollback & Troubleshooting

- **Amplify Instant Rollback**: In the AWS Amplify Console under **Hosting &rarr; Deployments**, click any previous successful build and select **Rollback to this version**.
- **DynamoDB Connection Failure**: Check CloudWatch logs for `AccessDeniedException`. Ensure the Amplify Service Role has permission on `OpenWayTable`.
- **Bedrock Model Access**: Ensure model access is requested and active under AWS Bedrock &rarr; Model access for the configured region.
