import pool from "./database.js";

const parseBody = (req) => new Promise((resolve) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
        try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
});

export async function getNurseProfile(req, res) {
    try {
        const [rows] = await pool.query("SELECT * FROM nurse WHERE Nurse_ID = 501");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(rows[0] || {}));
    } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
    }
}

export async function updateNurseProfile(req, res) {
    try {
        const data = await parseBody(req);
        await pool.query(
            `UPDATE nurse 
             SET First_Name = ?, Last_Name = ?, Email = ?, Phone = ?, Street = ?, City = ?, State = ?, Zip_Code = ? 
             WHERE Nurse_ID = 501`,
            [data.First_Name, data.Last_Name, data.Email, data.Phone, data.Street, data.City, data.State, data.Zip_Code]
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
    } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
    }
}