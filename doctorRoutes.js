import doctorController from "../controllers/doctorController.js";

// Send JSON data to the frontend.
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
}

function validId(value) {
    if (typeof value !== "number" && typeof value !== "string") return null;
    if (!/^[1-9]\d*$/.test(String(value))) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
}

// The team's authentication code must attach a VERIFIED user to req.user.
// Never accept doctor IDs from URL parameters, request bodies, or headers.
function getAuthenticatedDoctorId(req) {
    if (req.user?.role !== "doctor") return null;
    return validId(req.user.DOCTOR_Doctor_ID ?? req.user.doctorId);
}

// Exported function for the existing app.js (no new server).
// Optional dependencies allow testing without a real database.
export function createDoctorRoutes({
    controller = doctorController,
    getDoctorId = getAuthenticatedDoctorId
} = {}) {
    return async function doctorRoutes(req, res) {
        const url = new URL(req.url, "http://localhost");
        const path = url.pathname;

        // Let the shared app handle routes belonging to other portals.
        if (path !== "/api/doctor" && !path.startsWith("/api/doctor/")) {
            return false;
        }

        // Health check only verifies routing (no patient data returned).
        if (path === "/api/doctor/health" && req.method === "GET") {
            sendJSON(res, 200, { message: "Doctor routes are working" });
            return true;
        }

        // All other doctor endpoints require a verified doctor login.
        const doctorId = validId(await getDoctorId(req));
        if (!doctorId) {
            sendJSON(res, 401, { message: "Doctor login required" });
            return true;
        }

        if (req.method !== "GET") {
            sendJSON(res, 405, { message: "Doctor endpoints are read-only for now" });
            return true;
        }

        try {
            if (path === "/api/doctor/dashboard") {
                sendJSON(res, 200, await controller.getDashboard(doctorId));
            } else if (path === "/api/doctor/profile") {
                const profile = await controller.getProfile(doctorId);
                sendJSON(res, profile ? 200 : 404,
                    profile || { message: "Doctor profile not found" });
            } else if (path === "/api/doctor/patients") {
                sendJSON(res, 200, await controller.getPatients(doctorId));
            } else if (/^\/api\/doctor\/patients\/[^/]+\/records$/.test(path)) {
                const patientId = validId(path.split("/")[4]);
                if (!patientId) {
                    sendJSON(res, 400, { message: "Invalid patient ID" });
                } else {
                    const records = await controller.getPatientRecords(doctorId, patientId);
                    sendJSON(res, records ? 200 : 404,
                        records || { message: "Patient record not found" });
                }
            } else if (path === "/api/doctor/appointments") {
                const scope = url.searchParams.get("scope") || "upcoming";
                if (!["upcoming", "past", "all"].includes(scope)) {
                    sendJSON(res, 400, { message: "Invalid appointment scope" });
                } else {
                    sendJSON(res, 200, await controller.getAppointments(doctorId, scope));
                }
            } else if (path === "/api/doctor/schedule") {
                sendJSON(res, 200, await controller.getSchedule(doctorId));
            } else if (path === "/api/doctor/referrals") {
                const status = url.searchParams.get("status") || "all";
                if (!["all", "Pending", "Approved", "Denied", "Canceled"].includes(status)) {
                    sendJSON(res, 400, { message: "Invalid referral status" });
                } else {
                    sendJSON(res, 200, await controller.getReferrals(doctorId, status));
                }
            } else if (path === "/api/doctor/settings") {
                const settings = await controller.getSettings(doctorId);
                sendJSON(res, settings ? 200 : 404,
                    settings || { message: "Doctor not found" });
            } else {
                sendJSON(res, 404, { message: "Doctor route not found" });
            }
        } catch (error) {
            console.error("Doctor route error:", error);
            if (!res.headersSent) {
                sendJSON(res, 500, { message: "Unable to load doctor information" });
            } else if (!res.writableEnded) {
                res.end();
            }
        }

        return true;
    };
}

export default createDoctorRoutes();
