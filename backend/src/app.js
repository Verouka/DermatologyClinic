
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

const app = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5500");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    try {
        if (await handleAuthRoutes(req, res)) return;

        if (await handlePublicAppointmentRoutes(req, res)) return;

        if (await handlePatientRoutes(req, res)) return;

        if (await handlePatientDoctorRoutes(req, res)) return;

        if (await handlePatientAppointmentRoutes(req, res)) return;

        if (await handleAppointmentOptionsRoutes(req, res)) return;

        if (await handlePatientMedicalRecordsRoutes(req, res)) return;

        if (await handleNurseProfileRoutes(req, res)) return;

        if (await handleNurseScheduleRoutes(req, res)) return;

       if (await handleNursePatientRoutes(req, res)) return;

        if (await handleAdminStaffRoutes(req, res)) return;

        if (await handlePatientSettingsRoutes(req, res)) {
            return;
        }

        if (await handlePatientNotificationRoutes(req, res)) {
            return;
        }

        if (await handlePatientBillingRoutes(req, res)) {
            return;
        }

        if (await handleNurseAppointmentRoutes(req, res)) {
            return;
        }

        if (await handleNurseDashboardRoutes(req, res)) {
           return;
        }

        if (req.method === "GET" && req.url === "/") {
            res.writeHead(200, {
                "Content-Type": "text/plain"
            });

            res.end("Dermatology Clinic Backend is running!");
            return;
        }

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


