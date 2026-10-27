const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("loginIdentifier").value.trim();
    const password = document.getElementById("password").value;

    try {
        const response = await fetch("http://127.0.0.1:3000/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (response.ok) {
            if (result.role === "patient") {
                window.location.href = "patientDashboard.html";

            } else if (result.role === "administrator") {
                window.location.href = "Administrator/html/adminDashboard.html";

            } else if (result.role === "nurse") {
                window.location.href = "Nurse/NurseDashboard.html";

            } else if (result.role === "doctor") {
                window.location.href = "Doctor/doctorDashboard.html";

            } else if (result.role === "receptionist") {
                window.location.href = "Receptionist_Dashboard.html";
            }

            else {
                alert("Dashboard for this role is not connected yet.");
            }

        } else {
            alert(result.error || "Invalid email or password.");
        }

    } 
    catch (error) {
    console.error("Login error:", error);
    alert("Could not connect to the server. Open DevTools Console (F12) for details.");
    }
});