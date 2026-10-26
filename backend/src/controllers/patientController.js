
import pool from "../database.js";

export async function getPatients(req, res, sendJSON) {
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

export async function createPatient(req, res, sendJSON, readBody) {
    const body = await readBody(req);
    const { firstName, lastName, dob, phone, email, address } = body;

    if (!firstName || !lastName || !dob || !phone || !email) {
        return sendJSON(res, 400, {
            error: "First name, last name, date of birth, phone, and email are required."
        });
    }

    const addressParts = (address || "")
        .split(",")
        .map(part => part.trim());

    const [result] = await pool.execute(`
        INSERT INTO patient (
            First_Name, Last_Name, Email, BirthDate, Phone,
            Street, City, State, Zip_Code, Date_Admitted
        )
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
