const socket = io();

const password =
    sessionStorage.getItem(
        "adminPassword"
    );

if (!password) {
    window.location.href = "/";
}


const uploadForm =
    document.getElementById(
        "uploadForm"
    );

const pdfInput =
    document.getElementById("pdf");

const selectedFile =
    document.getElementById(
        "selectedFile"
    );

const adminDocuments =
    document.getElementById(
        "adminDocuments"
    );

const totalPDFs =
    document.getElementById(
        "totalPDFs"
    );

const totalModules =
    document.getElementById(
        "totalModules"
    );

const logoutButton =
    document.getElementById(
        "logoutButton"
    );

const editModal =
    document.getElementById(
        "editModal"
    );

const editTitle =
    document.getElementById(
        "editTitle"
    );

const editModule =
    document.getElementById(
        "editModule"
    );

const cancelEdit =
    document.getElementById(
        "cancelEdit"
    );

const saveEdit =
    document.getElementById(
        "saveEdit"
    );

const toast =
    document.getElementById(
        "adminToast"
    );

let editingId = null;

let documents = [];


/* =========================
   API HEADERS
========================= */

function headers() {

    return {
        "x-admin-password":
            password
    };
}


/* =========================
   LOAD DOCUMENTS
========================= */

async function loadDocuments() {

    const response =
        await fetch("/api/pdfs");

    const result =
        await response.json();

    if (!result.success) {
        return;
    }

    documents =
        result.data;

    renderDocuments();

    loadStats();
}


/* =========================
   RENDER
========================= */

function renderDocuments() {

    adminDocuments.innerHTML = "";

    documents.forEach(
        pdf => {

            const row =
                document.createElement(
                    "div"
                );

            row.className =
                "admin-document";

            row.innerHTML = `

                <div class="document-icon">
                    PDF
                </div>

                <div>

                    <div class="document-title">
                        ${escapeHTML(pdf.title)}
                    </div>

                    <div class="document-module">
                        ${escapeHTML(pdf.module)}
                        ·
                        ${escapeHTML(pdf.original_name)}
                    </div>

                </div>

                <div class="document-actions">

                    <button
                        onclick="editPDF(${pdf.id})"
                    >
                        Edit
                    </button>

                    <button
                        class="delete"
                        onclick="deletePDF(${pdf.id})"
                    >
                        Delete
                    </button>

                </div>
            `;

            adminDocuments.appendChild(row);
        }
    );
}


/* =========================
   STATS
========================= */

async function loadStats() {

    const response =
        await fetch(
            "/api/admin/stats",
            {
                headers: headers()
            }
        );

    const result =
        await response.json();

    if (!result.success) {
        return;
    }

    totalPDFs.textContent =
        result.data.total;

    totalModules.textContent =
        result.data.modules;
}


/* =========================
   FILE SELECT
========================= */

pdfInput.addEventListener(
    "change",
    () => {

        const file =
            pdfInput.files[0];

        if (!file) {

            selectedFile.textContent =
                "";

            return;
        }

        selectedFile.textContent =
            file.name;
    }
);


/* =========================
   UPLOAD
========================= */

uploadForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        const formData =
            new FormData(
                uploadForm
            );

        const button =
            uploadForm.querySelector(
                "button[type='submit']"
            );

        button.disabled = true;

        button.textContent =
            "Publishing...";

        try {

            const response =
                await fetch(
                    "/api/admin/pdfs",
                    {
                        method: "POST",

                        headers:
                            headers(),

                        body:
                            formData
                    }
                );

            const result =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    result.message
                );
            }

            uploadForm.reset();

            selectedFile.textContent =
                "";

            showToast(
                "PDF published successfully."
            );

            loadDocuments();

        } catch (error) {

            showToast(
                error.message ||
                "Upload failed."
            );

        } finally {

            button.disabled = false;

            button.textContent =
                "Publish Document";
        }
    }
);


/* =========================
   EDIT
========================= */

window.editPDF = function(id) {

    const pdf =
        documents.find(
            item => item.id === id
        );

    if (!pdf) return;

    editingId = id;

    editTitle.value =
        pdf.title;

    editModule.value =
        pdf.module;

    editModal.classList.remove(
        "hidden"
    );
};


cancelEdit.addEventListener(
    "click",
    () => {

        editModal.classList.add(
            "hidden"
        );

        editingId = null;
    }
);


saveEdit.addEventListener(
    "click",
    async () => {

        if (!editingId) return;

        try {

            const response =
                await fetch(
                    `/api/admin/pdfs/${editingId}`,
                    {
                        method: "PUT",

                        headers: {
                            ...headers(),

                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                title:
                                    editTitle.value,

                                module:
                                    editModule.value
                            })
                    }
                );

            const result =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    result.message
                );
            }

            editModal.classList.add(
                "hidden"
            );

            showToast(
                "Document updated."
            );

            loadDocuments();

        } catch (error) {

            showToast(
                error.message
            );
        }
    }
);


/* =========================
   DELETE
========================= */

window.deletePDF = async function(id) {

    const pdf =
        documents.find(
            item => item.id === id
        );

    if (!pdf) return;

    const confirmed =
        confirm(
            `Delete "${pdf.title}"?`
        );

    if (!confirmed) {
        return;
    }

    try {

        const response =
            await fetch(
                `/api/admin/pdfs/${id}`,
                {
                    method: "DELETE",

                    headers:
                        headers()
                }
            );

        const result =
            await response.json();

        if (!response.ok) {

            throw new Error(
                result.message
            );
        }

        showToast(
            "Document deleted."
        );

        loadDocuments();

    } catch (error) {

        showToast(
            error.message
        );
    }
};


/* =========================
   REAL-TIME
========================= */

socket.on(
    "pdf:created",
    pdf => {

        loadDocuments();

        showToast(
            `Published: ${pdf.title}`
        );
    }
);


socket.on(
    "pdf:updated",
    pdf => {

        loadDocuments();

        showToast(
            `Updated: ${pdf.title}`
        );
    }
);


socket.on(
    "pdf:deleted",
    () => {

        loadDocuments();

        showToast(
            "Document deleted."
        );
    }
);


/* =========================
   LOGOUT
========================= */

logoutButton.addEventListener(
    "click",
    () => {

        sessionStorage.removeItem(
            "adminPassword"
        );

        window.location.href =
            "/";
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
   ESCAPE
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

loadDocuments();