import csv
import io
import json
import os
import re
import urllib.parse
import urllib.request

import boto3


BUCKET_NAME = os.environ["BUCKET_NAME"]
GOOGLE_SHEET_CSV_URL = os.environ["GOOGLE_SHEET_CSV_URL"]
SIGNED_URL_EXPIRES_SECONDS = int(os.environ.get("SIGNED_URL_EXPIRES_SECONDS", "900"))

s3 = boto3.client("s3")


def handler(event, context):
    try:
        method = event.get("requestContext", {}).get("http", {}).get("method", "")
        path = event.get("rawPath", "")

        if method == "GET" and path.endswith("/applications"):
            return response(200, {"applications": load_applications()})

        return response(404, {"message": "Not found"})
    except Exception as error:
        return response(500, {"message": str(error)})


def load_applications():
    csv_text = fetch_text(GOOGLE_SHEET_CSV_URL)
    rows = list(csv.DictReader(io.StringIO(csv_text)))
    applications = []

    for row in rows:
        if not any(row.values()):
            continue
        applications.append(normalize_row(row))

    applications.sort(key=lambda item: item.get("submitted_at") or "", reverse=True)
    return applications


def fetch_text(url):
    request = urllib.request.Request(url, headers={"User-Agent": "gwg-admin-api/1.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8")


def normalize_row(row):
    uploads = parse_uploads(row.get("Uploads", ""))
    return {
        "submitted_at": row.get("Submitted At", ""),
        "submission_id": row.get("Submission ID", ""),
        "full_name": row.get("Full Name", ""),
        "date_of_birth": row.get("Date of Birth", ""),
        "phone": row.get("Phone", ""),
        "email": row.get("Email", ""),
        "address": row.get("Address", ""),
        "city": row.get("City", ""),
        "state": row.get("State", ""),
        "zip": row.get("Zip", ""),
        "referral_sources": row.get("Referral Sources", ""),
        "specific_reference": row.get("Specific Reference", ""),
        "occupation": row.get("Occupation", ""),
        "employer_name": row.get("Employer Name", ""),
        "employer_address": row.get("Employer Address", ""),
        "employer_city": row.get("Employer City", ""),
        "employer_state": row.get("Employer State", ""),
        "employer_zip": row.get("Employer Zip", ""),
        "employer_phone": row.get("Employer Phone", ""),
        "employment_verification_initials": row.get("Employment Verification Initials", ""),
        "hair_loss_conditions": row.get("Hair Loss Conditions", ""),
        "condition_details": row.get("Condition Details", ""),
        "estimated_start": row.get("Estimated Start", ""),
        "impact": row.get("Impact", ""),
        "financial_hardship": row.get("Financial Hardship", ""),
        "financial_explanation": row.get("Financial Explanation", ""),
        "supporting_documents": row.get("Supporting Documents", ""),
        "supporting_documents_list": row.get("Supporting Documents List", ""),
        "initials": row.get("Initials", ""),
        "signature": row.get("Signature", ""),
        "signature_date": row.get("Signature Date", ""),
        "uploads": uploads,
    }


def parse_uploads(value):
    uploads = []
    for line in value.splitlines():
        if not line.strip() or ":" not in line:
            continue

        label, url = line.split(":", 1)
        url = url.strip()
        key = object_key_from_url(url)
        if not key:
            continue

        filename = urllib.parse.unquote(key.rsplit("/", 1)[-1])
        uploads.append(
            {
                "label": label.strip().replace("_", " ").title(),
                "field_name": label.strip(),
                "filename": filename,
                "object_key": key,
                "signed_url": s3.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": BUCKET_NAME, "Key": key},
                    ExpiresIn=SIGNED_URL_EXPIRES_SECONDS,
                ),
            }
        )
    return uploads


def object_key_from_url(url):
    parsed = urllib.parse.urlparse(url)
    if not parsed.netloc.endswith("amazonaws.com"):
        return None

    path = urllib.parse.unquote(parsed.path).lstrip("/")
    match = re.match(r"^applications/.+", path)
    return path if match else None


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "content-type": "application/json",
            "cache-control": "no-store",
        },
        "body": json.dumps(body),
    }
