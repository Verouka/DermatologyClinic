
document.addEventListener("DOMContentLoaded", async () => {
    const officesTableBody = document.getElementById("officesTableBody");

    function displayMessage(message) {
        officesTableBody.innerHTML = "";

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.textContent = message;

        row.appendChild(cell);
        officesTableBody.appendChild(row);
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

        const offices = result.offices;

        if (!Array.isArray(offices) || offices.length === 0) {
            displayMessage("No clinic offices found.");
            return;
        }

        officesTableBody.innerHTML = "";

        offices.forEach((office) => {
            const row = document.createElement("tr");

            const values = [
                office.officeId,
                office.phone,
                office.street,
                office.city,
                office.state,
                office.zipCode
            ];

            values.forEach((value) => {
                const cell = document.createElement("td");
                cell.textContent = value ?? "—";
                row.appendChild(cell);
            });

            officesTableBody.appendChild(row);
        });

    } catch (error) {
        console.error("Error loading clinic information:", error);
        displayMessage("Unable to load clinic offices.");
    }
});
