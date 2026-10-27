const API_BASE = "http://127.0.0.1:3000";

const editableFields = [
    "First_Name",
    "Middle_Name",
    "Last_Name",
    "Email",
    "Phone",
    "Street",
    "City",
    "State",
    "Zip_Code"
];

const fieldLimits = {
    First_Name: 45,
    Middle_Name: 45,
    Last_Name: 45,
    Email: 45,
    Phone: 20,
    Street: 45,
    City: 45,
    State: 45,
    Zip_Code: 10
};

const displayFields = [
    "Doctor_ID",
    "First_Name",
    "Middle_Name",
    "Last_Name",
    "Birth_Date",
    "Gender",
    "Email",
    "Phone",
    "Street",
    "City",
    "State",
    "Zip_Code",
    "SPECIALTY_Specialty_ID",
    "Specialty_Name",
    "Specialty_Description",
    "Start_Date",
    "Salary",
    "License_Number",
    "NURSE_Nurse_ID",
    "Nurse_First_Name",
    "Nurse_Middle_Name",
    "Nurse_Last_Name",
    "Nurse_Email",
    "Nurse_Phone",
    "Nurse_Office_ID",
    "Nurse_License_Number",
    "Office_ID"
];

let savedProfile = null;
let isEditing = false;
let isSaving = false;

function setDoctorField(id, value) {
    const input = document.getElementById(id);
    if (!input) return;

    if (input.type === "date") {
        input.value = value ? String(value).slice(0, 10) : "";
    } else {
        input.value = value == null ? "" : String(value);
    }
}

function setProfileStatus(message) {
    const status = document.getElementById("profileStatus");
    if (status) status.textContent = message;
}

function displayDoctorProfile(doctor) {
    for (const field of displayFields) {
        setDoctorField(field, doctor[field]);
    }
}

function getProfileButtons() {
    return {
        edit: document.getElementById("editProfileBtn") || document.querySelector(".editBtn"),
        save: document.getElementById("saveProfileBtn"),
        cancel: document.getElementById("cancelProfileBtn")
    };
}

function setEditMode(editing) {
    isEditing = editing;

    for (const field of editableFields) {
        const input = document.getElementById(field);
        if (input) input.readOnly = !editing;
    }

    const buttons = getProfileButtons();

    if (buttons.save && buttons.cancel) {
        if (buttons.edit) buttons.edit.hidden = editing;
        buttons.save.hidden = !editing;
        buttons.cancel.hidden = !editing;
    } else if (buttons.edit) {
        buttons.edit.textContent = editing ? "Save Changes" : "Edit Profile";
    }

    if (editing) document.getElementById("First_Name")?.focus();
}

async function loadDoctorProfile() {
    try {
        setProfileStatus("Loading profile...");

        const response = await fetch(`${API_BASE}/api/doctor/me`, {
            method: "GET",
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error(`Could not load doctor profile (HTTP ${response.status})`);
        }

        const doctor = await response.json();
        savedProfile = doctor;
        displayDoctorProfile(doctor);
        setEditMode(false);

        const buttons = getProfileButtons();
        if (buttons.edit) buttons.edit.disabled = false;

        setProfileStatus("");
        console.log("Doctor profile loaded successfully.");
    } catch (error) {
        console.error("Doctor profile loading error:", error);
        setProfileStatus("Could not load doctor profile.");
        alert(error.message);
    }
}

function collectChanges() {
    const changes = {};

    for (const field of editableFields) {
        const input = document.getElementById(field);
        if (!input) continue;

        const newValue = input.value.trim();
        const oldValue = String(savedProfile?.[field] ?? "").trim();

        if (newValue !== oldValue) changes[field] = newValue;
    }

    return changes;
}

function validateChanges(changes) {
    for (const [field, value] of Object.entries(changes)) {
        if (value.length > fieldLimits[field]) {
            alert(`${field} must be at most ${fieldLimits[field]} characters.`);
            return false;
        }

        if (["First_Name", "Last_Name", "Email"].includes(field) && !value) {
            alert(`${field} cannot be empty.`);
            return false;
        }

        if (field === "Email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            alert("Please enter a valid email address.");
            return false;
        }

        if (field === "Phone" && value && !/^\d{3}-\d{3}-\d{4}$/.test(value)) {
            alert("Phone number must be in the format 123-456-7890.");
            return false;
        }
    }

    return true;
}

async function saveDoctorProfile() {
    if (!savedProfile || isSaving) return;

    const changes = collectChanges();
    if (!validateChanges(changes)) return;

    if (Object.keys(changes).length === 0) {
        setEditMode(false);
        return;
    }

    const buttons = getProfileButtons();
    isSaving = true;

    if (buttons.save) buttons.save.disabled = true;
    if (buttons.edit) buttons.edit.disabled = true;
    if (buttons.cancel) buttons.cancel.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/api/doctor/me`, {
            method: "PATCH",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(changes)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `Could not update profile (HTTP ${response.status})`);
        }

        // The backend returns the saved profile, including read-only fields.
        if (result.doctor) {
            savedProfile = result.doctor;
        } else {
            savedProfile = { ...savedProfile, ...changes };
        }

        displayDoctorProfile(savedProfile);
        setEditMode(false);
        setProfileStatus("Profile updated successfully.");
        alert("Profile updated successfully!");
    } catch (error) {
        console.error("Doctor profile update error:", error);
        setProfileStatus("Could not save profile changes.");
        alert(error.message);
    } finally {
        isSaving = false;
        if (buttons.save) buttons.save.disabled = false;
        if (buttons.edit) buttons.edit.disabled = false;
        if (buttons.cancel) buttons.cancel.disabled = false;
    }
}

function setupProfileButtons() {
    const buttons = getProfileButtons();
    if (!buttons.edit) return;

    buttons.edit.addEventListener("click", async () => {
        if (!savedProfile || isSaving) return;

        if (!buttons.save || !buttons.cancel) {
            if (isEditing) {
                await saveDoctorProfile();
            } else {
                setEditMode(true);
            }
        } else {
            setEditMode(true);
        }
    });

    if (buttons.save) {
        buttons.save.addEventListener("click", saveDoctorProfile);
    }

    if (buttons.cancel) {
        buttons.cancel.addEventListener("click", () => {
            if (!savedProfile || isSaving) return;
            displayDoctorProfile(savedProfile);
            setEditMode(false);
            setProfileStatus("");
        });
    }
}

function initializeDoctorProfile() {
    setupProfileButtons();
    loadDoctorProfile();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeDoctorProfile);
} else {
    initializeDoctorProfile();
}
