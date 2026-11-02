
document.addEventListener("DOMContentLoaded", async () => {
    const API_URL = "/api/admin/clinic-info";

    const fields = {
        officeId: document.getElementById("officeId"),
        officePhone: document.getElementById("officePhone"),
        officeStreet: document.getElementById("officeStreet"),
        officeCity: document.getElementById("officeCity"),
        officeState: document.getElementById("officeState"),
        officeZipCode: document.getElementById("officeZipCode")
    };

    function displayValue(element, value) {
        if (!element) return;

        if (value === null || value === undefined || value === "") {
            element.textContent = "—";
        } else {
            element.textContent = String(value);
        }
    }

    function updateAllFields(value) {
        Object.values(fields).forEach((element) => {
            displayValue(element, value);
        });
    }

    updateAllFields("Loading...");

    try {
        const response = await fetch(API_URL, {
            method: "GET",
            credentials: "include",
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            let errorMessage = `Failed to load clinic information (HTTP ${response.status}).`;

            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch {
                // Keep the HTTP error message.
            }

            throw new Error(errorMessage);
        }

        const result = await response.json();

        if (!result.office || typeof result.office !== "object") {
            throw new Error("No clinic information was found.");
        }

        const office = result.office;

        console.log("Clinic information received:", office);

        displayValue(fields.officeId, office.officeId);
        displayValue(fields.officePhone, office.phone);
        displayValue(fields.officeStreet, office.street);
        displayValue(fields.officeCity, office.city);
        displayValue(fields.officeState, office.state);
        displayValue(fields.officeZipCode, office.zipCode);

    } catch (error) {
        console.error("Error loading clinic information:", error);

        updateAllFields("Unavailable");
    }
});

