document.addEventListener("DOMContentLoaded", () => {
    const changePasswordForm = document.getElementById("changePasswordForm");
    const currentPasswordInput = document.getElementById("currentPassword");
    const newPasswordInput = document.getElementById("newPassword");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    const passwordMessage = document.getElementById("passwordMessage");

    if (!changePasswordForm) return;

    function showMessage(message, isSuccess = false) {
        passwordMessage.textContent = message;
        passwordMessage.style.color = isSuccess ? "green" : "red";
    }

    changePasswordForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        passwordMessage.textContent = "";

        if (!currentPassword || !newPassword || !confirmPassword) {
            showMessage("Please fill out all password fields.");
            return;
        }

        if (newPassword.length < 8 || newPassword.length > 128) {
            showMessage("Your new password must be between 8 and 128 characters.");
            return;
        }

        if (newPassword !== confirmPassword) {
            showMessage("New password and confirmation do not match.");
            return;
        }

        if (currentPassword === newPassword) {
            showMessage("Your new password must be different from your current password.");
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
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({
                        currentPassword,
                        newPassword
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Unable to change password.");
            }

            showMessage(result.message || "Password changed successfully.", true);
            changePasswordForm.reset();

        } catch (error) {
            console.error("Password change error:", error);
            showMessage(error.message || "An error occurred while changing your password.");
        }
    });
});