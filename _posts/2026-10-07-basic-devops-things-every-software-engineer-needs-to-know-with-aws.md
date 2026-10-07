---
title: "Basic DevOps Every Software Engineer Needs to Know, Explained with AWS"
category: Engineering
excerpt: >-
  "It works on my machine" is no longer enough. Learn the DevOps basics every
  developer needs today (CI/CD, infrastructure as code, secrets, IAM,
  scaling, monitoring and backups) mapped to AWS services, with real failure
  stories, diagrams and code you can copy. An 11-minute read.
---

On 28 February 2017, an engineer at Amazon ran a routine command to remove a few servers from a billing system. One input was typed wrong, far more servers were removed than intended, and a large part of the internet that relied on S3 in the `us-east-1` region went down for hours. AWS later described the cause in its public post-event summary and added safeguards so the same command could not remove that much capacity so quickly.

The lesson is not "engineers make typos". The lesson is that **systems must be built so a single mistake cannot become a disaster**. That is what DevOps is about, and in 2026 every software engineer is expected to understand the basics, not only the "ops person".

In this note you will learn:

- what DevOps really means, in one picture,
- seven basics (CI/CD, infrastructure as code, secrets, IAM, scaling, monitoring, backups),
- the AWS service behind each one,
- real failure scenarios and the code or config that prevents them.

Reading time: about 11 minutes.

---

## What DevOps really means

DevOps is not a job title or a tool. It is a way of working where the people who **build** software also take part in **running** it, supported by automation. The goal: ship small changes often, safely, and know quickly when something breaks.

