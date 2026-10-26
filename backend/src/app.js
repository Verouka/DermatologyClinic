
import pool from "./database.js";

const sendJSON = (res, statusCode, data) => {
    res.writeHead(statusCode, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "http://localhost:5500",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    });

    res.end(JSON.stringify(data));
};

const readBody = (req) =>
    new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk;
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

const app = async (req, res) => {
    if (req.method === "OPTIONS") {
        res.writeHead(204, {
            "Access-Control-Allow-Origin": "http://localhost:5500",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        });
        return res.end();
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    try {
        if (req.method === "GET" && path === "/") {
            res.writeHead(200, { "Content-Type": "text/plain" });
            return res.end("Dermatology Clinic Backend is running!");
        }

        if (req.method === "GET" && path === "/api/patients") {
            const [rows] = await pool.query(`
                SELECT
                    Patient_ID AS id,
                    First_Name AS firstName,
                    Last_Name AS lastName,
                    BirthDate AS dob,
                    Phone AS phone,
                    Email AS email,
                    CONCAT_WS(', ', Street, City, State, Zip_Code) AS address
                FROM patient
                ORDER BY Last_Name, First_Name
            `);

            return sendJSON(res, 200, rows);
        }

        if (req.method === "POST" && path === "/api/patients") {
            const body = await readBody(req);

            const {
                firstName,
                lastName,
                dob,
                phone,
                email,
                address
            } = body;

            if (!firstName || !lastName || !dob || !phone || !email) {
                return sendJSON(res, 400, {
                    error: "First name, last name, date of birth, phone, and email are required."
                });
            }

            const addressParts = (address || "")
                .split(",")
                .map(part => part.trim());

            const [result] = await pool.execute(`
                INSERT INTO patient
                    (First_Name, Last_Name, Email, BirthDate, Phone,
                     Street, City, State, Zip_Code, Date_Admitted)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())
            `, [
                firstName.trim(),
                lastName.trim(),
                email.trim(),
                dob,
                phone.trim(),
                addressParts[0] || null,
                addressParts[1] || null,
                addressParts[2] || null,
                addressParts[3] || null
            ]);

            return sendJSON(res, 201, {
                id: result.insertId,
                firstName,
                lastName,
                dob,
                phone,
                email,
                address: address || ""
            });
        }

        return sendJSON(res, 404, { error: "Endpoint not found." });
    } catch (error) {
        console.error("API error:", error.message);

        if (error.code === "ER_DUP_ENTRY") {
            return sendJSON(res, 409, {
                error: "A patient with this email already exists."
            });
        }

        return sendJSON(res, 500, {
            error: "The request could not be completed."
        });
    }
};

export default app;
