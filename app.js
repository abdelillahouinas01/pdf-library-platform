const socket = io();

const pdfGrid =
    document.getElementById("pdfGrid");

const loading =
    document.getElementById("loading");

const emptyState =
    document.getElementById("emptyState");

const documentCount =
    document.getElementById("documentCount");

const loginModal =
    document.getElementById("loginModal");

const developerButton =
    document.getElementById("developerButton");

const closeModal =
    document.getElementById("closeModal");

const loginButton =
    document.getElementById("loginButton");

const passwordInput =
    document.getElementById("developerPassword");

const loginError =
    document.getElementById("loginError");

const toast =
    document.getElementById("toast");


/* =========================
   LOAD PDFs
========================= */

async function loadPDFs() {

    try {

        loading.classList.remove("hidden");

        const response =
            await fetch("/api/pdfs");

        const result =
            await response.json();

        if (!result.success) {
            throw new Error();
        }

        renderPDFs(result.data);

    } catch (error) {

        showToast(
            "Unable to load documents."
        );

    } finally {

        loading.classList.add("hidden");
    }
}


/* =========================
   RENDER
========================= */

function renderPDFs(pdfs) {

    pdfGrid.innerHTML = "";

    documentCount.textContent =
        `${pdfs.length} Document${pdfs.length === 1 ? "" : "s"}`;

    if (!pdfs.length) {

        emptyState.classList.remove("hidden");

        return;
    }

    emptyState.classList.add("hidden");

    pdfs.forEach(
        (pdf, index) => {

            const card =
                createPDFCard(
                    pdf,
                    index
                );

            pdfGrid.appendChild(card);
        }
    );
}


/* =========================
   CREATE CARD
========================= */

function createPDFCard(pdf, index) {

    const article =
        document.createElement("article");

    article.className = "pdf-card";

    article.style.animationDelay =
        `${index * 0.06}s`;

    article.innerHTML = `

        <div class="pdf-icon">
            PDF
        </div>

        <div class="pdf-module">
            ${escapeHTML(pdf.module)}
        </div>

        <div class="pdf-title">
            ${escapeHTML(pdf.title)}
        </div>

        <div class="pdf-filename">
            ${escapeHTML(pdf.original_name)}
        </div>

        <div class="card-actions">

            <button
                class="card-button"
                onclick="previewPDF(${pdf.id})"
            >
                Preview
            </button>

            <button
                class="card-button primary"
                onclick="downloadPDF(${pdf.id})"
            >
                Download
            </button>

        </div>
    `;

    return article;
}


/* =========================
   PREVIEW
========================= */

function previewPDF(id) {

    window.open(
        `/pdf/${id}`,
        "_blank"
    );
}


/* =========================
   DOWNLOAD
========================= */

function downloadPDF(id) {

    const link =
        document.createElement("a");

    link.href =
        `/api/download/${id}`;

    link.download = "";

    document.body.appendChild(link);

    link.click();

    link.remove();
}


/* =========================
   GET PDF
========================= */

async function getPDF(id) {

    const response =
        await fetch("/api/pdfs");

    const result =
        await response.json();

    return result.data.find(
        pdf => pdf.id === id
    );
}


/* =========================
   DYNAMIC PDF ROUTES
========================= */

window.previewPDF = async function(id) {

    const pdf =
        await getPDF(id);

    if (!pdf) return;

    window.open(
        `/uploads/${encodeURIComponent(pdf.filename)}`,
        "_blank"
    );
};


window.downloadPDF = async function(id) {

    const pdf =
        await getPDF(id);

    if (!pdf) return;

    const link =
        document.createElement("a");

    link.href =
        `/uploads/${encodeURIComponent(pdf.filename)}`;

    link.download =
        pdf.original_name;

    document.body.appendChild(link);

    link.click();

    link.remove();
};


/* =========================
   LOGIN MODAL
========================= */

developerButton.addEventListener(
    "click",
    () => {

        loginModal.classList.remove(
            "hidden"
        );

        passwordInput.focus();
    }
);


closeModal.addEventListener(
    "click",
    closeLogin
);


document
    .querySelector(".modal-overlay")
    .addEventListener(
        "click",
        closeLogin
    );


function closeLogin() {

    loginModal.classList.add(
        "hidden"
    );

    loginError.textContent = "";

    passwordInput.value = "";
}


/* =========================
   LOGIN
========================= */

loginButton.addEventListener(
    "click",
    login
);


passwordInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {
            login();
        }
    }
);


async function login() {

    const password =
        passwordInput.value;

    if (!password) {

        loginError.textContent =
            "Enter the password.";

        return;
    }

    loginButton.disabled = true;

    try {

        const response =
            await fetch(
                "/api/admin/login",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        password
                    })
                }
            );

        const result =
            await response.json();

        if (!response.ok) {

            loginError.textContent =
                "Incorrect password.";

            return;
        }

        sessionStorage.setItem(
            "adminPassword",
            password
        );

        window.location.href =
            "/admin.html";

    } catch {

        loginError.textContent =
            "Connection error.";

    } finally {

        loginButton.disabled = false;
    }
}


/* =========================
   SOCKET REAL-TIME
========================= */

socket.on(
    "pdf:created",
    () => {

        loadPDFs();

        showToast(
            "New PDF published."
        );
    }
);


socket.on(
    "pdf:updated",
    () => {

        loadPDFs();

        showToast(
            "PDF updated."
        );
    }
);


socket.on(
    "pdf:deleted",
    () => {

        loadPDFs();

        showToast(
            "PDF removed."
        );
    }
);


/* =========================
   TOAST
========================= */

function showToast(message) {

    toast.textContent =
        message;

    toast.classList.add(
        "show"
    );

    setTimeout(
        () => {
            toast.classList.remove(
                "show"
            );
        },
        3000
    );
}


/* =========================
   SECURITY
========================= */

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================
   INITIAL
========================= */

loadPDFs();
