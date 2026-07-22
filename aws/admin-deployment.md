# Admin Portal Deployment

This admin portal keeps the public website static while adding a private review layer:

- Cognito signs in approved reviewers.
- API Gateway verifies the Cognito token.
- Lambda reads the `Applications` Google Sheet tab.
- Lambda generates short-lived S3 signed links for uploads.
- `admin.html` displays submissions in a reviewer-friendly layout.

## Current Data Source

The admin API reads the `Applications` tab through its CSV export URL:

```text
https://docs.google.com/spreadsheets/d/1KpaJbwJswzd8QXtNfFT9poxR_G-nvLtcuBF22iyImAY/export?format=csv&gid=1485217957
```

This requires the Google Sheet to remain viewable by link. That is acceptable as a short bridge, but the more private long-term approach is moving submissions into AWS storage or adding Google service-account access.

## Deploy The AWS Stack

Prerequisites:

- AWS SAM CLI installed
- AWS credentials with permission to create Cognito, Lambda, API Gateway, IAM roles, and CloudFormation stacks
- S3 read access for `glowingwithgodfund-applications/applications/*`

From the repo root:

```bash
sam build --template-file aws/admin-template.yaml
sam deploy --guided --stack-name glowing-with-god-admin --region us-west-1
```

Use these guided values:

- `AdminOrigin`: `https://glowingwithgodfund.github.io`
- `CallbackUrl`: `https://glowingwithgodfund.github.io/admin.html`
- `LogoutUrl`: `https://glowingwithgodfund.github.io/admin.html`
- `BucketName`: `glowingwithgodfund-applications`
- `GoogleSheetCsvUrl`: the CSV export URL above
- `CognitoDomainPrefix`: globally unique lowercase value, for example `glowingwithgodfund-admin-154808201414`

After deploy, copy these outputs:

- `AdminApiUrl`
- `CognitoDomain`
- `CognitoUserPoolClientId`

## Configure The Static Admin Page

Create `admin-config.js` from `admin-config.example.js`:

```js
window.GWG_ADMIN_CONFIG = {
  apiBaseUrl: "AdminApiUrl output",
  cognitoDomain: "CognitoDomain output",
  clientId: "CognitoUserPoolClientId output",
  redirectUri: "https://glowingwithgodfund.github.io/admin.html",
  logoutUri: "https://glowingwithgodfund.github.io/admin.html",
};
```

Commit and push `admin-config.js` after the stack exists. These values are not secrets; the API is protected by Cognito.

## Add Reviewers

In AWS Console:

1. Open Cognito.
2. Open the `glowing-with-god-admin` user pool.
3. Create users for approved reviewers.
4. Use email usernames for Casey and Regina.
5. Require password reset on first sign-in.

Reviewers do not need AWS IAM console access for the admin portal.

## Reviewer URL

```text
https://glowingwithgodfund.github.io/admin.html
```

## Later Hardening

- Make the Google Sheet private again.
- Replace CSV access with DynamoDB or Google service-account access.
- Add status fields such as `New`, `Reviewing`, `Approved`, `Declined`.
- Add CloudWatch alarms for Lambda errors.
- Add S3 lifecycle retention rules for old applicant uploads.
