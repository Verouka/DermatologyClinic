
document.addEventListener("DOMContentLoaded", async () => {
    const totalPatientsElement = document.getElementById("totalPatients");
    const totalDoctorsElement = document.getElementById("totalDoctors");
    const totalNursesElement = document.getElementById("totalNurses");
    const totalRevenueElement = document.getElementById("totalRevenue");

    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    });

    try {
        const response = await fetch(
            "http://127.0.0.1:3000/api/admin/dashboard",
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
                result.error || "Failed to load dashboard information."
            );
        }

        totalPatientsElement.textContent =
            result.totalPatients.toLocaleString("en-US");

        totalDoctorsElement.textContent =
            result.totalDoctors.toLocaleString("en-US");

        totalNursesElement.textContent =
            result.totalNurses.toLocaleString("en-US");

        totalRevenueElement.textContent =
            currencyFormatter.format(result.totalRevenue);

    } catch (error) {
        console.error("Error loading administrator dashboard:", error);

        totalPatientsElement.textContent = "Unavailable";
        totalDoctorsElement.textContent = "Unavailable";
        totalNursesElement.textContent = "Unavailable";
        totalRevenueElement.textContent = "Unavailable";
    }
});
