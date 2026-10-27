
document.addEventListener("DOMContentLoaded", async () => {
    const fields = {
        officeId: document.getElementById("officeId"),
        officePhone: document.getElementById("officePhone"),
        officeStreet: document.getElementById("officeStreet"),
        officeCity: document.getElementById("officeCity"),
        officeState: document.getElementById("officeState"),
        officeZipCode: document.getElementById("officeZipCode")
    };

    function displayValue(element, value) {
        if (element) {
            element.textContent = value ?? "—";
        }
    }

    try {
        const response = await fetch(
            "http://127.0.0.1:3000/api/admin/clinic-info",
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
                result.error || "Failed to load clinic information."
            );
        }

        const office = result.office;

        if (!office) {
            throw new Error("No clinic information was found.");
        }

        displayValue(fields.officeId, office.officeId);
        displayValue(fields.officePhone, office.phone);
        displayValue(fields.officeStreet, office.street);
        displayValue(fields.officeCity, office.city);
        displayValue(fields.officeState, office.state);
        displayValue(fields.officeZipCode, office.zipCode);

    } catch (error) {
        console.error("Error loading clinic information:", error);

        Object.values(fields).forEach((element) => {
            displayValue(element, "Unavailable");
        });
    }
});
