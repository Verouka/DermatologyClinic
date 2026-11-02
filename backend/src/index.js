
import "dotenv/config";
import app from "./app.js";
import http from "node:http";
import pool from "./database.js";

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        // Test the MySQL database connection
        const [rows] = await pool.query("SELECT 1 AS connected");
        console.log("MySQL connected successfully!", rows);

        // Start the Node.js HTTP server
        http.createServer(app).listen(PORT, "0.0.0.0", () => {
            console.log(`Dermatology Clinic server running on port ${PORT}`);
        });

    } catch (error) {
        console.error("MySQL connection failed:", error.message);
        process.exit(1);
    }
};

startServer();
