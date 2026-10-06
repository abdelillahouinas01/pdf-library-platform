const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const Database = require("better-sqlite3");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const ADMIN_PASSWORD = "2727";

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const UPLOAD_DIR = path.join(ROOT, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
app.get("/pdf/:id", (req, res) => {

    const id = Number(req.params.id);

    const pdf = db
        .prepare(
            "SELECT filename FROM pdfs WHERE id = ?"
        )
        .get(id);

    if (!pdf) {
        return res.status(404).send("PDF not found");
    }

    res.sendFile(
        path.join(
            UPLOAD_DIR,
            pdf.filename
        )
    );
});


app.get("/api/download/:id", (req, res) => {

    const id = Number(req.params.id);

    const pdf = db
        .prepare(
            "SELECT * FROM pdfs WHERE id = ?"
        )
        .get(id);

    if (!pdf) {
        return res.status(404).send("PDF not found");
    }

    const filePath =
        path.join(
            UPLOAD_DIR,
            pdf.filename
        );

    res.download(
        filePath,
        pdf.original_name
    );
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(PUBLIC_DIR));

app.use(
    "/uploads",
    express.static(UPLOAD_DIR, {
        setHeaders: (res) => {
            res.setHeader("Content-Disposition", "inline");
            res.setHeader("X-Content-Type-Options", "nosniff");
        }
    })
);

/* =========================
   DATABASE
========================= */

const db = new Database(path.join(ROOT, "database.db"));

db.pragma("journal_mode = WAL");

db.exec(`
    CREATE TABLE IF NOT EXISTS pdfs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        module TEXT NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

/* =========================
   MULTER
========================= */

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },

    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();

        const uniqueName =
            Date.now() +
            "-" +
            Math.random().toString(36).substring(2, 10) +
            extension;

        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,

    limits: {
        fileSize: 100 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();

        if (extension !== ".pdf") {
            return cb(new Error("Only PDF files are allowed."));
        }

        cb(null, true);
    }
});

/* =========================
   AUTHENTICATION
========================= */

function adminAuth(req, res, next) {
    const password = req.headers["x-admin-password"];

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });
    }

    next();
}

/* =========================
   PUBLIC API
========================= */

app.get("/api/pdfs", (req, res) => {
    const pdfs = db
        .prepare(`
            SELECT
                id,
                title,
                module,
                filename,
                original_name,
                created_at,
                updated_at
            FROM pdfs
            ORDER BY created_at DESC
        `)
        .all();

    res.json({
        success: true,
        data: pdfs
    });
});

/* =========================
   ADMIN LOGIN
========================= */

app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({
            success: false,
            message: "Incorrect password"
        });
    }

    res.json({
        success: true,
        message: "Login successful"
    });
});

/* =========================
   CREATE PDF
========================= */

app.post(
    "/api/admin/pdfs",
    adminAuth,
    upload.single("pdf"),
    (req, res) => {

        try {

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "PDF file is required."
                });
            }

            const title = String(req.body.title || "").trim();
            const module = String(req.body.module || "").trim();

            if (!title || !module) {

                fs.unlinkSync(
                    path.join(UPLOAD_DIR, req.file.filename)
                );

                return res.status(400).json({
                    success: false,
                    message: "Title and module are required."
                });
            }

            const result = db
                .prepare(`
                    INSERT INTO pdfs
                    (
                        title,
                        module,
                        filename,
                        original_name
                    )
                    VALUES (?, ?, ?, ?)
                `)
                .run(
                    title,
                    module,
                    req.file.filename,
                    req.file.originalname
                );

            const pdf = db
                .prepare(`
                    SELECT *
                    FROM pdfs
                    WHERE id = ?
                `)
                .get(result.lastInsertRowid);

            io.emit("pdf:created", pdf);

            res.json({
                success: true,
                data: pdf
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Upload failed."
            });
        }
    }
);

/* =========================
   UPDATE PDF
========================= */

app.put("/api/admin/pdfs/:id", adminAuth, (req, res) => {

    const id = Number(req.params.id);

    const title = String(req.body.title || "").trim();
    const module = String(req.body.module || "").trim();

    if (!title || !module) {
        return res.status(400).json({
            success: false,
            message: "Title and module are required."
        });
    }

    const existing = db
        .prepare("SELECT * FROM pdfs WHERE id = ?")
        .get(id);

    if (!existing) {
        return res.status(404).json({
            success: false,
            message: "PDF not found."
        });
    }

    db.prepare(`
        UPDATE pdfs
        SET
            title = ?,
            module = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        title,
        module,
        id
    );

    const updated = db
        .prepare("SELECT * FROM pdfs WHERE id = ?")
        .get(id);

    io.emit("pdf:updated", updated);

    res.json({
        success: true,
        data: updated
    });
});

/* =========================
   DELETE PDF
========================= */

app.delete("/api/admin/pdfs/:id", adminAuth, (req, res) => {

    const id = Number(req.params.id);

    const pdf = db
        .prepare("SELECT * FROM pdfs WHERE id = ?")
        .get(id);

    if (!pdf) {
        return res.status(404).json({
            success: false,
            message: "PDF not found."
        });
    }

    const filePath = path.join(
        UPLOAD_DIR,
        pdf.filename
    );

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    db.prepare(
        "DELETE FROM pdfs WHERE id = ?"
    ).run(id);

    io.emit("pdf:deleted", {
        id
    });

    res.json({
        success: true,
        message: "PDF deleted successfully."
    });
});

/* =========================
   ADMIN STATISTICS
========================= */

app.get("/api/admin/stats", adminAuth, (req, res) => {

    const total = db
        .prepare("SELECT COUNT(*) AS count FROM pdfs")
        .get().count;

    const modules = db
        .prepare(`
            SELECT COUNT(DISTINCT module) AS count
            FROM pdfs
        `)
        .get().count;

    res.json({
        success: true,
        data: {
            total,
            modules
        }
    });
});

/* =========================
   ERROR HANDLER
========================= */

app.use((error, req, res, next) => {

    console.error(error);

    res.status(500).json({
        success: false,
        message: error.message || "Server error."
    });
});

/* =========================
   SOCKET.IO
========================= */

io.on("connection", (socket) => {

    console.log(
        "Client connected:",
        socket.id
    );

    socket.on("disconnect", () => {

        console.log(
            "Client disconnected:",
            socket.id
        );
    });
});

/* =========================
   START
========================= */

server.listen(PORT, () => {

    console.log("");
    console.log("=================================");
    console.log(" PDF PLATFORM SERVER");
    console.log("=================================");
    console.log("");
    console.log(
        `Website: http://localhost:${PORT}`
    );
    console.log(
        `Developer: http://localhost:${PORT}/admin.html`
    );
    console.log("");
});