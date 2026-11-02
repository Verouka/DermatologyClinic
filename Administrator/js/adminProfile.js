
document.addEventListener("DOMContentLoaded", async () => {
    const fields = document.querySelectorAll("[data-field]");

    const API_URL = "/api/admin/profile";

    function formatDate(value) {
        if (!value) return "—";

        const dateString = String(value).slice(0, 10);
        const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);

        return match
            ? `${match[2]}/${match[3]}/${match[1]}`
            : dateString;
    }

    function formatSalary(value) {
        if (value === null || value === undefined || value === "") {
            return "—";
        }

        const amount = Number(value);

        return Number.isFinite(amount)
            ? amount.toLocaleString("en-US", {
                style: "currency",
                currency: "USD"
            })
            : String(value);
    }

    function displayProfile(profile) {
        fields.forEach((field) => {
            const key = field.dataset.field;
            const value = profile[key];

            if (value === null || value === undefined || value === "") {
                field.textContent = "—";
                return;
            }

            if (key === "salary") {
                field.textContent = formatSalary(value);
                return;
            }

            if (key === "dateOfBirth" || key === "startDate") {
                field.textContent = formatDate(value);
                return;
            }

            field.textContent = String(value);
        });
    }

    fields.forEach((field) => {
        field.textContent = "Loading...";
    });

    try {
        const response = await fetch(API_URL, {
            method: "GET",
            credentials: "include",
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            let errorMessage = `Failed to load profile (HTTP ${response.status}).`;

            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch {
                // Keep the HTTP error message.
            }

            throw new Error(errorMessage);
        }

        const result = await response.json();

        if (!result.profile || typeof result.profile !== "object") {
            throw new Error("No profile data was returned by the server.");
        }

        console.log("Administrator profile received:", result.profile);

        displayProfile(result.profile);

    } catch (error) {
        console.error("Error loading administrator profile:", error);

        fields.forEach((field) => {
            field.textContent = "Unavailable";
        });
    }
});
