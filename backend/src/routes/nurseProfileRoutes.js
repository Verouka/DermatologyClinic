import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

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

function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validProfile(data) {
    return (
        data.firstName &&
        data.lastName &&
        data.email &&
        data.firstName.length <= 45 &&
        data.lastName.length <= 45 &&
        data.email.length <= 100 &&
        validEmail(data.email) &&
        data.phone.length <= 20 &&
        data.street.length <= 100 &&
        data.city.length <= 45 &&
        data.state.length <= 45 &&
        /^\d{5}$/.test(data.zipCode)
    );
}

export async function handleNurseProfileRoutes(req, res) {
    const pathname = new URL(
        req.url,
        "http://localhost"
    ).pathname;

    if (pathname !== "/api/nurse/profile") {
        return false;
    }

    if (!["GET", "PATCH"].includes(req.method)) {
        sendJSON(res, 405, {
            error: "Method not allowed."
        });
        return true;
    }

    try {
        const session = getSession(req);

        if (!session) {
            sendJSON(res, 401, {
                error: "Please log in first."
            });
            return true;
        }

        if (String(session.role).toLowerCase() !== "nurse") {
            sendJSON(res, 403, {
                error: "Nurse access only."
            });
            return true;
        }

        // IMPORTANT:
        // Confirm your session stores nurseId.
        // If it uses a different property, update this line.
        const nurseId = Number(session.nurseId);

        if (!Number.isInteger(nurseId) || nurseId <= 0) {
            sendJSON(res, 403, {
                error: "No nurse record is linked to this account."
            });
            return true;
        }

        if (req.method === "GET") {
            const [rows] = await pool.execute(
                `
                SELECT
                    Nurse_ID,
                    License_Number,
                    First_Name,
                    Last_Name,
                    Email,
                    Phone,
                    Street,
                    City,
                    State,
                    Zip_Code,
                    OFFICE_Office_ID,
                    DATE_FORMAT(Start_Date, '%Y-%m-%d') AS Start_Date
                FROM nurse
                WHERE Nurse_ID = ?
                LIMIT 1
                `,
                [nurseId]
            );

            if (rows.length === 0) {
                sendJSON(res, 404, {
                    error: "Nurse profile not found."
                });
                return true;
            }

            sendJSON(res, 200, rows[0]);
            return true;
        }

        const body = await readJSON(req);

        if (!body || typeof body !== "object" ||
            Array.isArray(body)) {
            sendJSON(res, 400, {
                error: "Invalid profile information."
            });
            return true;
        }

        const data = {
            firstName: String(body.firstName ?? "").trim(),
            lastName: String(body.lastName ?? "").trim(),
            email: String(body.email ?? "").trim(),
            phone: String(body.phone ?? "").trim(),
            street: String(body.street ?? "").trim(),
            city: String(body.city ?? "").trim(),
            state: String(body.state ?? "").trim(),
            zipCode: String(body.zipCode ?? "").trim()
        };

        if (!validProfile(data)) {
            sendJSON(res, 400, {
                error: "Please check your profile information."
            });
            return true;
        }

        const [result] = await pool.execute(
            `
            UPDATE nurse
            SET
                First_Name = ?,
                Last_Name = ?,
                Email = ?,
                Phone = ?,
                Street = ?,
                City = ?,
                State = ?,
                Zip_Code = ?
            WHERE Nurse_ID = ?
            `,
            [
                data.firstName,
                data.lastName,
                data.email,
                data.phone,
                data.street,
                data.city,
                data.state,
                data.zipCode,
                nurseId
            ]
        );

        if (result.affectedRows === 0) {
            sendJSON(res, 404, {
                error: "Nurse profile not found."
            });
            return true;
        }

        sendJSON(res, 200, {
            message: "Profile updated successfully."
        });

    } catch (error) {
        console.error("Nurse profile route error:", error);

        if (
            error.message === "Invalid JSON" ||
            error.message === "Request is too large"
        ) {
            sendJSON(res, 400, {
                error: error.message
            });
        } else if (error.code === "ER_DUP_ENTRY") {
            sendJSON(res, 409, {
                error: "This email is already in use."
            });
        } else {
            sendJSON(res, 500, {
                error: "Could not process nurse profile."
            });
        }

        return true;
    }
}