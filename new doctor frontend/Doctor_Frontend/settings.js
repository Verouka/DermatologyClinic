
const SETTINGS_API_ORIGIN = "http://127.0.0.1:3000";

async function settingsGet(path) {
    const response = await fetch(`${SETTINGS_API_ORIGIN}${path}`, {
        method: "GET",
        credentials: "include"
    });
    if (!response.ok) {
        const error = new Error(`HTTP ${response.status} at ${path}`);
        error.status = response.status;
        throw error;
    }
    return response.json();
}

function settingsMessage(cardClass, message) {
    const el = document.querySelector(`.cards .${cardClass} .cardContent h4`);
    if (el) el.textContent = message;
}

function valueOrDash(value) {
    return value === null || value === undefined || String(value).trim() === ""
        ? "Not provided" : String(value).trim();
}

function connectProfileCard() {
    const card = document.querySelector(".cards .card4");
    if (!card) return;
    card.style.cursor = "pointer";
    card.setAttribute("role", "link");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", "Open Doctor Profile");
    const openProfile = () => window.location.assign("doctorProfile.html");
    card.addEventListener("click", openProfile);
    card.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openProfile();
        }
    });
}

async function loadDoctorSettings() {
    connectProfileCard();
    settingsMessage("card1", "Loading contact information...");
    settingsMessage("card2", "Preferences not available in the database.");
    settingsMessage("card3", "Loading account information...");

    try {
        const user = await settingsGet("/api/auth/me");
        if (user.role !== "doctor") {
            window.location.replace("../LoginPage.html");
            return;
        }

        let info;
        try {
            info = await settingsGet("/api/doctor/settings");
        } catch (error) {
            if (error.status !== 404) throw error;
            info = await settingsGet("/api/doctor/me");
        }

        const name = [info.First_Name, info.Last_Name].filter(Boolean).join(" ");
        settingsMessage("card1", `Email: ${valueOrDash(info.Email)} | Phone: ${valueOrDash(info.Phone)}`);
        settingsMessage("card3", `Doctor: ${valueOrDash(name)} | ID: ${valueOrDash(info.Doctor_ID)}`);
        settingsMessage("card4", "Click to view or edit your Doctor Profile.");
    } catch (error) {
        console.error("Could not load Doctor Settings:", error);
        if (error.status === 401 || error.status === 403) {
            window.location.replace("../LoginPage.html");
            return;
        }
        settingsMessage("card1", "Could not load contact information.");
        settingsMessage("card3", "Could not load account information.");
    }
}

document.addEventListener("DOMContentLoaded", loadDoctorSettings);
