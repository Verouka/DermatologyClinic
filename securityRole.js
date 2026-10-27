

const allowedRole = document.currentScript.dataset.role;

// Hide the dashboard until the user's role is verified.
document.documentElement.style.visibility = "hidden";

(async function checkSecurity() {
    try {
        const response = await fetch(
            "http://127.0.0.1:3000/api/auth/me",
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!response.ok) {
            throw new Error("User is not authenticated");
        }

        const user = await response.json();

        if (user.role !== allowedRole) {
            window.location.replace(
                "http://127.0.0.1:5500/LoginPage.html"
            );
            return;
        }

        // Show the dashboard only to the correct role.
        document.documentElement.style.visibility = "visible";

    } catch (error) {
        console.error("Security check failed:", error);

        window.location.replace(
            "http://127.0.0.1:5500/LoginPage.html"
        );
    }
})();
