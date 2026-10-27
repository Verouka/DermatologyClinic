<<<<<<< Updated upstream


=======
>>>>>>> Stashed changes
import pool from "../database.js";
import { hashPassword } from "../utils/password.js";
import { getSession } from "../services/sessionService.js";

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json"
    });
    res.end(JSON.stringify(data));
}

export async function handleAdminStaffRoutes(req, res) {
<<<<<<< Updated upstream
=======
    const routes = {
        "/api/admin/loadDoctors": {
            query: `
                SELECT
                    Doctor_ID AS id,
                    First_Name AS firstName,
                    Last_Name AS lastName,
                    SPECIALTY_Specialty_ID AS specialtyId
                FROM doctor
                ORDER BY Last_Name, First_Name
            `,
            error: "Could not load doctors"
        },

        "/api/admin/loadNurses": {
            query: `
                SELECT
                    Nurse_ID AS id,
                    First_Name AS firstName,
                    Last_Name AS lastName,
                    OFFICE_Office_ID AS officeId
                FROM nurse
                ORDER BY Last_Name, First_Name
            `,
            error: "Could not load nurses"
        },

        "/api/admin/loadReceptionists": {
            query: `
                SELECT
                    Receptionist_ID AS id,
                    First_Name AS firstName,
                    Last_Name AS lastName,
                    OFFICE_Office_ID AS officeId
                FROM receptionist
                ORDER BY Last_Name, First_Name
            `,
            error: "Could not load receptionists"
        }
    };

    // LOAD DOCTORS, NURSES, OR RECEPTIONISTS
    if (req.method === "GET" && routes[req.url]) {
        const session = getSession(req);

        //why the f is the session not marked
        /*if (!session || session.role !== "administrator") {
            sendJSON(res, 403, {
                error: "Administrator access required"
            });
            return true;
        }*/

        const route = routes[req.url];

        try {
            const [rows] = await pool.execute(route.query);
            sendJSON(res, 200, rows);
        } catch (error) {
            console.error(`${req.url} error:`, error);

            sendJSON(res, 500, {
                error: route.error
            });
        }

        return true;
    }

    // CREATE STAFF
>>>>>>> Stashed changes
    if (req.method !== "POST" || req.url !== "/api/admin/staff") {
        return false;
    }

    const session = getSession(req);

    if (!session || session.role !== "administrator") {
<<<<<<< Updated upstream
        sendJSON(res, 403, { error: "Administrator access required" });
=======
        sendJSON(res, 403, {
            error: "Administrator access required"
        });
>>>>>>> Stashed changes
        return true;
    }

    let body = "";

<<<<<<< Updated upstream
    for await (const chunk of req) {
        body += chunk;

        if (body.length > 10000) {
            sendJSON(res, 413, { error: "Request too large" });
            return true;
        }
=======
    try {
        for await (const chunk of req) {
            body += chunk;

            if (body.length > 10000) {
                sendJSON(res, 413, {
                    error: "Request too large"
                });
                return true;
            }
        }
    } catch (error) {
        console.error("Error reading request body:", error);

        sendJSON(res, 400, {
            error: "Could not read request body"
        });
        return true;
>>>>>>> Stashed changes
    }

    let data;

    try {
        data = JSON.parse(body);
    } catch {
<<<<<<< Updated upstream
        sendJSON(res, 400, { error: "Invalid JSON" });
=======
        sendJSON(res, 400, {
            error: "Invalid JSON"
        });
>>>>>>> Stashed changes
        return true;
    }

    const {
<<<<<<< Updated upstream
        role, firstName, lastName, email, password,
        officeId, officeIds, specialtyId, nurseId
=======
        role,
        firstName,
        lastName,
        email,
        password,
        officeId,
        officeIds,
        specialtyId,
        nurseId
>>>>>>> Stashed changes
    } = data;

    const validId = (value) =>
        Number.isSafeInteger(Number(value)) && Number(value) > 0;

    if (
        !["doctor", "nurse", "receptionist"].includes(role) ||
<<<<<<< Updated upstream
        typeof firstName !== "string" || !firstName.trim() ||
        typeof lastName !== "string" || !lastName.trim() ||
=======
        typeof firstName !== "string" ||
        !firstName.trim() ||
        typeof lastName !== "string" ||
        !lastName.trim() ||
>>>>>>> Stashed changes
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        typeof password !== "string" ||
        password.length < 12 ||
        password.length > 128 ||
<<<<<<< Updated upstream
        firstName.length > 45 ||
        lastName.length > 45 ||
        email.trim().length > 45
    ) {
        sendJSON(res, 400, { error: "Invalid staff information" });
=======
        firstName.trim().length > 45 ||
        lastName.trim().length > 45 ||
        email.trim().length > 45
    ) {
        sendJSON(res, 400, {
            error: "Invalid staff information"
        });
>>>>>>> Stashed changes
        return true;
    }

    if (
        role === "doctor"
            ? !validId(specialtyId) ||
              !validId(nurseId) ||
              !Array.isArray(officeIds) ||
              officeIds.length === 0 ||
              !officeIds.every(validId) ||
              new Set(officeIds.map(Number)).size !== officeIds.length
            : !validId(officeId)
    ) {
<<<<<<< Updated upstream
        sendJSON(res, 400, { error: "Invalid staff assignments" });
=======
        sendJSON(res, 400, {
            error: "Invalid staff assignments"
        });
>>>>>>> Stashed changes
        return true;
    }

    const normalizedEmail = email.trim().toLowerCase();
<<<<<<< Updated upstream
    const passwordHash = await hashPassword(password);
    const connection = await pool.getConnection();

    try {
=======

    let passwordHash;

    try {
        passwordHash = await hashPassword(password);
    } catch (error) {
        console.error("Password hashing error:", error);

        sendJSON(res, 500, {
            error: "Could not create staff account"
        });
        return true;
    }

    let connection;

    try {
        connection = await pool.getConnection();
>>>>>>> Stashed changes
        await connection.beginTransaction();

        let staffId;
        let foreignKeyColumn;

        if (role === "nurse") {
            const [result] = await connection.execute(
                `INSERT INTO nurse
<<<<<<< Updated upstream
                 (First_Name, Last_Name, Email, OFFICE_Office_ID)
                 VALUES (?, ?, ?, ?)`,
                [firstName.trim(), lastName.trim(),
                 normalizedEmail, Number(officeId)]
=======
                    (First_Name, Last_Name, Email, OFFICE_Office_ID)
                 VALUES (?, ?, ?, ?)`,
                [
                    firstName.trim(),
                    lastName.trim(),
                    normalizedEmail,
                    Number(officeId)
                ]
>>>>>>> Stashed changes
            );

            staffId = result.insertId;
            foreignKeyColumn = "NURSE_Nurse_ID";

        } else if (role === "receptionist") {
            const [result] = await connection.execute(
                `INSERT INTO receptionist
<<<<<<< Updated upstream
                 (First_Name, Last_Name, Email, OFFICE_Office_ID)
                 VALUES (?, ?, ?, ?)`,
                [firstName.trim(), lastName.trim(),
                 normalizedEmail, Number(officeId)]
=======
                    (First_Name, Last_Name, Email, OFFICE_Office_ID)
                 VALUES (?, ?, ?, ?)`,
                [
                    firstName.trim(),
                    lastName.trim(),
                    normalizedEmail,
                    Number(officeId)
                ]
>>>>>>> Stashed changes
            );

            staffId = result.insertId;
            foreignKeyColumn = "RECEPTIONIST_Receptionist_ID";

        } else {
            const [result] = await connection.execute(
                `INSERT INTO doctor
<<<<<<< Updated upstream
                 (First_Name, Last_Name, Email,
                  SPECIALTY_Specialty_ID, NURSE_Nurse_ID)
                 VALUES (?, ?, ?, ?, ?)`,
                [firstName.trim(), lastName.trim(),
                 normalizedEmail, Number(specialtyId), Number(nurseId)]
=======
                    (
                        First_Name,
                        Last_Name,
                        Email,
                        SPECIALTY_Specialty_ID,
                        NURSE_Nurse_ID
                    )
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    firstName.trim(),
                    lastName.trim(),
                    normalizedEmail,
                    Number(specialtyId),
                    Number(nurseId)
                ]
>>>>>>> Stashed changes
            );

            staffId = result.insertId;
            foreignKeyColumn = "DOCTOR_Doctor_ID";

<<<<<<< Updated upstream
            // Insert each assigned office into the junction table.
            // Confirm its exact column names before enabling this block.
            for (const assignedOfficeId of officeIds) {
                await connection.execute(
                    `INSERT INTO office_has_doctor
                     (OFFICE_Office_ID, DOCTOR_Doctor_ID)
=======
            for (const assignedOfficeId of officeIds) {
                await connection.execute(
                    `INSERT INTO office_has_doctor
                        (OFFICE_Office_ID, DOCTOR_Doctor_ID)
>>>>>>> Stashed changes
                     VALUES (?, ?)`,
                    [Number(assignedOfficeId), staffId]
                );
            }
        }

        await connection.execute(
            `INSERT INTO usercredential
<<<<<<< Updated upstream
             (Email, Password_hash, role, ${foreignKeyColumn})
=======
                (Email, Password_hash, role, ${foreignKeyColumn})
>>>>>>> Stashed changes
             VALUES (?, ?, ?, ?)`,
            [normalizedEmail, passwordHash, role, staffId]
        );

        await connection.commit();

        sendJSON(res, 201, {
            message: "Staff account created successfully",
            role,
            staffId
        });

    } catch (error) {
<<<<<<< Updated upstream
        await connection.rollback();
=======
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error("Transaction rollback error:", rollbackError);
            }
        }

>>>>>>> Stashed changes
        console.error("Staff creation error:", error);

        sendJSON(res, error.code === "ER_DUP_ENTRY" ? 409 : 500, {
            error: error.code === "ER_DUP_ENTRY"
                ? "Email already exists"
                : "Could not create staff account"
        });

    } finally {
<<<<<<< Updated upstream
        connection.release();
    }

    return true;
}
=======
        if (connection) {
            connection.release();
        }
    }

    return true;
}
>>>>>>> Stashed changes
