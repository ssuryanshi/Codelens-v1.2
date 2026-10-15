# Moving CodeLens to a new AWS account

Order matters: backend first (it produces the API URL), then the frontend (which needs that URL).
Run every command with the **new** account's credentials. Never paste keys into a chat or commit them.

## 0. Confirm which account and region you are in

```bash
aws sts get-caller-identity                 # Account must be the NEW one
export AWS_REGION=us-east-1                 # keep it the same as before; Bedrock model availability differs by region
export AWS_DEFAULT_REGION=$AWS_REGION
aws cloudformation describe-stacks --stack-name h2s-backend \
  --query 'Stacks[0].[StackStatus,Outputs]' --output json
```

If that says the stack does not exist, you have no backend yet: go to step 2.
If it says `ROLLBACK_COMPLETE`, delete it first: `aws cloudformation delete-stack --stack-name h2s-backend`, wait, redeploy.

## 1. Check Bedrock works before deploying anything

```bash
aws bedrock-runtime converse --model-id amazon.nova-lite-v1:0 \
  --messages '[{"role":"user","content":[{"text":"say ok"}]}]' \
  --query 'output.message.content[0].text'

aws bedrock-runtime invoke-model --model-id amazon.titan-embed-text-v2:0 \
  --cli-binary-format raw-in-base64-out --body '{"inputText":"hello"}' /tmp/emb.json && head -c 120 /tmp/emb.json
```

`AccessDeniedException` means the model is not enabled for this account/region (Bedrock console > Model access) or
your IAM user lacks `bedrock:InvokeModel`. Fix this first; ingestion and chat both depend on it.

## 2. Deploy the backend

```bash
cd infrastructure
sam validate --lint
sam build
sam deploy --guided      # stack name: h2s-backend, region: same as above, allow IAM role creation: Y, save to samconfig.toml: Y
```

`samconfig.toml` is git-ignored now; it holds account-specific values, so keep it local.

Get the API URL:

```bash
aws cloudformation describe-stacks --stack-name h2s-backend \
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text
```

Smoke test it (any HTTP response, even 404/403 with JSON, means API Gateway and Lambda are wired up):

```bash
curl -s -o /dev/null -w "%{http_code}\n" "<ApiEndpoint>ingestion/status/test"
aws logs tail /aws/lambda/<function-name> --since 10m     # list names: aws lambda list-functions --query 'Functions[].FunctionName'
```

Other quick inventory checks:

```bash
aws dynamodb list-tables --query "TableNames[?starts_with(@,'BloomWay')]"
aws sqs list-queues --queue-name-prefix BloomWay
aws lambda list-functions --query "Functions[?starts_with(FunctionName,'h2s-backend')].[FunctionName,Runtime]" --output table
```

## 3. Frontend on Amplify

### The URL question (decide this first)

An Amplify default URL looks like `https://main.<appId>.amplifyapp.com`. The app ID belongs to the account that created
the app, so **a new account always gets a new default URL; it cannot be transferred.** Your options:

1. **Old Amplify app still exists:** keep using it. Only change its `VITE_API_BASE_URL` to the new API URL and redeploy.
   Check with the old account's profile: `aws amplify list-apps --profile <old> --query 'apps[].[name,appId,defaultDomain]'`
2. **Custom domain:** attach a domain you own to the new app; that URL then never changes again.
3. **New URL:** update it in your resume, LinkedIn, README and anywhere else it is posted.

### Create the new app (console is easiest for the GitHub connection)

Amplify console > Create new app > GitHub > pick `HARSH160804/CodeLens.AI`, branch `main`. Amplify reads `amplify.yml`.
Before the first build, add the environment variable:

```
VITE_API_BASE_URL = <ApiEndpoint output, without a trailing slash>
```

Or from the CLI once the app exists:

```bash
aws amplify update-app --app-id <APP_ID> --environment-variables VITE_API_BASE_URL=<ApiEndpoint>
aws amplify start-job --app-id <APP_ID> --branch-name main --job-type RELEASE
aws amplify list-jobs --app-id <APP_ID> --branch-name main --max-results 3
```

### SPA rewrite rule (needed, `_redirects` is ignored by Amplify)

Without this, refreshing `/repo/<id>` returns 404. Console > Hosting > Rewrites and redirects, or:

```bash
aws amplify update-app --app-id <APP_ID> --custom-rules '[{"source":"</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>","target":"/index.html","status":"200"}]'
```

### That is your CI/CD for the frontend

Once the branch is connected with auto-build on, every push to `main` rebuilds and deploys the frontend. For the backend,
re-run `sam build && sam deploy` after template or handler changes.

## 4. End-to-end check

1. Open the Amplify URL, DevTools > Network. The first request must go to the **new** `execute-api` host, not the old one.
2. Ingest a tiny repo (a few files). Watch the job: `aws dynamodb scan --table-name BloomWay-IngestionJobs --max-items 3`.
3. If a job sits in `processing`: `aws logs tail /aws/lambda/<ProcessRepoWorkerFunction name> --since 15m --follow`.
4. Open Architecture, a file explanation and Chat once each, so you know all three work before the interview.

## 5. Protect the new account's bill

```bash
aws budgets create-budget --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget '{"BudgetName":"codelens-monthly","BudgetLimit":{"Amount":"10","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST"}' \
  --notifications-with-subscribers '[{"Notification":{"NotificationType":"ACTUAL","ComparisonOperator":"GREATER_THAN","Threshold":80,"ThresholdType":"PERCENTAGE"},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"<your email>"}]}]'
```

The API now throttles to 5 req/s (burst 10). The API has no authentication, so anyone with the URL can trigger Bedrock calls.

## Known follow-ups (not needed for the demo)

- Lambda runtime `python3.9` is deprecated (Dec 2025); still deployable, but move to 3.12+ and re-test.
- CORS is `*`; restrict to the Amplify domain once it is final.
- The optional GitHub `auth_token` travels in the request body and into the SQS message. Prefer a server-side secret.
