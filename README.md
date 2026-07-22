# Glowing With God Fund

Static GitHub Pages site for the Glowing With God Fund Crown Winner Program.

## Production Files

- `index.html` - public site and application form
- `styles.css` - responsive site styling
- `script.js` - mobile nav, upload labels, S3 uploads, Google Sheets submission
- `assets/glowing-with-god-logo-transparent.png` - site logo
- `google-apps-script/Code.gs` - starter Google Apps Script for writing submissions to a Google Sheet

Local preview PDFs and backend experiments are not required for production.

## Form Configuration

The form is static. Configure these attributes on `#application-form` in `index.html` before accepting applications:

```html
data-s3-upload-base-url=""
data-google-sheets-endpoint=""
```

Current S3 upload prefix:

```html
data-s3-upload-base-url="https://glowingwithgodfund-applications.s3.us-west-1.amazonaws.com/applications"
```

Current Google Apps Script endpoint:

```html
data-google-sheets-endpoint="https://script.google.com/macros/s/AKfycbxCBGn1IDgrvnoCmrxVELpJODZOUtikKMqw_ncCc3iwYHxm-KV1kIiJFNYVpX8Do4hw/exec"
```

Set this if the Apps Script deployment changes:

- `data-google-sheets-endpoint` for the deployed Google Apps Script web app URL

The browser uploads files first, then sends the application details and uploaded file URLs to Google Sheets.

## Google Sheets

Use `google-apps-script/Code.gs` as the starter script:

1. Create a Google Sheet.
2. Open Extensions -> Apps Script.
3. Paste `google-apps-script/Code.gs`.
4. Set `SHEET_NAME` if needed.
5. Deploy as a Web App.
6. Use the Web App URL as `data-google-sheets-endpoint`.

## S3 Uploads

The static site assumes an S3-compatible upload prefix that accepts browser `PUT` requests from the production domain.

Required S3 setup:

- CORS allows `PUT` from the production domain.
- Bucket/prefix policy allows the upload behavior you want.
- Upload prefix matches `data-s3-upload-base-url`.
- Default bucket encryption is enabled.

Current bucket:

```text
glowingwithgodfund-applications
```

The bucket was created in `us-west-1`, CORS was applied for `https://glowingwithgodfund.github.io`, and default AES-256 server-side encryption was enabled.

The public upload policy still needs AWS Console/admin permission because account-level or bucket-level Block Public Access prevented applying a public bucket policy from the current IAM user. The intended policy is in `aws/s3-public-put-policy.json`.

Important: CORS is not access control. If the bucket/prefix allows public writes, another client can still attempt writes even if CORS blocks normal browser reads from other origins. Keep the upload prefix isolated, monitor it, and avoid public read access for applicant documents.

## Source Mapping

The form fields and terms were extracted from `GWG CROWN APPLICATION 1.docx`.

Office-use-only fields from the DOCX are intentionally not exposed.

## Legal Review

Have counsel review liability, privacy, media consent, nonprofit donation language, charitable solicitation requirements, and the relationship between Glowing With God Fund and Hair By Gena INC.
