
async function checkPatientSession() {
    try {
        const response = await fetch(
            "http://127.0.0.1:3000/api/auth/me",
            {
                credentials: "include"
            }
        );

        if (!response.ok) {
            window.location.replace("LoginPage.html");
            return;
        }

        const user = await response.json();

        if (user.role !== "patient") {
            window.location.replace("LoginPage.html");
            return;
        }

        console.log("Patient authenticated:", user.patientId);

        const profileResponse = await fetch(
            "http://127.0.0.1:3000/api/patient/me",
            {
                credentials: "include"
            }
        );

        if (!profileResponse.ok) {
            throw new Error("Could not load patient profile");
        }

        const patient = await profileResponse.json();

        document.getElementById("patientGreeting").textContent =
            `Hello, ${patient.First_Name}!`;

        document.body.hidden = false;

    } catch (error) {
        console.error("Authentication error:", error);
        window.location.replace("LoginPage.html");
    }
}

checkPatientSession();
