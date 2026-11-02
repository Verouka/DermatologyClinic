
import pool from "../database.js";
import { hashPassword } from "../utils/password.js";
import { getSession } from "../services/sessionService.js";

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json"
    });
    res.end(JSON.stringify(data));
}

const validId = (value) =>
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0;

export async function handleAdminStaffRoutes(req, res) {
    const pathname = new URL(req.url, "http://localhost").pathname;

    const staffRoutes = [
        "/api/admin/staff",
        "/api/admin/loadDoctors",
        "/api/admin/loadNurses",
        "/api/admin/loadReceptionists"
    ];

    if (!staffRoutes.includes(pathname)) {
        return false;
    }

    const session = getSession(req);

    if (!session || session.role !== "administrator") {
        sendJSON(res, 403, {
            error: "Administrator access required"
        });
        return true;
    }

    // GET ALL DOCTORS
    if (req.method === "GET" && pathname === "/api/admin/loadDoctors") {
        try {
            const [doctors] = await pool.execute(`
                SELECT
                    Doctor_ID AS id,
                    First_Name AS firstName,
                    Last_Name AS lastName,
                    SPECIALTY_Specialty_ID AS specialtyId
                FROM doctor
                ORDER BY Last_Name, First_Name
            `);

            sendJSON(res, 200, doctors);
        } catch (error) {
            console.error("Error loading doctors:", error);
            sendJSON(res, 500, {
                error: "Could not load doctors"
            });
        }

        return true;
    }

    // GET ALL NURSES
    if (req.method === "GET" && pathname === "/api/admin/loadNurses") {
        try {
            const [nurses] = await pool.execute(`
                SELECT
                    Nurse_ID AS id,
                    First_Name AS firstName,
                    Last_Name AS lastName
                FROM nurse
                ORDER BY Last_Name, First_Name
            `);

            sendJSON(res, 200, nurses);
        } catch (error) {
            console.error("Error loading nurses:", error);
            sendJSON(res, 500, {
                error: "Could not load nurses"
            });
        }

        return true;
    }

    // GET ALL RECEPTIONISTS
    if (
        req.method === "GET" &&
        pathname === "/api/admin/loadReceptionists"
    ) {
        try {
            const [receptionists] = await pool.execute(`
                SELECT
                    Receptionist_ID AS id,
                    First_Name AS firstName,
                    Last_Name AS lastName
                FROM receptionist
                ORDER BY Last_Name, First_Name
            `);

            sendJSON(res, 200, receptionists);
        } catch (error) {
            console.error("Error loading receptionists:", error);
            sendJSON(res, 500, {
                error: "Could not load receptionists"
            });
        }

        return true;
    }

    // CREATE STAFF ACCOUNT
    if (pathname === "/api/admin/staff" && req.method === "POST") {
        let body = "";

        for await (const chunk of req) {
            body += chunk;

            if (body.length > 10000) {
                sendJSON(res, 413, {
                    error: "Request too large"
                });
                return true;
            }
        }

        let data;

        try {
            data = JSON.parse(body);
        } catch {
            sendJSON(res, 400, {
                error: "Invalid JSON"
            });
            return true;
        }

        const {
            role,
            firstName,
            lastName,
            email,
            password,
            officeId,
            officeIds,
            specialtyId,
            nurseId
        } = data;

        if (
            !["doctor", "nurse", "receptionist"].includes(role) ||
            typeof firstName !== "string" ||
            !firstName.trim() ||
            typeof lastName !== "string" ||
            !lastName.trim() ||
            typeof email !== "string" ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
            typeof password !== "string" ||
            password.length < 12 ||
            password.length > 128 ||
            firstName.length > 45 ||
            lastName.length > 45 ||
            email.trim().length > 45
        ) {
            sendJSON(res, 400, {
                error: "Invalid staff information"
            });
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
            sendJSON(res, 400, {
                error: "Invalid staff assignments"
            });
            return true;
        }

        const normalizedEmail = email.trim().toLowerCase();

        let connection;

        try {
            const passwordHash = await hashPassword(password);
            connection = await pool.getConnection();

            await connection.beginTransaction();

            let staffId;
            let foreignKeyColumn;

            if (role === "nurse") {
                const [result] = await connection.execute(
                    `INSERT INTO nurse
                     (First_Name, Last_Name, Email, OFFICE_Office_ID)
                     VALUES (?, ?, ?, ?)`,
                    [
                        firstName.trim(),
                        lastName.trim(),
                        normalizedEmail,
                        Number(officeId)
                    ]
                );

                staffId = result.insertId;
                foreignKeyColumn = "NURSE_Nurse_ID";

            } else if (role === "receptionist") {
                const [result] = await connection.execute(
                    `INSERT INTO receptionist
                     (First_Name, Last_Name, Email, OFFICE_Office_ID)
                     VALUES (?, ?, ?, ?)`,
                    [
                        firstName.trim(),
                        lastName.trim(),
                        normalizedEmail,
                        Number(officeId)
                    ]
                );

                staffId = result.insertId;
                foreignKeyColumn = "RECEPTIONIST_Receptionist_ID";

            } else {
                const [result] = await connection.execute(
                    `INSERT INTO doctor
                     (First_Name, Last_Name, Email,
                      SPECIALTY_Specialty_ID, NURSE_Nurse_ID)
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        firstName.trim(),
                        lastName.trim(),
                        normalizedEmail,
                        Number(specialtyId),
                        Number(nurseId)
                    ]
                );

                staffId = result.insertId;
                foreignKeyColumn = "DOCTOR_Doctor_ID";

                for (const assignedOfficeId of officeIds) {
                    await connection.execute(
                        `INSERT INTO office_has_doctor
                         (OFFICE_Office_ID, DOCTOR_Doctor_ID)
                         VALUES (?, ?)`,
                        [Number(assignedOfficeId), staffId]
                    );
                }
            }

            await connection.execute(
                `INSERT INTO usercredential
                 (Email, Password_hash, role, ${foreignKeyColumn})
                 VALUES (?, ?, ?, ?)`,
                [
                    normalizedEmail,
                    passwordHash,
                    role,
                    staffId
                ]
            );

            await connection.commit();

            sendJSON(res, 201, {
                message: "Staff account created successfully",
                role,
                staffId
            });

        } catch (error) {
            if (connection) {
                await connection.rollback();
            }

            console.error("Staff creation error:", error);

            sendJSON(
                res,
                error.code === "ER_DUP_ENTRY" ? 409 : 500,
                {
                    error: error.code === "ER_DUP_ENTRY"
                        ? "Email already exists"
                        : "Could not create staff account"
                }
            );

        } finally {
            if (connection) {
                connection.release();
            }
        }

        return true;
    }

    sendJSON(res, 405, {
        error: "Method not allowed"
    });

    return true;
}

