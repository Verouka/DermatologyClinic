
const allowedRole = document.currentScript.dataset.role;

// Hide the dashboard until the user's role is verified.
document.documentElement.style.visibility = "hidden";

(async function checkSecurity() {
    try {
        const response = await fetch("/api/auth/me", {
            method: "GET",
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error("User is not authenticated");
        }

        const user = await response.json();

        if (
            String(user.role).toLowerCase() !==
            String(allowedRole).toLowerCase()
        ) {
            window.location.replace("/LoginPage.html");
            return;
        }

        // Show the dashboard only to the correct role.
        document.documentElement.style.visibility = "visible";

    } catch (error) {
        console.error("Security check failed:", error);

        window.location.replace("/LoginPage.html");
    }
})();
