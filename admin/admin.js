(function () {
  const config = window.GWG_ADMIN_CONFIG || {};
  const requiredConfig = ["apiBaseUrl", "cognitoDomain", "clientId", "redirectUri", "logoutUri"];
  const isConfigured = requiredConfig.every((key) => config[key] && !String(config[key]).includes("YOUR_"));
  const tokenKey = "gwg_admin_tokens";
  const codeVerifierKey = "gwg_admin_code_verifier";
  const stateKey = "gwg_admin_oauth_state";

  const elements = {
    login: document.querySelector("[data-login]"),
    logout: document.querySelector("[data-logout]"),
    refresh: document.querySelector("[data-refresh]"),
    setup: document.querySelector("[data-setup]"),
    status: document.querySelector("[data-status]"),
    review: document.querySelector("[data-review]"),
    list: null,
    detail: null,
    search: null,
  };

  let applications = [];
  let selectedSubmissionId = null;

  function setStatus(message, tone = "neutral") {
    elements.status.textContent = message || "";
    elements.status.dataset.tone = tone;
    elements.status.hidden = !message;
  }

  function base64Url(bytes) {
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  async function sha256(value) {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return base64Url(new Uint8Array(digest));
  }

  function randomString() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return base64Url(bytes);
  }

  function getTokens() {
    try {
      return JSON.parse(sessionStorage.getItem(tokenKey) || "null");
    } catch {
      return null;
    }
  }

  function saveTokens(tokens) {
    sessionStorage.setItem(tokenKey, JSON.stringify({ ...tokens, saved_at: Date.now() }));
  }

  function clearSession() {
    sessionStorage.removeItem(tokenKey);
    sessionStorage.removeItem(codeVerifierKey);
    sessionStorage.removeItem(stateKey);
  }

  function authHeaders() {
    const tokens = getTokens();
    if (!tokens?.id_token) throw new Error("Please sign in again.");
    return { Authorization: `Bearer ${tokens.id_token}` };
  }

  async function signIn() {
    const verifier = randomString();
    const state = randomString();
    const challenge = await sha256(verifier);
    sessionStorage.setItem(codeVerifierKey, verifier);
    sessionStorage.setItem(stateKey, state);

    const params = new URLSearchParams({
      client_id: config.clientId,
      response_type: "code",
      scope: "openid email profile",
      redirect_uri: config.redirectUri,
      code_challenge_method: "S256",
      code_challenge: challenge,
      state,
    });

    window.location.assign(`${config.cognitoDomain}/oauth2/authorize?${params}`);
  }

  async function exchangeCode(code) {
    const verifier = sessionStorage.getItem(codeVerifierKey);
    if (!verifier) throw new Error("Missing login verifier. Please sign in again.");

    const response = await fetch(`${config.cognitoDomain}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.clientId,
        code,
        redirect_uri: config.redirectUri,
        code_verifier: verifier,
      }),
    });

    if (!response.ok) throw new Error("Could not complete sign in.");
    saveTokens(await response.json());
    sessionStorage.removeItem(codeVerifierKey);
    sessionStorage.removeItem(stateKey);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  function signOut() {
    clearSession();
    destroyReviewShell();
    const params = new URLSearchParams({
      client_id: config.clientId,
      logout_uri: config.logoutUri,
    });
    window.location.assign(`${config.cognitoDomain}/logout?${params}`);
  }

  async function loadApplications() {
    setStatus("Loading applications...");
    const response = await fetch(`${config.apiBaseUrl.replace(/\/+$/, "")}/applications`, {
      headers: authHeaders(),
    });

    if (response.status === 401 || response.status === 403) {
      clearSession();
      throw new Error("Your sign-in expired. Please sign in again.");
    }
    if (!response.ok) throw new Error("Could not load applications.");

    const payload = await response.json();
    applications = payload.applications || [];
    selectedSubmissionId = applications[0]?.submission_id || null;
    render();
    setStatus(`${applications.length} application${applications.length === 1 ? "" : "s"} loaded.`);
  }

  function field(value, fallback = "Not provided") {
    return value ? String(value) : fallback;
  }

  function formatDate(value) {
    if (!value) return "Date unavailable";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }

  function filteredApplications() {
    const term = elements.search.value.trim().toLowerCase();
    if (!term) return applications;
    return applications.filter((app) =>
      [
        app.full_name,
        app.email,
        app.phone,
        app.submission_id,
        app.financial_hardship,
        app.hair_loss_conditions,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }

  function renderList() {
    if (!elements.list || !elements.search) return;
    elements.list.textContent = "";
    for (const app of filteredApplications()) {
      const node = document.createElement("button");
      node.className = "application-card";
      node.type = "button";
      node.dataset.selected = String(app.submission_id === selectedSubmissionId);
      node.innerHTML = `
        <span class="card-name"></span>
        <span class="card-meta"></span>
      `;
      node.querySelector(".card-name").textContent = field(app.full_name, "Unnamed applicant");
      node.querySelector(".card-meta").textContent = `${formatDate(app.submitted_at)} · ${field(app.email)}`;
      node.addEventListener("click", () => {
        selectedSubmissionId = app.submission_id;
        render();
      });
      elements.list.append(node);
    }
  }

  function renderDetail() {
    if (!elements.detail) return;
    const app = applications.find((item) => item.submission_id === selectedSubmissionId);
    if (!app) {
      elements.detail.innerHTML =
        '<div class="empty-state"><h2>Select an application</h2><p>Applicant details and private upload links will appear here.</p></div>';
      return;
    }

    const uploads = Array.isArray(app.uploads) ? app.uploads : [];
    const imageUploads = uploads.filter(isImageUpload);
    const documentUploads = uploads.filter((upload) => !isImageUpload(upload));
    elements.detail.innerHTML = `
      <header class="detail-header">
        <div>
          <p class="eyebrow">Submitted ${formatDate(app.submitted_at)}</p>
          <h2>${field(app.full_name, "Unnamed applicant")}</h2>
          <p>${field(app.email)} · ${field(app.phone)}</p>
        </div>
        <span class="submission-id">${field(app.submission_id)}</span>
      </header>

      <div class="detail-grid">
        ${infoBlock("Applicant", [
          ["Date of birth", app.date_of_birth],
          ["Address", [app.address, app.city, app.state, app.zip].filter(Boolean).join(", ")],
          ["Referral", app.referral_sources],
          ["Specific reference", app.specific_reference],
        ])}
        ${infoBlock("Hair Loss", [
          ["Conditions", app.hair_loss_conditions],
          ["Estimated start", app.estimated_start],
          ["Condition details", app.condition_details],
          ["Impact", app.impact],
        ])}
        ${infoBlock("Financial", [
          ["Hardship", app.financial_hardship],
          ["Explanation", app.financial_explanation],
          ["Documents", app.supporting_documents],
          ["Document notes", app.supporting_documents_list],
        ])}
        ${infoBlock("Acknowledgments", [
          ["Initials", app.initials],
          ["Signature", app.signature],
          ["Signature date", app.signature_date],
        ])}
      </div>

      <section class="uploads">
        <h3>Uploads</h3>
        ${renderImageGallery(imageUploads)}
        ${documentUploads.length ? '<div class="document-uploads"><h4>Documents</h4>' : ""}
        ${
          documentUploads.length
            ? documentUploads
                .map(
                  (upload) => `
            <a class="upload-link" href="${upload.signed_url}" target="_blank" rel="noopener">
              <span>${field(upload.label || upload.field_name, "Upload")}</span>
              <small>${field(upload.filename || upload.object_key, "Open or download file")}</small>
              <em>Open or download</em>
            </a>
          `,
                )
                .join("")
            : imageUploads.length
              ? ""
              : "<p>No uploads listed for this application.</p>"
        }
        ${documentUploads.length ? "</div>" : ""}
      </section>
    `;
    attachGalleryEvents(imageUploads);
  }

  function infoBlock(title, rows) {
    return `
      <section class="info-block">
        <h3>${title}</h3>
        ${rows
          .map(
            ([label, value]) => `
          <div>
            <dt>${label}</dt>
            <dd>${field(value)}</dd>
          </div>
        `,
          )
          .join("")}
      </section>
    `;
  }

  function isImageUpload(upload) {
    return /\.(avif|gif|jpe?g|png|webp)$/i.test(upload.filename || upload.object_key || "");
  }

  function renderImageGallery(imageUploads) {
    if (!imageUploads.length) return "";
    const first = imageUploads[0];
    return `
      <div class="image-gallery" data-gallery>
        <a class="gallery-main-link" href="${first.signed_url}" target="_blank" rel="noopener" data-gallery-link>
          <img class="gallery-main-image" src="${first.signed_url}" alt="${field(first.label, "Application upload")}" data-gallery-image />
        </a>
        <div class="gallery-caption" data-gallery-caption>
          <strong>${field(first.label, "Image Upload")}</strong>
          <span>${field(first.filename)}</span>
        </div>
        <div class="gallery-thumbs" aria-label="Image uploads">
          ${imageUploads
            .map(
              (upload, index) => `
            <button class="gallery-thumb" type="button" data-image-index="${index}" data-selected="${index === 0}">
              <img src="${upload.signed_url}" alt="${field(upload.label, "Application upload")}" />
              <span>${field(upload.label, "Image")}</span>
            </button>
          `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function attachGalleryEvents(imageUploads) {
    const gallery = elements.detail.querySelector("[data-gallery]");
    if (!gallery) return;

    const image = gallery.querySelector("[data-gallery-image]");
    const link = gallery.querySelector("[data-gallery-link]");
    const caption = gallery.querySelector("[data-gallery-caption]");
    gallery.querySelectorAll("[data-image-index]").forEach((button) => {
      button.addEventListener("click", () => {
        const upload = imageUploads[Number(button.dataset.imageIndex)];
        if (!upload) return;

        image.src = upload.signed_url;
        image.alt = field(upload.label, "Application upload");
        link.href = upload.signed_url;
        caption.innerHTML = `<strong>${field(upload.label, "Image Upload")}</strong><span>${field(upload.filename)}</span>`;
        gallery
          .querySelectorAll("[data-image-index]")
          .forEach((thumb) => (thumb.dataset.selected = String(thumb === button)));
      });
    });
  }

  function render() {
    ensureReviewShell();
    renderList();
    renderDetail();
  }

  function ensureReviewShell() {
    if (elements.list && elements.detail && elements.search) return;

    elements.review.className = "review-layout";
    elements.review.innerHTML = `
      <aside class="application-list">
        <div class="list-tools">
          <label>
            <span>Search applications</span>
            <input type="search" data-search placeholder="Name, email, phone, status" />
          </label>
        </div>
        <div class="list" data-list></div>
      </aside>

      <article class="application-detail" data-detail>
        <div class="empty-state">
          <h2>Select an application</h2>
          <p>Applicant details and private upload links will appear here.</p>
        </div>
      </article>
    `;
    elements.list = elements.review.querySelector("[data-list]");
    elements.detail = elements.review.querySelector("[data-detail]");
    elements.search = elements.review.querySelector("[data-search]");
    elements.search.addEventListener("input", renderList);
  }

  function destroyReviewShell() {
    applications = [];
    selectedSubmissionId = null;
    elements.review.hidden = true;
    elements.review.className = "";
    elements.review.textContent = "";
    elements.list = null;
    elements.detail = null;
    elements.search = null;
  }

  async function boot() {
    if (!isConfigured) {
      elements.setup.hidden = false;
      setStatus("Admin login is not configured yet.", "warn");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (code) {
      if (state !== sessionStorage.getItem(stateKey)) {
        clearSession();
        setStatus("Login state did not match. Please sign in again.", "error");
        return;
      }
      await exchangeCode(code);
    }

    const signedIn = Boolean(getTokens()?.id_token);
    elements.login.hidden = signedIn;
    elements.logout.hidden = !signedIn;
    elements.refresh.hidden = !signedIn;
    elements.review.hidden = !signedIn;

    if (signedIn) {
      ensureReviewShell();
      await loadApplications();
    } else {
      destroyReviewShell();
      setStatus("Sign in to review applications.");
    }
  }

  elements.login.addEventListener("click", () => signIn().catch((error) => setStatus(error.message, "error")));
  elements.logout.addEventListener("click", signOut);
  elements.refresh.addEventListener("click", () => loadApplications().catch((error) => setStatus(error.message, "error")));
  boot().catch((error) => setStatus(error.message, "error"));
})();
