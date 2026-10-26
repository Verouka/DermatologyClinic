

async function loadPatientProfile() {
    try {
        const response = await fetch(
            "http://127.0.0.1:3000/api/patient/me",
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!response.ok) {
            throw new Error("Could not load patient profile");
        }

        const patient = await response.json();

        document.getElementById("FirstName").value =
            patient.First_Name || "";

        document.getElementById("LastName").value =
            patient.Last_Name || "";

        document.getElementById("dateOfBirth").value =
            patient.BirthDate
                ? String(patient.BirthDate).slice(0, 10)
                : "";

        document.getElementById("patientID").value =
            patient.Patient_ID || "";

        document.getElementById("email").value =
            patient.Email || "";

        document.getElementById("phone").value =
            patient.Phone || "";

        document.getElementById("address").value =
            patient.Street || "";

    } catch (error) {
        console.error("Profile loading error:", error);
        alert("Could not load your profile information.");
    }
}

loadPatientProfile();
