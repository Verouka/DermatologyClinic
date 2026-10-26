
import { handleAdminStaffRoutes } from "./routes/adminStaffRoutes.js";
import { handleAuthRoutes } from "./routes/Authentication_route.js";
import { handlePatientRoutes } from "./routes/patientRoutes.js";

const app = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5500");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    try {
        if (await handleAuthRoutes(req, res)) return;

        if (await handlePatientRoutes(req, res)) return;

        if (await handleAdminStaffRoutes(req, res)) return;

        if (req.method === "GET" && req.url === "/") {
            res.writeHead(200, {
                "Content-Type": "text/plain"
            });

            res.end("Dermatology Clinic Backend is running!");
            return;
        }

        res.writeHead(404, {
            "Content-Type": "application/json"
        });

        res.end(JSON.stringify({
            error: "Route not found"
        }));

    } catch (error) {
        console.error("Server error:", error);

        if (!res.headersSent) {
            res.writeHead(500, {
                "Content-Type": "application/json"
            });
        }

        if (!res.writableEnded) {
            res.end(JSON.stringify({
                error: "Internal server error"
            }));
        }
    }
};

export default app;

