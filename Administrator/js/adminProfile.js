
document.addEventListener("DOMContentLoaded", async () => {
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
});
