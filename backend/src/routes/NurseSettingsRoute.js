import { getNurseSettings, updateNurseSettings, requestPasswordReset } from "./nurseSettingsController.js";

export async function handleNurseSettingsRoutes(req, res, pathname, method) {
    if (pathname === "/api/nurse/settings" && method === "GET") {
        await getNurseSettings(req, res);
        return true;
    }
    if (pathname === "/api/nurse/settings" && method === "PUT") {
        await updateNurseSettings(req, res);
        return true;
    }
    if (pathname === "/api/nurse/settings/reset-password" && method === "POST") {
        await requestPasswordReset(req, res);
        return true;
    }
    return false;
}