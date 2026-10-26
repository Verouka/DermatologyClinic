import pool from "./database.js";

export async function getNurseSchedule(req, res) {
    try {
        const [rows] = await pool.query(`
            SELECT s.Schedule_ID, s.Day_of_Week, s.Start_Time, s.End_Time, 
                   s.OFFICE_Office_ID, s.NURSE_Nurse_ID, s.DOCTOR_Doctor_ID,
                   CONCAT(o.Street, ', ', o.City) AS Office_Name,
                   CONCAT('Dr. ', d.First_Name, ' ', d.Last_Name) AS Doctor_Name
            FROM schedule s
            JOIN office o ON s.OFFICE_Office_ID = o.Office_ID
            JOIN doctor d ON s.DOCTOR_Doctor_ID = d.Doctor_ID
            WHERE s.NURSE_Nurse_ID = 501
        `);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(rows));
    } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
    }
}