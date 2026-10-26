export async function getSettings(db, doctorId) {
    const [rows] = await db.execute(`
        SELECT Doctor_ID, First_Name, Last_Name, Email, Phone
        FROM doctor
        WHERE Doctor_ID = ?
    `, [doctorId]);

    return rows[0] || null;
}
