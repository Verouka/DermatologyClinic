import { handleAdminStaffRoutes } from "./routes/adminStaffRoutes.js";
import { handleAuthRoutes } from "./routes/Authentication_route.js";
import { handlePatientRoutes } from "./routes/patientRoutes.js";
import { handleAdminProfileRoutes } from "./routes/adminProfileRoutes.js";
import { handleAdminSettingsRoutes } from "./routes/adminSettingsRoutes.js";
import { handleAdminAppointmentsRoutes } from "./routes/adminAppointmentsRoutes.js";
import { handleAdminBillingRoutes } from "./routes/adminBillingRoutes.js";
import { handleAdminClinicInfoRoutes } from "./routes/adminClinicInfoRoutes.js";
import { handleAdminDashboardRoutes } from "./routes/adminDashboardRoutes.js";
import { handleAdminNotificationRoutes } from "./routes/adminNotificationRoutes.js";
import { handleAdminReportRoutes } from "./routes/adminReportRoutes.js";
import { handleAdminScheduleRoutes } from "./routes/adminScheduleRoutes.js";

import { handlePatientAppointmentRoutes } from "./routes/patientAppointmentRoutes.js";
import { handleAppointmentOptionsRoutes } from "./routes/appointmentOptionsRoutes.js";
import { handlePatientMedicalRecordsRoutes } from "./routes/patientMedicalRecordsRoutes.js";
import { handlePatientSettingsRoutes } from "./routes/patientSettingsRoutes.js";
import { handlePatientNotificationRoutes } from "./routes/patientNotificationRoutes.js";
import { handlePatientBillingRoutes } from "./routes/patientBillingRoutes.js";
import { handlePatientDoctorRoutes } from "./routes/patientDoctorRoutes.js";
import { handlePublicAppointmentRoutes } from "./routes/publicAppointmentRoutes.js";

const app = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5500");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PATCH, DELETE, OPTIONS"
    );
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    try {
        // Authentication
        if (await handleAuthRoutes(req, res)) return;

        // Public routes
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

        // Admin routes
        if (await handleAdminStaffRoutes(req, res)) return;
        if (await handleAdminProfileRoutes(req, res)) return;
        if (await handleAdminSettingsRoutes(req, res)) return;
        if (await handleAdminAppointmentsRoutes(req, res)) return;
        if (await handleAdminBillingRoutes(req, res)) return;
        if (await handleAdminClinicInfoRoutes(req, res)) return;
        if (await handleAdminDashboardRoutes(req, res)) return;
        if (await handleAdminNotificationRoutes(req, res)) return;
        if (await handleAdminReportRoutes(req, res)) return;
        if (await handleAdminScheduleRoutes(req, res)) return;

        // Health check
        if (req.method === "GET" && req.url === "/") {
            res.writeHead(200, {
                "Content-Type": "text/plain"
            });

            res.end("Dermatology Clinic Backend is running!");
            return;
        }

        // Route not found
        res.writeHead(404, {
            "Content-Type": "application/json"
        });

        res.end(JSON.stringify({
            error: "Route not found"
        }));

    } catch (error) {
        console.error("Server error:", error);

        if (!res.headersSent) {
            res.writeHead(500, {
                "Content-Type": "application/json"
            });
        }

        if (!res.writableEnded) {
            res.end(JSON.stringify({
                error: "Internal server error"
            }));
        }
    }
};

export default app;