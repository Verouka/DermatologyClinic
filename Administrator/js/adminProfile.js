document.addEventListener("DOMContentLoaded", async () => {

    // ==========================================
    // LOAD ADMINISTRATOR PROFILE
    // ==========================================

    const fields = document.querySelectorAll("[data-field]");

    // Set all profile fields to Loading...
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

        // Handle unsuccessful responses.
        if (!response.ok) {
            throw new Error(
                result.error ||
                `Failed to load profile (HTTP ${response.status}).`
            );
        }

        const profile = result.profile;

        // Make sure profile data exists.
        if (!profile) {
            throw new Error(
                "No profile data was returned by the server."
            );
        }

        console.log(
            "Administrator profile received:",
            profile
        );

        // ==========================================
        // DISPLAY PROFILE INFORMATION
        // ==========================================

        fields.forEach((field) => {

            const key = field.dataset.field;
            const value = profile[key];

            // Handle empty or missing values.
            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {
                field.textContent = "—";

                console.warn(
                    `Profile field "${key}" is empty or missing.`
                );

                return;
            }

            // ==========================================
            // FORMAT SALARY
            // ==========================================

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

            // ==========================================
            // FORMAT DATES
            // ==========================================

            if (
                key === "dateOfBirth" ||
                key === "startDate"
            ) {

                const dateString = String(value);

                const match = dateString
                    .slice(0, 10)
                    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

                field.textContent = match
                    ? `${match[2]}/${match[3]}/${match[1]}`
                    : dateString;

                return;
            }

            // ==========================================
            // DISPLAY OTHER VALUES
            // ==========================================

            field.textContent = String(value);

        });

    } catch (error) {

        console.error(
            "Error loading administrator profile:",
            error
        );

        // Display an error message in all profile fields.
        fields.forEach((field) => {
            field.textContent = "Unavailable";
        });

    }

});