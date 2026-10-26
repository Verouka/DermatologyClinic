import { handleReceptionistRoutes } from "./routes/receptionistRoutes.js";
import { handleAuthRoutes } from "./routes/authenticationRoute.js";

const allowedOrigins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500"
];

const sendJSON = (res, statusCode, data, origin) => {
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };

    if (allowedOrigins.includes(origin)) {
        headers["Access-Control-Allow-Origin"] = origin;
        headers["Access-Control-Allow-Credentials"] = "true";
        headers["Vary"] = "Origin";
    }

    res.writeHead(statusCode, headers);
    res.end(JSON.stringify(data));
};

const readBody = (req) =>
    new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk;
        });

        req.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch {
                reject(new Error("Invalid JSON request body"));
            }
        });

        req.on("error", reject);
    });

const app = async (req, res) => {
    console.log("Incoming request:", req.method, req.url);
    const origin = req.headers.origin;

    // Add CORS headers to authentication responses too
    if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Vary", "Origin");
    }

    if (req.method === "OPTIONS") {
        const headers = {
            "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        };

        if (allowedOrigins.includes(origin)) {
            headers["Access-Control-Allow-Origin"] = origin;
            headers["Access-Control-Allow-Credentials"] = "true";
            headers["Vary"] = "Origin";
        }

        res.writeHead(204, headers);
        return res.end();
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    // Corrected: res is supplied automatically.
    const respond = (statusCode, data) =>
    sendJSON(res, statusCode, data, origin);

    const routeSendJSON = (response, statusCode, data) =>
    sendJSON(response, statusCode, data, origin);

    try {
        if (req.method === "GET" && path === "/") {
            res.writeHead(200, {
                "Content-Type": "text/plain"
            });

            return res.end(
                "Dermatology Clinic Backend is running!"
            );
        }

        // Authentication routes must be registered here
        // after confirming their exported function.
        // Authentication routes
        const authHandled = await handleAuthRoutes(req, res);
        if (authHandled !== false) {
            return;
        }

        // Receptionist routes
        const handled = await handleReceptionistRoutes(
            req,
            res,
            routeSendJSON,
            readBody,
            path
        );

        if (handled !== false) {
            return handled;
        }

        return respond(404, {
            error: "Endpoint not found."
        });

    } catch (error) {
        console.error("API error:", error);

        if (res.headersSent) {
            return;
        }

        if (error.code === "ER_DUP_ENTRY") {
            return respond(409, {
                error: "A record with that unique value already exists."
            });
        }

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return respond(400, {
                error: "The selected patient, doctor, or office does not exist."
            });
        }

        return respond(500, {
            error: "The request could not be completed."
        });
    }
};

export default app;