<figure>
<svg viewBox="0 0 680 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="DevOps flow on AWS: code in Git, build and test in CodeBuild, image stored in ECR, deploy with CodeDeploy or ECS, run on Fargate, observe with CloudWatch, with feedback arrow back to code. Below it, CloudFormation describes everything and IAM controls every step.">
  <defs>
    <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0L10 5L0 10z" fill="#64748b"/>
    </marker>
  </defs>
  <style>
    .t{font:700 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:11px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
    .b{font:700 12px -apple-system,Segoe UI,Roboto,sans-serif;fill:#475569;}
  </style>
  <rect x="1" y="20" width="98" height="80" rx="10" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="t" x="12" y="46">1. Code</text>
  <text class="d" x="12" y="64">Git + pull</text>
  <text class="d" x="12" y="79">requests</text>

  <rect x="117" y="20" width="98" height="80" rx="10" fill="#fef3c7" stroke="#fcd34d"/>
  <text class="t" x="128" y="46">2. Build</text>
  <text class="d" x="128" y="64">CodeBuild:</text>
  <text class="d" x="128" y="79">lint + tests</text>

  <rect x="233" y="20" width="98" height="80" rx="10" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="t" x="244" y="46">3. Package</text>
  <text class="d" x="244" y="64">Docker image</text>
  <text class="d" x="244" y="79">in ECR</text>

  <rect x="349" y="20" width="98" height="80" rx="10" fill="#faf5ff" stroke="#e9d5ff"/>
  <text class="t" x="360" y="46">4. Deploy</text>
  <text class="d" x="360" y="64">CodeDeploy /</text>
  <text class="d" x="360" y="79">ECS rollout</text>

  <rect x="465" y="20" width="98" height="80" rx="10" fill="#ecfeff" stroke="#a5f3fc"/>
  <text class="t" x="476" y="46">5. Run</text>
  <text class="d" x="476" y="64">ECS Fargate</text>
  <text class="d" x="476" y="79">or Lambda</text>

  <rect x="581" y="20" width="98" height="80" rx="10" fill="#fff1f2" stroke="#fecdd3"/>
  <text class="t" x="592" y="46">6. Observe</text>
  <text class="d" x="592" y="64">CloudWatch</text>
  <text class="d" x="592" y="79">logs + alarms</text>

  <line x1="99" y1="60" x2="115" y2="60" stroke="#64748b" stroke-width="1.8" marker-end="url(#ar)"/>
  <line x1="215" y1="60" x2="231" y2="60" stroke="#64748b" stroke-width="1.8" marker-end="url(#ar)"/>
  <line x1="331" y1="60" x2="347" y2="60" stroke="#64748b" stroke-width="1.8" marker-end="url(#ar)"/>
  <line x1="447" y1="60" x2="463" y2="60" stroke="#64748b" stroke-width="1.8" marker-end="url(#ar)"/>
  <line x1="563" y1="60" x2="579" y2="60" stroke="#64748b" stroke-width="1.8" marker-end="url(#ar)"/>

  <path d="M630 100 L630 124 L50 124 L50 102" fill="none" stroke="#64748b" stroke-width="1.8" stroke-dasharray="5 4" marker-end="url(#ar)"/>
  <text class="d" x="340" y="118" text-anchor="middle">feedback: what we learn in production shapes the next change</text>

  <rect x="1" y="146" width="678" height="40" rx="8" fill="#f8fafc" stroke="#cbd5e1"/>
  <text class="b" x="340" y="171" text-anchor="middle">Infrastructure as code (CloudFormation / CDK / Terraform) describes all of the above</text>

  <rect x="1" y="198" width="678" height="40" rx="8" fill="#f8fafc" stroke="#cbd5e1"/>
  <text class="b" x="340" y="223" text-anchor="middle">IAM roles + Secrets Manager: every arrow above has narrow permissions</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">The whole DevOps loop on AWS. The rest of this note walks through it, one box at a time.</figcaption>
</figure>

One more idea before we start: the **shared responsibility model**. AWS secures the data centres, hardware and core services. **You** are responsible for what you build on top: your code, your permissions, your configuration and your data. Almost every story below is a failure on the "you" side.

---

## 1. CI/CD: never deploy by hand

**Continuous Integration (CI)** means every change is automatically built and tested. **Continuous Delivery (CD)** means passing builds are deployed through the same repeatable steps every time. On AWS: **CodePipeline** orchestrates, **CodeBuild** builds and tests, **CodeDeploy** or **ECS** rolls out. (GitHub Actions works just as well and can deploy to AWS using an IAM role.)

**Failure scenario.** In 2012 the trading firm Knight Capital deployed new software by copying it to its servers by hand. By most public accounts it reached seven of eight servers, and old, dormant code on the eighth started trading wildly. The firm reportedly lost about $440 million in under an hour. A repeatable pipeline that verifies every server, with a quick rollback, is the cure for "someone forgot one server".

A minimal CodeBuild file that tests, builds and pushes an image:

```yaml
# buildspec.yml
version: 0.2
phases:
  install:
    runtime-versions:
      nodejs: 20
  pre_build:
    commands:
      - npm ci
      - npm run lint
      - npm test                     # a failing test stops the pipeline here
      - aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI
  build:
    commands:
      # tag with the commit id, never "latest", so you know exactly what runs
      - docker build -t $ECR_URI:$CODEBUILD_RESOLVED_SOURCE_VERSION .
      - docker push $ECR_URI:$CODEBUILD_RESOLVED_SOURCE_VERSION
```

Two habits matter more than the tool: **tag images with the commit**, and **have a rollback plan** (redeploy the previous tag). More on safe rollouts in section 5.

---

## 2. Infrastructure as Code: no click-ops

If your servers, buckets and databases were created by clicking in the console, nobody can review them, repeat them, or recreate them after a disaster. **Infrastructure as Code (IaC)** puts them in files, in Git, reviewed like application code. On AWS the native tool is **CloudFormation** (with **CDK** to write it in a real language); **Terraform** is the popular alternative.

**Failure scenario (very common).** A developer fixes a production problem by editing a security group in the console at 2 AM. It works. Weeks later the stack is redeployed from code, the manual fix disappears, and the same outage returns. The difference between what the code says and what is really running is called **drift**.

```yaml
# template.yaml: a safe S3 bucket, defined once, reviewed in a pull request
Resources:
  UploadsBucket:
    Type: AWS::S3::Bucket
    Properties:
      VersioningConfiguration:
        Status: Enabled              # recover from accidental deletes
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
      PublicAccessBlockConfiguration: # one setting prevents the classic "public bucket" leak
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
```

Rule of thumb: **if it is not in code, it does not exist.** Use CloudFormation's drift detection to catch manual changes.

---

## 3. Secrets and config: keep them out of Git

Code is the same in every environment. Config (database host, feature settings) and secrets (passwords, API keys) change per environment and must live **outside** the code. On AWS use **SSM Parameter Store** for plain config and **Secrets Manager** for secrets (with automatic rotation).

**Failure scenario.** A developer commits an AWS access key to a public GitHub repository "just for testing". Automated scanners look for exactly this and can find keys quickly, and attackers use them to launch expensive compute for crypto-mining. The bill arrives at the end of the month. (AWS also scans public repos and may quarantine exposed keys, but do not rely on that.)

```js
// Read the secret at runtime. Nothing sensitive is stored in the repo or the image.
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({ region: "us-east-1" });

export async function getDbPassword() {
  const res = await client.send(
    new GetSecretValueCommand({ SecretId: "prod/app/db" })
  );
  return JSON.parse(res.SecretString).password;
}
```

Notice there are **no AWS keys in this code**. When it runs on ECS or Lambda, the SDK automatically uses the **IAM role** of the service. That brings us to the most important topic.

---

## 4. IAM: give the least power possible

**IAM (Identity and Access Management)** decides who can do what. The principle of **least privilege** means each user or service gets only the permissions it needs, nothing more.

**Failure scenario.** In the 2019 Capital One breach, an attacker exploited a misconfigured web application firewall to make the server request its own **instance metadata**, which returned temporary credentials for the server's IAM role. That role could read far more S3 data than the app ever needed, and data on about 100 million people in the US was copied. The first mistake opened the door; the over-broad role decided how much was behind it.

```json
// BAD: the app can do anything to everything
{
  "Effect": "Allow",
  "Action": "s3:*",
  "Resource": "*"
}
```

```json
// GOOD: only two actions, only one bucket
{
  "Effect": "Allow",
  "Action": ["s3:GetObject", "s3:PutObject"],
  "Resource": "arn:aws:s3:::my-app-uploads/*"
}
```

Quick IAM habits:

- Use **roles**, not long-lived access keys, for services and CI.
- Turn on **MFA** for humans and never use the root account for daily work.
- Require **IMDSv2** on EC2 (it blocks the simple metadata attack above).
- Start narrow, and let **IAM Access Analyzer** show you what is unused.

---

## 5. Scaling and availability: assume things fail

Servers crash, disks fill up, a whole data centre can lose power. AWS Regions are split into **Availability Zones (AZs)**, which are separate data centres. Spread your app across at least two, so losing one is boring, not an incident.

<figure>
<svg viewBox="0 0 680 330" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Users reach an Application Load Balancer, which sends traffic to app containers running in two Availability Zones. Each zone has a database: a primary in zone A and a standby in zone B, kept in sync by replication.">
  <defs>
    <marker id="ar2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0L10 5L0 10z" fill="#64748b"/>
    </marker>
  </defs>
  <style>
    .t{font:700 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:11px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <rect x="270" y="4" width="140" height="30" rx="15" fill="#f1f5f9" stroke="#cbd5e1"/>
  <text class="t" x="340" y="24" text-anchor="middle">Users</text>
  <line x1="340" y1="34" x2="340" y2="52" stroke="#64748b" stroke-width="1.8" marker-end="url(#ar2)"/>

  <rect x="200" y="54" width="280" height="38" rx="10" fill="#fef3c7" stroke="#fcd34d"/>
  <text class="t" x="340" y="72" text-anchor="middle">Application Load Balancer</text>
  <text class="d" x="340" y="86" text-anchor="middle">health checks hide unhealthy targets</text>

  <rect x="5" y="112" width="670" height="212" rx="12" fill="none" stroke="#94a3b8" stroke-dasharray="6 4"/>
  <text class="d" x="16" y="130">AWS Region</text>

  <rect x="25" y="140" width="300" height="170" rx="10" fill="#f8fafc" stroke="#cbd5e1"/>
  <text class="t" x="40" y="160">Availability Zone A</text>
  <rect x="355" y="140" width="300" height="170" rx="10" fill="#f8fafc" stroke="#cbd5e1"/>
  <text class="t" x="370" y="160">Availability Zone B</text>

  <rect x="45" y="172" width="260" height="46" rx="8" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="t" x="175" y="193" text-anchor="middle">App containers (ECS Fargate)</text>
  <text class="d" x="175" y="208" text-anchor="middle">Auto Scaling adds or removes tasks</text>

  <rect x="375" y="172" width="260" height="46" rx="8" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="t" x="505" y="193" text-anchor="middle">App containers (ECS Fargate)</text>
  <text class="d" x="505" y="208" text-anchor="middle">Auto Scaling adds or removes tasks</text>

  <rect x="45" y="246" width="260" height="46" rx="8" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="t" x="175" y="267" text-anchor="middle">RDS database: primary</text>
  <text class="d" x="175" y="282" text-anchor="middle">reads and writes</text>

  <rect x="375" y="246" width="260" height="46" rx="8" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="t" x="505" y="267" text-anchor="middle">RDS database: standby</text>
  <text class="d" x="505" y="282" text-anchor="middle">takes over automatically</text>

  <path d="M270 92 L270 120 L175 120 L175 170" fill="none" stroke="#64748b" stroke-width="1.8" marker-end="url(#ar2)"/>
  <path d="M410 92 L410 120 L505 120 L505 170" fill="none" stroke="#64748b" stroke-width="1.8" marker-end="url(#ar2)"/>
  <line x1="175" y1="218" x2="175" y2="244" stroke="#64748b" stroke-width="1.8" marker-end="url(#ar2)"/>
  <line x1="305" y1="269" x2="373" y2="269" stroke="#16a34a" stroke-width="1.8" marker-end="url(#ar2)" marker-start="url(#ar2)"/>
  <text class="d" x="340" y="262" text-anchor="middle">sync</text>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">A basic highly available setup. Lose one zone and the other keeps serving.</figcaption>
</figure>

The building blocks:

- **Load balancer (ALB)** spreads traffic and stops sending it to unhealthy servers.
- **Auto Scaling** adds capacity when traffic rises and replaces broken instances.
- **RDS Multi-AZ** keeps a standby database in another zone and fails over automatically.

Your app must cooperate. Give the load balancer an honest health endpoint:

```js
// Liveness: "is the process up?" Readiness: "can it actually serve traffic?"
app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");      // can we reach the database?
    res.status(200).json({ status: "ok" });
  } catch (err) {
    res.status(503).json({ status: "db-unreachable" }); // ALB stops routing here
  }
});
```

And make rollouts safe. This ECS setting stops a bad release and rolls back on its own:

```yaml
# CloudFormation: AWS::ECS::Service
DeploymentConfiguration:
  MinimumHealthyPercent: 100        # keep full capacity during the rollout
  MaximumPercent: 200               # start new tasks before stopping old ones
  DeploymentCircuitBreaker:
    Enable: true
    Rollback: true                  # new tasks keep failing? go back automatically
```

**Failure scenario.** Back to the 2017 S3 outage: many applications worked in one region only, so when that region's S3 had trouble they went down with it. Multi-AZ protects you from a data centre failing. For truly critical systems, think about **multi-region** too, and about **what your app does when a dependency is down** (timeouts, retries, graceful errors).

---

## 6. Monitoring and alerting: know before your users do

You cannot fix what you cannot see. On AWS, **CloudWatch** gives you three things: **logs** (what happened), **metrics** (numbers over time such as CPU, 5xx errors, latency) and **alarms** (tell a human when a number looks wrong). **X-Ray** adds traces to follow one request across services.

<figure>
<svg viewBox="0 0 680 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Alerting flow: the app emits logs and metrics, CloudWatch evaluates an alarm, SNS sends a notification, and the on-call engineer responds.">
  <defs>
    <marker id="ar3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0L10 5L0 10z" fill="#64748b"/>
    </marker>
  </defs>
  <style>
    .t{font:700 12.5px -apple-system,Segoe UI,Roboto,sans-serif;fill:#0f172a;}
    .d{font:11px -apple-system,Segoe UI,Roboto,sans-serif;fill:#64748b;}
  </style>
  <rect x="1" y="20" width="110" height="70" rx="10" fill="#eff6ff" stroke="#bfdbfe"/>
  <text class="t" x="56" y="50" text-anchor="middle">Your app</text>
  <text class="d" x="56" y="68" text-anchor="middle">JSON logs, metrics</text>

  <rect x="141" y="20" width="110" height="70" rx="10" fill="#fef3c7" stroke="#fcd34d"/>
  <text class="t" x="196" y="50" text-anchor="middle">CloudWatch</text>
  <text class="d" x="196" y="68" text-anchor="middle">stores + graphs</text>

  <rect x="281" y="20" width="110" height="70" rx="10" fill="#fff1f2" stroke="#fecdd3"/>
  <text class="t" x="336" y="50" text-anchor="middle">Alarm</text>
  <text class="d" x="336" y="68" text-anchor="middle">5xx &gt; 10 for 3 min</text>

  <rect x="421" y="20" width="110" height="70" rx="10" fill="#f0fdf4" stroke="#bbf7d0"/>
  <text class="t" x="476" y="50" text-anchor="middle">SNS</text>
  <text class="d" x="476" y="68" text-anchor="middle">email, Slack, pager</text>

  <rect x="561" y="20" width="118" height="70" rx="10" fill="#faf5ff" stroke="#e9d5ff"/>
  <text class="t" x="620" y="50" text-anchor="middle">You, on call</text>
  <text class="d" x="620" y="68" text-anchor="middle">read runbook, fix</text>

  <line x1="111" y1="55" x2="139" y2="55" stroke="#64748b" stroke-width="1.8" marker-end="url(#ar3)"/>
  <line x1="251" y1="55" x2="279" y2="55" stroke="#64748b" stroke-width="1.8" marker-end="url(#ar3)"/>
  <line x1="391" y1="55" x2="419" y2="55" stroke="#64748b" stroke-width="1.8" marker-end="url(#ar3)"/>
  <line x1="531" y1="55" x2="559" y2="55" stroke="#64748b" stroke-width="1.8" marker-end="url(#ar3)"/>
</svg>
<figcaption style="font-size:1.25rem;color:#64748b;margin-top:8px;">From a failing request to a human who can act, without anyone staring at a dashboard.</figcaption>
</figure>

Write logs that a machine can search. One JSON object per line beats a sentence:

```js
// Searchable in CloudWatch Logs Insights: filter by orderId, sort by durationMs
console.log(JSON.stringify({
  level: "error",
  message: "payment failed",
  orderId: order.id,
  durationMs: Date.now() - start,
  requestId: req.headers["x-amzn-trace-id"], // follow one request end to end
}));
```

Then create an alarm so you hear about it first:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name api-5xx-high \
  --namespace AWS/ApplicationELB \
  --metric-name HTTPCode_Target_5XX_Count \
  --dimensions Name=LoadBalancer,Value=app/my-alb/50dc6c495c0c9188 \
  --statistic Sum --period 60 --evaluation-periods 3 \
  --threshold 10 --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:oncall
```

**Failure scenario (very common).** A log file or database disk slowly fills up. Nobody has an alarm on disk space. On a Friday evening the service stops writing and falls over, and the first report is an angry customer email. A single alarm on "disk above 80%" turns that into a calm Tuesday task.

Alert on **symptoms users feel** (errors, latency) rather than every CPU blip, or people will start ignoring the pager.

---

## 7. Backups and recovery: test the restore

Two numbers decide your recovery plan. **RPO** (recovery point objective): how much data can you afford to lose? **RTO** (recovery time objective): how long can you afford to be down?

AWS gives you the tools: **RDS automated backups** with point-in-time restore, **S3 versioning** (shown in the template above), and **AWS Backup** to manage it all in one place.

**Failure scenario.** A bad migration deletes a column of customer data. The team is sure it has backups. Nobody ever tried restoring one, and the restore takes far longer than anyone expected. A backup you have never restored is only a hope.

Schedule a **restore drill** every few months: restore into a temporary database, check the data, and time it.

---

## Quick map: concept to AWS service

| Concept | Why it matters | AWS service |
|---|---|---|
| CI/CD | Repeatable, safe releases | CodePipeline, CodeBuild, CodeDeploy |
| Infrastructure as code | Reviewable, rebuildable setup | CloudFormation, CDK |
| Secrets and config | Nothing sensitive in Git | Secrets Manager, SSM Parameter Store |
| Access control | Limit the damage of any mistake | IAM, Access Analyzer |
| Scaling and availability | Survive failures and traffic spikes | ALB, Auto Scaling, Multi-AZ RDS |
| Monitoring | Know before users do | CloudWatch, X-Ray, SNS |
| Backup and recovery | Survive data loss | AWS Backup, RDS snapshots, S3 versioning |

---

## Your first-week checklist

- Every deploy goes through a pipeline; images are tagged with the commit.
- Infrastructure lives in Git (CloudFormation, CDK or Terraform).
- No secrets in code, `.env` files in Git, or container images.
- Each service has its own IAM role with only the permissions it needs.
- MFA is on for every human, and the root account is locked away.
- The app runs in at least two Availability Zones with a real health check.
- Logs are structured, and an alarm exists for 5xx errors and disk space.
- Backups are on, and you have restored one at least once.
- A budget alert is set (AWS Budgets), so a forgotten resource cannot surprise you.

---

## Key takeaways

- **DevOps is a habit, not a tool.** Build, ship and run in small, automated, repeatable steps.
- **Automate deploys** and keep a rollback ready; manual steps are where outages like Knight Capital's start.
- **Put infrastructure in code** so it can be reviewed and rebuilt, and watch for drift.
- **Keep secrets out of Git**, and give every service **least-privilege IAM** so one mistake stays small.
- **Assume failure:** use multiple Availability Zones, health checks and automatic rollbacks.
- **Monitor symptoms, alert a human, and test your restores.**

You do not need to learn all of AWS. Pick one project this week, run through the checklist above, and fix the first gap you find. One safe step at a time is how real DevOps starts.
