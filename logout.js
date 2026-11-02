
document.querySelectorAll(".logout").forEach((button) => {
    button.disabled = false;

    button.addEventListener("click", async () => {
        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "include"
            });

            if (!response.ok) {
                throw new Error("Logout failed");
            }

            window.location.replace("/LoginPage.html");

        } catch (error) {
            console.error("Logout error:", error);
            alert("Could not log out.");
        }
    });
});
