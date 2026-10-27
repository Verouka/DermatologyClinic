import pool from "../database.js";

export async function findUserByEmail(email) {
    const [rows] = await pool.execute(
        `SELECT UserID, Email, Password_hash, role,
                PATIENT_Patient_ID,
                DOCTOR_Doctor_ID,
                NURSE_Nurse_ID,
                RECEPTIONIST_Receptionist_ID,
                ADMINISTRATOR_Administrator_ID
         FROM usercredential
         WHERE Email = ?
         LIMIT 1`,
        [email]
    );

    return rows[0] || null;
}