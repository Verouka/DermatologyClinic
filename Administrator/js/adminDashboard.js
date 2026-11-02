
document.addEventListener("DOMContentLoaded", async () => {
    const API_URL = "/api/admin/dashboard";

    const elements = {
        totalPatients: document.getElementById("totalPatients"),
        totalDoctors: document.getElementById("totalDoctors"),
        totalNurses: document.getElementById("totalNurses"),
        totalRevenue: document.getElementById("totalRevenue")
    };

    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    });

    function updateElement(name, value) {
        const element = elements[name];

        if (!element) {
            console.warn(
                `Admin Dashboard: HTML element #${name} was not found.`
            );
            return;
        }

        element.textContent = value;
    }

    function showUnavailable() {
        updateElement("totalPatients", "Unavailable");
        updateElement("totalDoctors", "Unavailable");
        updateElement("totalNurses", "Unavailable");
        updateElement("totalRevenue", "Unavailable");
    }

    function formatNumber(value) {
        const number = Number(value);

        return Number.isFinite(number)
            ? number.toLocaleString("en-US")
            : "Unavailable";
    }

    function formatCurrency(value) {
        if (value === null || value === undefined || value === "") {
            return "Unavailable";
        }

        const number = Number(value);

        return Number.isFinite(number)
            ? currencyFormatter.format(number)
            : "Unavailable";
    }

    try {
        const response = await fetch(API_URL, {
            method: "GET",
            credentials: "include",
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;

            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch {
                // Keep the HTTP error message.
            }

            throw new Error(errorMessage);
        }

        const result = await response.json();

        console.log("Administrator dashboard data:", result);

        updateElement(
            "totalPatients",
            formatNumber(result.totalPatients)
        );

        updateElement(
            "totalDoctors",
            formatNumber(result.totalDoctors)
        );

        updateElement(
            "totalNurses",
            formatNumber(result.totalNurses)
        );

        updateElement(
            "totalRevenue",
            formatCurrency(result.totalRevenue)
        );

    } catch (error) {
        console.error(
            "Error loading administrator dashboard:",
            error
        );

        showUnavailable();
    }
});
