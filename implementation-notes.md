# Implementation Notes

## Public Content

Public-facing content should stay focused on:

- Mission and origin story
- What the Crown Winner Program provides
- How applications are reviewed
- Donation CTA
- Contact information

The detailed applicant terms are still public and accessible, but they are intentionally placed near the bottom so the top of the site stays compassionate and donor/applicant friendly.

## Application-Flow-Only Content

Keep these in the application flow:

- Hair/scalp photo uploads
- Financial hardship explanation
- Financial verification documents
- Full applicant acknowledgments
- Initials, signature, and date
- Internal review status and notes

Do not expose the DOCX office-use-only fields on the public page.

## Upload Handling

The production site is static. The form uploads files directly to the configured S3 upload prefix, then sends application metadata and uploaded file URLs to a Google Apps Script endpoint that appends a row to Google Sheets.

CORS is not security. If the upload prefix is public-write, keep it isolated from the rest of the bucket and avoid public-read access for applicant documents.

## Admin Portal

The proposed admin portal should be protected by Cognito and a Lambda/API Gateway backend. The static page should only contain public Cognito/API identifiers, never AWS access keys or hardcoded shared passwords.

The first admin version reads the Google Sheet CSV export and signs S3 object links server-side. This preserves the current intake form but depends on the Sheet remaining viewable by link. Long-term, move applicant records into AWS storage or use Google service-account access so the Sheet can be private.

## Production Next Steps

1. Confirm the S3 public upload policy in `aws/s3-public-put-policy.json` is applied to `glowingwithgodfund-applications`.
2. Paste the latest `google-apps-script/Code.gs`, run `setupHeaders`, and redeploy the Google Apps Script web app with access set to anyone.
3. Replace the Nucleus link with the final giving URL.
4. Confirm the public contact email and phone number.
5. Configure the S3 bucket/prefix with CORS for the nonprofit domain, server-side encryption, and lifecycle/retention policy.
6. Add CAPTCHA or bot protection if spam becomes an issue.
7. Run a full applicant test before launch.
8. Deploy the Cognito/API Gateway/Lambda admin stack if Regina needs an in-site review portal.

## Legal And Compliance Notes

This is not legal advice. Before accepting applications or donations, review:

- Nonprofit status, fiscal sponsorship, or charitable solicitation rules
- Donation receipt and tax-deductibility wording
- Privacy handling for financial, medical, and photo submissions
- Media release wording and whether it should be optional or separately signed
- Enforceability of assumption-of-risk and liability language
- Conflict-of-interest or related-party disclosures if the nonprofit pays Hair By Gena INC. for services

## Local Preview

Serve the static site locally with:

```bash
python3 -m http.server 5500
```
