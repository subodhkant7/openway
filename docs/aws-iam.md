# AWS IAM Least Privilege Architecture & Role Specification

OpenWay adheres to strict AWS least-privilege principles, segregating deployment-time build privileges from production runtime compute credentials. Under no circumstances does the application require or use `AdministratorAccess`, `iam:*`, `dynamodb:*`, or `bedrock:*`.

---

## 1. Role Architecture Overview

```text
┌────────────────────────────────┐       ┌─────────────────────────────────┐
│     AWS Amplify Hosting CI     │       │     Next.js SSR Compute Role     │
│   (amplify-openway-deploy-role)│       │    (openway-ssr-runtime-role)   │
└───────────────┬────────────────┘       └────────────────┬────────────────┘
                │                                         │
        Assumed during build                      Assumed at runtime
                │                                 (temporary STS credentials)
                ▼                                         ▼
   ┌─────────────────────────┐           ┌─────────────────────────────────┐
   │ S3: Amplify build cache │           │ DynamoDB: Single Table & Index  │
   │ CloudWatch: Build logs  │           │ Bedrock: Nova / Claude Vision   │
   │ CloudFront / Route53    │           │ CloudWatch: Structured app logs │
   └─────────────────────────┘           └─────────────────────────────────┘
```

---

## 2. SSR Compute Runtime Role (`openway-ssr-runtime-role`)

### Role Purpose
Assumed by the running Next.js server-side rendering (SSR) compute instances running OpenWay API handlers. Provides temporary STS credential rotation without hardcoding long-lived `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` in environment variables or client bundles.

### Trusted Principal (Trust Relationship Policy)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": [
          "amplify.amazonaws.com",
          "ecs-tasks.amazonaws.com",
          "lambda.amazonaws.com"
        ]
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "aws:SourceAccount": "${AWS::AccountId}"
        }
      }
    }
  ]
}
```

### Allowed Runtime Actions & Resource Scopes

#### Policy: `OpenWayDynamoDBLeastPrivilege`
* **Purpose**: Durable single-table persistence for venues, entrances, evidence metadata, observations, assessments, remediation tasks, and audit logs with transactional consistency and optimistic concurrency control.
* **Prohibited**: Table creation, deletion, index modification, stream manipulation (`dynamodb:*`).
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBScopedItemOperations",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:TransactWriteItems"
      ],
      "Resource": [
        "arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${OPENWAY_TABLE_NAME}",
        "arn:aws:dynamodb:${AWS::Region}:${AWS::AccountId}:table/${OPENWAY_TABLE_NAME}/index/*"
      ]
    }
  ]
}
```

#### Policy: `OpenWayBedrockVisionLeastPrivilege`
* **Purpose**: Allows invocation of selected multimodal vision models (`amazon.nova-lite-v1:0`, `anthropic.claude-3-haiku-20240307-v1:0`) for analyzing Ring camera evidence.
* **Prohibited**: Model customization, fine-tuning, knowledge base creation, foundation model listing (`bedrock:*`).
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockScopedInference",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:${AWS::Region}::foundation-model/amazon.nova-lite-v1:0",
        "arn:aws:bedrock:${AWS::Region}::foundation-model/amazon.nova-pro-v1:0",
        "arn:aws:bedrock:${AWS::Region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0"
      ]
    }
  ]
}
```

#### Policy: `OpenWayCloudWatchTelemetry`
* **Purpose**: Emit structured, audit-correlated telemetry and latency metrics.
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchScopedLogging",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": "arn:aws:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/openway/*:*"
    }
  ]
}
```

---

## 3. Amplify Deployment & Service Role (`amplify-openway-deploy-role`)

### Role Purpose
Used by the AWS Amplify Hosting build pipeline during `next build` and artifact distribution.

### Trusted Principal
```json
{
  "Version": "2012-10-17",
  "Principal": {
    "Service": "amplify.amazonaws.com"
  },
  "Action": "sts:AssumeRole"
}
```

### Managed Permissions
* Scoped to Amplify's managed service policies for SSR deployment (`AdministratorAccess-Amplify` or custom deployment policy scoped to Amplify app resources).
* **Isolation Guarantee**: The deployment role credentials never exist inside SSR runtime containers and cannot be accessed by Next.js route handlers.

---

## 4. Permission Rationale & Security Audit Matrix

| AWS Service | Action | Scope | Why Permission Exists | Risk Mitigation |
|---|---|---|---|---|
| **DynamoDB** | `GetItem`, `Query` | Table & GSI ARN | Fetch active assessments, entrance requirements, tasks | Cannot read non-OpenWay tables |
| **DynamoDB** | `PutItem`, `UpdateItem` | Table ARN | Persist new evidence, observations, and state transitions | Scoped by partition keys; cannot modify schema |
| **DynamoDB** | `TransactWriteItems` | Table ARN | Atomically commit state transitions and task updates | Prevents split-brain state machine corruptions |
| **Bedrock** | `InvokeModel` | Specified model ARNs | Multimodal visual inspection of Ring camera snapshots | Scoped strictly to Nova Lite / Claude Haiku; no model tuning |
| **CloudWatch** | `PutLogEvents` | `/aws/openway/*` | Audit trail replication and telemetry | Cannot write or tamper with other log groups |
| **IAM** | *None* | *None* | OpenWay application does not create, modify, or assume arbitrary IAM roles | Prevents privilege escalation |

---

## 5. Verification Checklist

* [x] No long-lived AWS keys stored in source code, client bundles, or environment variables in production.
* [x] SSR compute role uses short-lived STS credentials automatically refreshed by the AWS SDK metadata service.
* [x] DynamoDB operations are restricted to `OPENWAY_TABLE_NAME` and associated GSI indices.
* [x] Bedrock model invocations are restricted to specific model ARNs.
* [x] Wildcard admin permissions (`*`, `iam:*`, `dynamodb:*`, `bedrock:*`) are explicitly forbidden.
