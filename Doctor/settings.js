// Doctor Settings: account email and password only.
// Notification bell functionality remains in doctorNotifications.js.
(() => {
    const SETTINGS_API_BASE = "http://127.0.0.1:3000";

    const accountEmail = document.getElementById("accountEmail");
    const passwordForm = document.getElementById("passwordForm");
    const currentPassword = document.getElementById("currentPassword");
    const newPassword = document.getElementById("newPassword");
    const confirmPassword = document.getElementById("confirmPassword");
    const passwordMessage = document.getElementById("passwordMessage");

    async function requestJSON(path, options = {}) {
        let response;
        try {
            response = await fetch(`${SETTINGS_API_BASE}${path}`, {
                credentials: "include",
                ...options,
                headers: {
                    ...(options.body ? { "Content-Type": "application/json" } : {}),
                    ...(options.headers || {})
                }
            });
        } catch {
            throw new Error("Could not connect to the backend at http://127.0.0.1:3000.");
        }

        let data;
        try {
            data = await response.json();
        } catch {
            throw new Error(
                `Backend returned a non-JSON response (HTTP ${response.status}). ` +
                "Check that the existing Doctor Settings route is registered."
            );
        }
        if (!response.ok) {
            throw new Error(data.error || `Request failed (HTTP ${response.status}).`);
        }
        return data;
    }

    async function loadAccountInformation() {
        if (!accountEmail) return;
        accountEmail.value = "";
        accountEmail.placeholder = "Loading...";
        try {
            // Account login email from usercredential, NOT doctor profile Email.
            const account = await requestJSON("/api/doctor/settings/account");
            if (typeof account.email !== "string" || !account.email.trim()) {
                throw new Error("No login email was returned for this doctor.");
            }
            accountEmail.value = account.email;
            accountEmail.placeholder = "";
            accountEmail.title = "Doctor login account email";
        } catch (error) {
            console.error("Doctor account email error:", error);
            accountEmail.placeholder = "Unable to load email";
            accountEmail.title = error.message;
        }
    }

    function setupPasswordForm() {
        if (!passwordForm || !currentPassword || !newPassword ||
            !confirmPassword || !passwordMessage) return;

        passwordForm.addEventListener("submit", async event => {
            event.preventDefault();
            passwordMessage.textContent = "";
            passwordMessage.style.color = "red";

            if (!currentPassword.value) {
                passwordMessage.textContent = "Enter your current password.";
                return;
            }
            if (newPassword.value !== confirmPassword.value) {
                passwordMessage.textContent = "New passwords do not match.";
                return;
            }
            if (newPassword.value.length < 8 || newPassword.value.length > 128) {
                passwordMessage.textContent = "New password must be 8–128 characters.";
                return;
            }
            if (newPassword.value === currentPassword.value) {
                passwordMessage.textContent = "New password must be different.";
                return;
            }

            const submitButton = passwordForm.querySelector('button[type="submit"]');
            if (submitButton) submitButton.disabled = true;
            try {
                const data = await requestJSON("/api/doctor/settings/password", {
                    method: "PATCH",
                    body: JSON.stringify({
                        currentPassword: currentPassword.value,
                        newPassword: newPassword.value
                    })
                });
                passwordMessage.style.color = "green";
                passwordMessage.textContent = data.message || "Password changed successfully!";
                passwordForm.reset();
            } catch (error) {
                console.error("Doctor password change error:", error);
                passwordMessage.textContent = error.message;
            } finally {
                if (submitButton) submitButton.disabled = false;
            }
        });
    }

    function initializeSettings() {
        setupPasswordForm();
        loadAccountInformation();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeSettings);
    } else {
        initializeSettings();
    }
})();
