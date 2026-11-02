
const accountEmail = document.getElementById("accountEmail");

const passwordForm = document.getElementById("passwordForm");
const currentPassword = document.getElementById("currentPassword");
const newPassword = document.getElementById("newPassword");
const confirmPassword = document.getElementById("confirmPassword");
const passwordMessage = document.getElementById("passwordMessage");

async function loadAccountInformation() {
    try {
        const response = await fetch(
            "/api/auth/me",
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!response.ok) {
            throw new Error("Could not load account information");
        }

        const user = await response.json();

        if (user.role !== "patient") {
            throw new Error("Patient access required");
        }

        accountEmail.value = user.email || "";

    } catch (error) {
        console.error("Account information error:", error);
        accountEmail.placeholder = "Unable to load email";
    }
}

passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    passwordMessage.textContent = "";
    passwordMessage.style.color = "red";

    if (newPassword.value !== confirmPassword.value) {
        passwordMessage.textContent =
            "New passwords do not match.";
        return;
    }

    if (
        newPassword.value.length < 8 ||
        newPassword.value.length > 128
    ) {
        passwordMessage.textContent =
            "Password must be between 8 and 128 characters.";
        return;
    }

    const submitButton = passwordForm.querySelector(
        "button[type='submit']"
    );

    submitButton.disabled = true;

    try {
        const response = await fetch(
            "/api/patient/settings/password",
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
            throw new Error(
                result.error || "Could not change password"
            );
        }

        passwordMessage.style.color = "green";
        passwordMessage.textContent =
            "Password changed successfully!";

        passwordForm.reset();

    } catch (error) {
        passwordMessage.textContent = error.message;
    } finally {
        submitButton.disabled = false;
    }
});

loadAccountInformation();

