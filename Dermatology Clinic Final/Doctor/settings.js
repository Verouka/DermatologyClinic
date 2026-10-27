const API_BASE = "http://127.0.0.1:3000";

const accountEmail = document.getElementById("accountEmail");
const passwordForm = document.getElementById("passwordForm");
const currentPassword = document.getElementById("currentPassword");
const newPassword = document.getElementById("newPassword");
const confirmPassword = document.getElementById("confirmPassword");
const passwordMessage = document.getElementById("passwordMessage");

async function loadAccountInformation() {
    try {
        const response = await fetch(
            `${API_BASE}/api/auth/me`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!response.ok) {
            throw new Error(`Could not load account information (HTTP ${response.status})`);
        }

        const user = await response.json();

        if (user.role !== "doctor") {
            throw new Error("Doctor access required");
        }

        accountEmail.value = user.email || user.Email || "";

    } catch (error) {
        console.error("Doctor account information error:", error);
        accountEmail.placeholder = "Unable to load email";
    }
}

passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    passwordMessage.textContent = "";
    passwordMessage.style.color = "red";

    if (newPassword.value !== confirmPassword.value) {
        passwordMessage.textContent = "New passwords do not match.";
        return;
    }

    if (newPassword.value.length < 8 || newPassword.value.length > 128) {
        passwordMessage.textContent =
            "Password must be between 8 and 128 characters.";
        return;
    }

    const submitButton = passwordForm.querySelector("button[type='submit']");
    submitButton.disabled = true;

    try {
        const response = await fetch(
            `${API_BASE}/api/doctor/settings/password`,
            {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    currentPassword: currentPassword.value,
                    newPassword: newPassword.value
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not change password");
        }

        passwordMessage.style.color = "green";
        passwordMessage.textContent = "Password changed successfully!";
        passwordForm.reset();

    } catch (error) {
        console.error("Doctor password change error:", error);
        passwordMessage.textContent = error.message;
    } finally {
        submitButton.disabled = false;
    }
});

loadAccountInformation();


// The current database has no verified notification preference columns.
// Settings are stored temporarily in the backend process, not in MySQL.
const appointmentReminders = document.getElementById("appointmentReminders");
const medicalUpdates = document.getElementById("medicalUpdates");
const notificationMessage = document.getElementById("notificationMessage");
const saveNotificationSettings = document.getElementById("saveNotificationSettings");

async function loadNotificationPreferences() {
    if (!appointmentReminders || !medicalUpdates || !notificationMessage) return;
    try {
        const response = await fetch(
            `${API_BASE}/api/doctor/settings/notifications`,
            { method: "GET", credentials: "include" }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load preferences");
        appointmentReminders.checked = data.appointmentReminders === true;
        medicalUpdates.checked = data.medicalUpdates === true;
        notificationMessage.textContent =
            "Temporary preferences loaded (reset when backend restarts).";
    } catch (error) {
        console.error("Doctor preferences:", error);
        notificationMessage.textContent = error.message;
    }
}

if (saveNotificationSettings) {
    saveNotificationSettings.addEventListener("click", async () => {
        saveNotificationSettings.disabled = true;
        notificationMessage.textContent = "Saving...";
        try {
            const response = await fetch(
                `${API_BASE}/api/doctor/settings/notifications`, {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        appointmentReminders: appointmentReminders.checked,
                        medicalUpdates: medicalUpdates.checked
                    })
                }
            );
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Could not save preferences");
            notificationMessage.textContent =
                "Saved for this server session. Settings reset when the backend restarts.";
        } catch (error) {
            console.error("Doctor preferences:", error);
            notificationMessage.textContent = error.message;
        } finally {
            saveNotificationSettings.disabled = false;
        }
    });
}
loadNotificationPreferences();
