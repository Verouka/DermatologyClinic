


async function loadPatientProfile() {
    try {
        const response = await fetch(
            "/api/patient/me",
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


const editButton = document.querySelector(".editBtn");
const phoneInput = document.getElementById("phone");
const addressInput = document.getElementById("address");

editButton.addEventListener("click", async () => {

    if (editButton.textContent.trim() === "Edit Profile") {
        phoneInput.readOnly = false;
        addressInput.readOnly = false;

        editButton.textContent = "Save Changes";
        phoneInput.focus();
        return;
    }

    const phone = phoneInput.value.trim();
    const address = addressInput.value.trim();

    if (!/^\d{3}-\d{3}-\d{4}$/.test(phone)) {
        alert("Phone number must be in the format 123-456-7890");
        return;
    }

    if (!address || address.length > 45) {
        alert("Address must contain between 1 and 45 characters.");
        return;
    }

    editButton.disabled = true;

    try {
        const response = await fetch(
            "/api/patient/me",
            {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ phone, address })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not update profile");
        }

        phoneInput.readOnly = true;
        addressInput.readOnly = true;

        editButton.textContent = "Edit Profile";

        alert("Profile updated successfully!");

    } catch (error) {
        console.error("Profile update error:", error);
        alert(error.message);
    } finally {
        editButton.disabled = false;
    }
});
