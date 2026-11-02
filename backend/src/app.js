
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { handleAdminStaffRoutes } from "./routes/adminStaffRoutes.js";
import { handleAuthRoutes } from "./routes/Authentication_route.js";

import { handlePatientRoutes } from "./routes/patientRoutes.js";
import { handlePatientAppointmentRoutes } from "./routes/patientAppointmentRoutes.js";
import { handleAppointmentOptionsRoutes } from "./routes/appointmentOptionsRoutes.js";
import { handlePatientMedicalRecordsRoutes } from "./routes/patientMedicalRecordsRoutes.js";
import { handlePatientSettingsRoutes } from "./routes/patientSettingsRoutes.js";
import { handlePatientNotificationRoutes } from "./routes/patientNotificationRoutes.js";
import { handlePatientBillingRoutes } from "./routes/patientBillingRoutes.js";
import { handlePatientDoctorRoutes } from "./routes/patientDoctorRoutes.js";
import { handlePublicAppointmentRoutes } from "./routes/publicAppointmentRoutes.js";

import { handleNurseProfileRoutes } from "./routes/nurseProfileRoutes.js";
import { handleNurseScheduleRoutes } from "./routes/nurseScheduleRoutes.js";
import { handleNursePatientRoutes } from "./routes/nursePatientRoutes.js";
import { handleNurseAppointmentRoutes } from "./routes/nurseAppointmentRoutes.js";
import { handleNurseDashboardRoutes } from "./routes/nurseDashBoardRoutes.js";

import { handleDoctorAppointmentRoutes } from "./routes/doctorAppointmentRoutes.js";
import { handleDoctorRoutes } from "./routes/doctorRoutes.js";
import { handleDoctorPatientRoutes } from "./routes/doctorPatientRoutes.js";
import { handleDoctorReferralRoutes } from "./routes/doctorReferralRoutes.js";
import { handleDoctorSettingsRoutes } from "./routes/doctorSettingsRoutes.js";
import { handleDoctorNotificationRoutes } from "./routes/doctorNotificationRoutes.js";
import { handleDoctorPatientRecordEntryRoutes } from "./routes/doctorPatientRecordEntryRoutes.js";
import { handleDoctorPatientManagementRoutes } from "./routes/doctorPatientManagementRoutes.js";
import { handleDoctorScheduleRoutes } from "./routes/doctorScheduleRoutes.js";

import { handleAdminProfileRoutes } from "./routes/adminProfileRoutes.js";
import { handleAdminAppointmentsRoutes } from "./routes/adminAppointmentsRoutes.js";
import { handleAdminBillingRoutes } from "./routes/adminBillingRoutes.js";
import { handleAdminClinicInfoRoutes } from "./routes/adminClinicInfoRoutes.js";
import { handleAdminDashboardRoutes } from "./routes/adminDashboardRoutes.js";

import { handleReceptionistRoutes } from "./routes/receptionistRoutes.js";

// Allowed local development origins
const allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500"
];

// Project structure:
// DermatologyClinic/
//   HomePage.html
//   LoginPage.html
//   AppointmentForm.html
//   style.css
//   Administrator/
//   Doctor/
//   Nurse/
//   Patient/
//   Receptionist/
//   backend/src/app.js

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "../..");

const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".woff": "font/woff",
    ".woff2": "font/woff2"
};

const readBody = (req) =>
    new Promise((resolve, reject) => {
        let body = "";

        req.on("data", (chunk) => {
            body += chunk;

            if (body.length > 1000000) {
                reject(new Error("Request body too large"));
                req.destroy();
            }
        });

        req.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch {
                reject(new Error("Invalid JSON request body"));
            }
        });

        req.on("error", reject);
    });

