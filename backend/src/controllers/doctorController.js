
import pool from "../database.js";

export async function getDoctors(req, res, sendJSON) {
    const [rows] = await pool.query(`
        SELECT
            Doctor_ID AS id,
            CONCAT_WS(' ', First_Name, Last_Name) AS name
        FROM doctor
        ORDER BY Last_Name, First_Name
    `);

    return sendJSON(res, 200, rows);
}
