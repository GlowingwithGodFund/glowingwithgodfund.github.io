const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");
const year = document.querySelector("#year");
const form = document.querySelector("#application-form");
const statusMessage = document.querySelector("#form-status");

if (year) {
  year.textContent = new Date().getFullYear();
}

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      navLinks.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

document.querySelectorAll(".file-control input[type='file']").forEach((input) => {
  input.addEventListener("change", () => {
    const label = input.closest(".file-control");
    const display = label?.querySelector("span");
    if (!display) return;

    if (input.files?.length) {
      display.textContent =
        input.files.length === 1 ? input.files[0].name : `${input.files.length} files selected`;
    } else {
      display.textContent = input.accept.includes("image") ? "Select image" : "Select document";
    }
  });
});

function getValues(formData, name) {
  return formData.getAll(name).filter(Boolean);
}

function getValue(formData, name) {
  return String(formData.get(name) || "").trim();
}

function trimSlash(value) {
  return value.replace(/\/+$/, "");
}

function encodeKey(key) {
  return key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function safePart(value) {
  return String(value || "file")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "file";
}

async function uploadFile(s3BaseUrl, submissionId, input) {
  const file = input.files?.[0];
  if (!file) return null;

  const objectKey = [
    safePart(submissionId),
    `${safePart(input.name)}-${crypto.randomUUID()}-${safePart(file.name)}`,
  ].join("/");
  const uploadUrl = `${trimSlash(s3BaseUrl)}/${encodeKey(objectKey)}`;

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Could not upload ${file.name}.`);
  }

  return {
    field_name: input.name,
    filename: file.name,
    content_type: file.type || "application/octet-stream",
    size: file.size,
    object_key: objectKey,
    object_url: uploadUrl,
  };
}

function buildPayload(formData, submissionId, uploads) {
  return {
    submitted_at: new Date().toISOString(),
    submission_id: submissionId,
    applicant: {
      full_name: getValue(formData, "full_name"),
      date_of_birth: getValue(formData, "date_of_birth"),
      phone: getValue(formData, "phone"),
      email: getValue(formData, "email"),
      address: getValue(formData, "address"),
      city: getValue(formData, "city"),
      state: getValue(formData, "state"),
      zip: getValue(formData, "zip"),
    },
    referral: {
      sources: getValues(formData, "referral_source"),
      specific_reference: getValue(formData, "specific_reference"),
    },
    hair_loss: {
      conditions: getValues(formData, "condition"),
      details: getValue(formData, "condition_details"),
      estimated_start: getValue(formData, "hair_loss_start"),
      impact: getValue(formData, "impact"),
    },
    financial: {
      hardship: getValue(formData, "financial_hardship"),
      explanation: getValue(formData, "financial_explanation"),
      supporting_documents: getValues(formData, "supporting_documents"),
      supporting_documents_list: getValue(formData, "supporting_documents_list"),
    },
    acknowledgments: {
      initials: getValue(formData, "initials"),
      signature: getValue(formData, "signature"),
      signature_date: getValue(formData, "signature_date"),
      checked: true,
    },
    uploads,
  };
}

async function submitToGoogleSheet(endpoint, payload) {
  await fetch(endpoint, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
}

function resetFileLabels() {
  document.querySelectorAll(".file-control input[type='file']").forEach((input) => {
    const display = input.closest(".file-control")?.querySelector("span");
    if (display) {
      display.textContent = input.accept.includes("image") ? "Select image" : "Select document";
    }
  });
}

if (form && statusMessage) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const s3BaseUrl = form.dataset.s3UploadBaseUrl?.trim();
    const googleSheetsEndpoint = form.dataset.googleSheetsEndpoint?.trim();

    if (!s3BaseUrl || !googleSheetsEndpoint) {
      statusMessage.textContent =
        "Application submission is being configured. Please contact Regina Barbato for help applying.";
      return;
    }

    const formData = new FormData(form);
    const submissionId = crypto.randomUUID();
    const submitButton = form.querySelector("button[type='submit']");

    statusMessage.textContent = "Uploading application files...";
    submitButton?.setAttribute("disabled", "disabled");

    try {
      const fileInputs = Array.from(form.querySelectorAll("input[type='file']"));
      const uploads = [];

      for (const input of fileInputs) {
        const uploaded = await uploadFile(s3BaseUrl, submissionId, input);
        if (uploaded) uploads.push(uploaded);
      }

      statusMessage.textContent = "Submitting application...";
      await submitToGoogleSheet(googleSheetsEndpoint, buildPayload(formData, submissionId, uploads));

      form.reset();
      resetFileLabels();
      statusMessage.textContent =
        "Application submitted. Thank you. The review team will follow up after your materials are reviewed.";
    } catch (error) {
      statusMessage.textContent =
        error instanceof Error
          ? error.message
          : "The application could not be submitted. Please try again.";
    } finally {
      submitButton?.removeAttribute("disabled");
    }
  });
}
