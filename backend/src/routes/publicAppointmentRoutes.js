
import pool from "../database.js";

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify(data));
}

function readJSON(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        let tooLarge = false;

        req.on("data", chunk => {
            if (tooLarge) return;

            body += chunk;

            if (body.length > 10000) {
                tooLarge = true;
                reject(new Error("Request is too large"));
            }
        });

        req.on("end", () => {
            if (tooLarge) return;

            try {
                resolve(JSON.parse(body));
            } catch {
                reject(new Error("Invalid JSON"));
            }
        });

        req.on("error", reject);
    });
}

function isValidDate(value) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const date = new Date(value + "T00:00:00Z");

    return !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value;
}

export async function handlePublicAppointmentRoutes(req, res) {
    const pathname = new URL(
        req.url,
        "http://localhost"
    ).pathname;

    if (
        pathname !== "/api/public/appointment-requests" ||
        req.method !== "POST"
    ) {
        return false;
    }

    try {
        const data = await readJSON(req);

        if (!data || typeof data !== "object" || Array.isArray(data)) {
            sendJSON(res, 400, {
                error: "Invalid request data."
            });
            return true;
        }

        const firstName = String(data.firstName ?? "").trim();
        const lastName = String(data.lastName ?? "").trim();
        const email = String(data.email ?? "").trim();
        const phone = String(data.phone ?? "").trim();
        const currentPatient = data.currentPatient;
        const appointmentDate = data.appointmentDate;
        const reason = String(data.reason ?? "").trim();
        const message = String(data.message ?? "").trim();

        if (
            !firstName ||
            !lastName ||
            !email ||
            !phone ||
            !appointmentDate ||
            !reason ||
            !["yes", "no"].includes(currentPatient)
        ) {
            sendJSON(res, 400, {
                error: "Please complete all required fields."
            });
            return true;
        }

        if (
            firstName.length > 45 ||
            lastName.length > 45 ||
            email.length > 100 ||
            phone.length > 20 ||
            reason.length > 250 ||
            message.length > 500
        ) {
            sendJSON(res, 400, {
                error: "One or more fields are too long."
            });
            return true;
        }

        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            !/^\d{3}-\d{3}-\d{4}$/.test(phone)
        ) {
            sendJSON(res, 400, {
                error: "Please enter a valid email and phone number."
            });
            return true;
        }

        const today = new Date().toISOString().slice(0, 10);

        if (
            !isValidDate(appointmentDate) ||
            appointmentDate < today
        ) {
            sendJSON(res, 400, {
                error: "Please choose a valid appointment date."
            });
            return true;
        }

        const sql = `
            INSERT INTO appointment_request (
                First_Name,
                Last_Name,
                Email,
                Phone,
                Current_Patient,
                Preferred_Date,
                Reason,
                Additional_Message,
                Request_Status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
        `;

        const [result] = await pool.execute(sql, [
            firstName,
            lastName,
            email,
            phone,
            currentPatient,
            appointmentDate,
            reason,
            message || null
        ]);

        sendJSON(res, 201, {
            message: "Appointment request submitted successfully.",
            requestId: result.insertId
        });

    } catch (error) {
        console.error("Public appointment error:", error);

        if (
            error.message === "Invalid JSON" ||
            error.message === "Request is too large"
        ) {
            sendJSON(res, 400, {
                error: error.message
            });
        } else {
            sendJSON(res, 500, {
                error: "Could not save appointment request."
            });
        }
    }

    return true;
}
