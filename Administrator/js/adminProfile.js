
document.addEventListener("DOMContentLoaded", async () => {

    // ==========================================
    // LOAD ADMINISTRATOR PROFILE
    // ==========================================

    const fields = document.querySelectorAll("[data-field]");

    fields.forEach((field) => {
        field.textContent = "Loading...";
    });

    try {
        const response = await fetch(
            "http://127.0.0.1:3000/api/admin/profile",
            {
                method: "GET",
                credentials: "include",
                headers: {
                    Accept: "application/json"
                }
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || `Failed to load profile (HTTP ${response.status}).`
            );
        }

        const profile = result.profile;

        if (!profile) {
            throw new Error("No profile data was returned by the server.");
        }

        console.log("Administrator profile received:", profile);

        fields.forEach((field) => {
            const key = field.dataset.field;
            const value = profile[key];

            if (value === null || value === undefined || value === "") {
                field.textContent = "—";
                console.warn(`Profile field "${key}" is empty or missing.`);
                return;
            }

            if (key === "salary") {
                const salary = Number(value);

                field.textContent = Number.isFinite(salary)
                    ? salary.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD"
                    })
                    : String(value);

                return;
            }

            if (key === "dateOfBirth" || key === "startDate") {
                const dateString = String(value);
                const match = dateString.slice(0, 10).match(
                    /^(\d{4})-(\d{2})-(\d{2})$/
                );

                field.textContent = match
                    ? `${match[2]}/${match[3]}/${match[1]}`
                    : dateString;

                return;
            }

            field.textContent = String(value);
        });

    } catch (error) {
        console.error("Error loading administrator profile:", error);

        fields.forEach((field) => {
            field.textContent = "Unavailable";
        });
    }


    // ==========================================
    // CHANGE ADMINISTRATOR PASSWORD
    // ==========================================

    const changePasswordForm = document.getElementById("changePasswordForm");

    if (!changePasswordForm) return;

    const currentPassword = document.getElementById("currentPassword");
    const newPassword = document.getElementById("newPassword");
    const confirmPassword = document.getElementById("confirmPassword");
    const passwordMessage = document.getElementById("passwordMessage");

    changePasswordForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        passwordMessage.textContent = "";

        // Make sure all fields are filled in.
        if (
            !currentPassword.value ||
            !newPassword.value ||
            !confirmPassword.value
        ) {
            passwordMessage.textContent = "Please fill in all password fields.";
            return;
        }

        // Check minimum password length.
        if (newPassword.value.length < 8) {
            passwordMessage.textContent =
                "Your new password must be at least 8 characters long.";
            return;
        }

        // Make sure new passwords match.
        if (newPassword.value !== confirmPassword.value) {
            passwordMessage.textContent = "New passwords do not match.";
            return;
        }

        // Prevent using the existing password again.
        if (currentPassword.value === newPassword.value) {
            passwordMessage.textContent =
                "Your new password must be different from your current password.";
            return;
        }

        try {
            const response = await fetch(
                "http://127.0.0.1:3000/api/admin/profile/change-password",
                {
                    method: "PATCH",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json"
                    },
                    body: JSON.stringify({
                        currentPassword: currentPassword.value,
                        newPassword: newPassword.value
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.error || "Unable to change password."
                );
            }

            passwordMessage.textContent =
                result.message || "Password changed successfully!";

            passwordMessage.style.color = "green";

            changePasswordForm.reset();

        } catch (error) {
            console.error("Error changing administrator password:", error);

            passwordMessage.textContent =
                error.message || "Cannot connect to the server.";

            passwordMessage.style.color = "red";
        }
    });

});
