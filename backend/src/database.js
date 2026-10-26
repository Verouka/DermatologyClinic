import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10,
    ssl: {
        ca: fs.readFileSync(
            path.resolve("DigiCertGlobalRootG2.crt.pem")
        ),
        rejectUnauthorized: true
    }
});

export default pool;