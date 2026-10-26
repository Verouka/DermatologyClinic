
const DOCTOR_API_ORIGIN = window.location.port === "3000"
    ? window.location.origin
    : "http://127.0.0.1:3000";

const EDITABLE_FIELDS = [
    "First_Name", "Middle_Name", "Last_Name", "Email", "Phone",
    "Street", "City", "State", "Zip_Code"
];

const ALL_PROFILE_FIELDS = [
    "Doctor_ID", "First_Name", "Middle_Name", "Last_Name", "Birth_Date",
    "Gender", "Email", "Phone", "Street", "City", "State", "Zip_Code",
    "SPECIALTY_Specialty_ID", "Specialty_Name", "Specialty_Description",
    "Start_Date", "Salary", "License_Number", "NURSE_Nurse_ID",
    "Nurse_First_Name", "Nurse_Middle_Name", "Nurse_Last_Name",
    "Nurse_Email", "Nurse_Phone", "Nurse_Office_ID", "Nurse_License_Number"
];

const editButton = document.getElementById("editProfileBtn");
const saveButton = document.getElementById("saveProfileBtn");
const cancelButton = document.getElementById("cancelProfileBtn");
const statusText = document.getElementById("profileStatus");
let savedProfile = null;

function showStatus(message) {
    if (statusText) statusText.textContent = message;
}

async function apiRequest(path, options = {}) {
    const response = await fetch(`${DOCTOR_API_ORIGIN}${path}`, {
        credentials: "include",
        ...options
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(body.error || body.message || `Request failed (${response.status})`);
        error.status = response.status;
        throw error;
    }
    return body;
}

function fillProfile(profile) {
    for (const key of ALL_PROFILE_FIELDS) {
        const input = document.getElementById(key);
        if (!input) continue;
        const value = profile[key];
        input.value = input.type === "date"
            ? (value ? String(value).slice(0, 10) : "")
            : (value == null ? "" : String(value));
    }
}

function setEditMode(editing) {
    for (const key of EDITABLE_FIELDS) {
        const input = document.getElementById(key);
        if (!input) continue;
        input.readOnly = !editing;
        input.classList.toggle("is-editing", editing);
    }
    editButton.hidden = editing;
    saveButton.hidden = !editing;
    cancelButton.hidden = !editing;
}

async function loadDoctorProfile() {
    editButton.disabled = true;
    showStatus("Loading doctor profile...");
    try {
        const session = await apiRequest("/api/auth/me");
        if (session.role !== "doctor") {
            showStatus("Only doctors may view this profile.");
            window.location.replace("../LoginPage.html");
            return;
        }
        savedProfile = await apiRequest("/api/doctor/me");
        fillProfile(savedProfile);
        setEditMode(false);
        editButton.disabled = false;
        showStatus("Profile loaded.");
    } catch (error) {
        console.error("Doctor profile loading error:", error);
        if (error.status === 401 || error.status === 403) {
            showStatus("Please log in as a doctor.");
            window.location.replace("../LoginPage.html");
        } else {
            showStatus(`Could not load profile: ${error.message}`);
        }
    }
}

editButton.addEventListener("click", () => {
    if (!savedProfile) return;
    setEditMode(true);
    showStatus("You can edit your name, email, phone and address. Other fields are read-only.");
});

cancelButton.addEventListener("click", () => {
    if (!savedProfile) return;
    fillProfile(savedProfile);
    setEditMode(false);
    showStatus("Changes canceled.");
});

saveButton.addEventListener("click", async () => {
    if (!savedProfile) return;
    const changes = {};
    for (const key of EDITABLE_FIELDS) {
        const value = document.getElementById(key)?.value.trim();
        const oldValue = savedProfile[key] == null ? "" : String(savedProfile[key]).trim();
        if (value !== undefined && value !== oldValue) changes[key] = value;
    }

    if (Object.keys(changes).length === 0) {
        setEditMode(false);
        showStatus("No changes to save.");
        return;
    }
    const email = document.getElementById("Email");
    if (email && !email.checkValidity()) {
        email.reportValidity();
        return;
    }

    saveButton.disabled = true;
    cancelButton.disabled = true;
    showStatus("Saving changes...");
    try {
        
        const updated = await apiRequest("/api/doctor/me", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(changes)
        });
        savedProfile = updated;
        fillProfile(savedProfile);
        setEditMode(false);
        showStatus("Profile updated successfully.");
    } catch (error) {
        console.error("Doctor profile save error:", error);
        if (error.status === 403 && DOCTOR_API_ORIGIN !== window.location.origin) {
            showStatus("Saving requires the Doctor page to run on the same origin as the API (port 3000), or a team-approved CSRF/CORS setup.");
        } else {
            showStatus(`Could not save changes: ${error.message}`);
        }
    } finally {
        saveButton.disabled = false;
        cancelButton.disabled = false;
    }
});

loadDoctorProfile();