async function serveStaticFile(req, res, pathname) {
    if (req.method !== "GET" && req.method !== "HEAD") {
        return false;
    }

    // Never expose backend source or API paths.
    if (
        pathname === "/backend" ||
        pathname.startsWith("/backend/") ||
        pathname === "/api" ||
        pathname.startsWith("/api/")
    ) {
        return false;
    }

    let requestedPath;

    try {
        requestedPath = decodeURIComponent(pathname);
    } catch {
        return false;
    }

    if (
        requestedPath.includes("\0") ||
        requestedPath.includes("\\")
    ) {
        return false;
    }

    const relativePath = requestedPath.replace(/^\/+/, "");
    const filePath = path.resolve(frontendRoot, relativePath);
    const relative = path.relative(frontendRoot, filePath);

    // Prevent access outside the frontend project.
    if (
        relative.startsWith("..") ||
        path.isAbsolute(relative) ||
        relative.split(path.sep).some((part) => part.startsWith("."))
    ) {
        return false;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[extension];

    if (!contentType) {
        return false;
    }

    try {
        const stats = await fs.stat(filePath);

        if (!stats.isFile()) {
            return false;
        }

        const content = await fs.readFile(filePath);

        res.writeHead(200, {
            "Content-Type": contentType,
            "X-Content-Type-Options": "nosniff"
        });

        res.end(req.method === "HEAD" ? undefined : content);
        return true;

    } catch (error) {
        if (
            error.code === "ENOENT" ||
            error.code === "EISDIR" ||
            error.code === "ENOTDIR"
        ) {
            return false;
        }

        throw error;
    }
}

const app = async (req, res) => {
    const origin = req.headers.origin;

    if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Vary", "Origin");
    }

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PATCH, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    const requestPath = new URL(
        req.url,
        "http://localhost"
    ).pathname;

    const sendJSON = (response, statusCode, data) => {
        if (response.writableEnded) return;

        if (!response.headersSent) {
            response.writeHead(statusCode, {
                "Content-Type": "application/json"
            });
        }

        response.end(JSON.stringify(data));
    };

    try {
        // Main clinic homepage
        if (
            (req.method === "GET" || req.method === "HEAD") &&
            requestPath === "/"
        ) {
            res.writeHead(302, {
                Location: "/HomePage.html"
            });

            res.end();
            return;
        }

        // Authentication
        if (await handleAuthRoutes(req, res)) return;

        // Public appointments
        if (await handlePublicAppointmentRoutes(req, res)) return;

        // Patient routes
        if (await handlePatientRoutes(req, res)) return;
        if (await handlePatientDoctorRoutes(req, res)) return;
        if (await handlePatientAppointmentRoutes(req, res)) return;
        if (await handleAppointmentOptionsRoutes(req, res)) return;
        if (await handlePatientMedicalRecordsRoutes(req, res)) return;
        if (await handlePatientSettingsRoutes(req, res)) return;
        if (await handlePatientNotificationRoutes(req, res)) return;
        if (await handlePatientBillingRoutes(req, res)) return;

        // Administrator routes
        if (await handleAdminStaffRoutes(req, res)) return;
        if (await handleAdminProfileRoutes(req, res)) return;
        if (await handleAdminAppointmentsRoutes(req, res)) return;
        if (await handleAdminBillingRoutes(req, res)) return;
        if (await handleAdminClinicInfoRoutes(req, res)) return;
        if (await handleAdminDashboardRoutes(req, res)) return;

        // Nurse routes
        if (await handleNurseProfileRoutes(req, res)) return;
        if (await handleNurseScheduleRoutes(req, res)) return;
        if (await handleNursePatientRoutes(req, res)) return;
        if (await handleNurseAppointmentRoutes(req, res)) return;
        if (await handleNurseDashboardRoutes(req, res)) return;

        // Doctor routes
        if (await handleDoctorAppointmentRoutes(req, res)) return;
        if (await handleDoctorRoutes(req, res)) return;
        if (await handleDoctorPatientRoutes(req, res)) return;
        if (await handleDoctorReferralRoutes(req, res)) return;
        if (await handleDoctorNotificationRoutes(req, res)) return;
        if (await handleDoctorPatientRecordEntryRoutes(req, res)) return;
        if (await handleDoctorPatientManagementRoutes(req, res)) return;
        if (await handleDoctorScheduleRoutes(req, res)) return;
        if (await handleDoctorSettingsRoutes(req, res)) return;

        // Receptionist routes
        const receptionistHandled = await handleReceptionistRoutes(
            req,
            res,
            sendJSON,
            readBody,
            requestPath
        );

        if (receptionistHandled !== false) return;

        // Serve frontend files
        if (await serveStaticFile(req, res, requestPath)) return;

        // No matching route
        sendJSON(res, 404, {
            error: "Route not found"
        });

    } catch (error) {
        console.error("Server error:", error);

        if (!res.headersSent) {
            sendJSON(res, 500, {
                error: "Internal server error"
            });
        } else if (!res.writableEnded) {
            res.end();
        }
    }
};

export default app;




