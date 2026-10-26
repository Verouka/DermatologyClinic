

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
    if (req.method !== "POST" || req.url !== "/api/admin/staff") {
        return false;
    }

    const session = getSession(req);

    if (!session || session.role !== "administrator") {
        sendJSON(res, 403, { error: "Administrator access required" });
        return true;
    }

    let body = "";

    for await (const chunk of req) {
        body += chunk;

        if (body.length > 10000) {
            sendJSON(res, 413, { error: "Request too large" });
            return true;
        }
    }

    let data;

    try {
        data = JSON.parse(body);
    } catch {
        sendJSON(res, 400, { error: "Invalid JSON" });
        return true;
    }

    const {
        role, firstName, lastName, email, password,
        officeId, officeIds, specialtyId, nurseId
    } = data;

    const validId = (value) =>
        Number.isSafeInteger(Number(value)) && Number(value) > 0;

    if (
        !["doctor", "nurse", "receptionist"].includes(role) ||
        typeof firstName !== "string" || !firstName.trim() ||
        typeof lastName !== "string" || !lastName.trim() ||
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        typeof password !== "string" ||
        password.length < 12 ||
        password.length > 128 ||
        firstName.length > 45 ||
        lastName.length > 45 ||
        email.trim().length > 45
    ) {
        sendJSON(res, 400, { error: "Invalid staff information" });
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
        sendJSON(res, 400, { error: "Invalid staff assignments" });
        return true;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await hashPassword(password);
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        let staffId;
        let foreignKeyColumn;

        if (role === "nurse") {
            const [result] = await connection.execute(
                `INSERT INTO nurse
                 (First_Name, Last_Name, Email, OFFICE_Office_ID)
                 VALUES (?, ?, ?, ?)`,
                [firstName.trim(), lastName.trim(),
                 normalizedEmail, Number(officeId)]
            );

            staffId = result.insertId;
            foreignKeyColumn = "NURSE_Nurse_ID";

        } else if (role === "receptionist") {
            const [result] = await connection.execute(
                `INSERT INTO receptionist
                 (First_Name, Last_Name, Email, OFFICE_Office_ID)
                 VALUES (?, ?, ?, ?)`,
                [firstName.trim(), lastName.trim(),
                 normalizedEmail, Number(officeId)]
            );

            staffId = result.insertId;
            foreignKeyColumn = "RECEPTIONIST_Receptionist_ID";

        } else {
            const [result] = await connection.execute(
                `INSERT INTO doctor
                 (First_Name, Last_Name, Email,
                  SPECIALTY_Specialty_ID, NURSE_Nurse_ID)
                 VALUES (?, ?, ?, ?, ?)`,
                [firstName.trim(), lastName.trim(),
                 normalizedEmail, Number(specialtyId), Number(nurseId)]
            );

            staffId = result.insertId;
            foreignKeyColumn = "DOCTOR_Doctor_ID";

            // Insert each assigned office into the junction table.
            // Confirm its exact column names before enabling this block.
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
            [normalizedEmail, passwordHash, role, staffId]
        );

        await connection.commit();

        sendJSON(res, 201, {
            message: "Staff account created successfully",
            role,
            staffId
        });

    } catch (error) {
        await connection.rollback();
        console.error("Staff creation error:", error);

        sendJSON(res, error.code === "ER_DUP_ENTRY" ? 409 : 500, {
            error: error.code === "ER_DUP_ENTRY"
                ? "Email already exists"
                : "Could not create staff account"
        });

    } finally {
        connection.release();
    }

    return true;
}
