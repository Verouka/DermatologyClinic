
const API_URL = "";

const nurseProfileForm = document.getElementById("nurseProfileForm");
const nurseProfileStatus = document.getElementById("nurseProfileStatus");

function setField(name, value) {
    const field = nurseProfileForm.elements.namedItem(name);

    if (field) {
        field.value = value ?? "";
    }
}

function getField(name) {
    const field = nurseProfileForm.elements.namedItem(name);
    return field ? field.value.trim() : "";
}

async function loadNurseProfile() {
    nurseProfileStatus.textContent = "Loading profile...";

    try {
        const response = await fetch(
            `${API_URL}/api/nurse/profile`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Could not load nurse profile."
            );
        }

        setField("Nurse_ID", result.Nurse_ID);
        setField("License_Number", result.License_Number);
        setField("First_Name", result.First_Name);
        setField("Last_Name", result.Last_Name);
        setField("Email", result.Email);
        setField("Phone", result.Phone);
        setField("Street", result.Street);
        setField("City", result.City);
        setField("State", result.State);
        setField("Zip_Code", result.Zip_Code);
        setField("OFFICE_Office_ID", result.OFFICE_Office_ID);

        if (result.Start_Date) {
            setField(
                "Start_Date",
                String(result.Start_Date).slice(0, 10)
            );
        } else {
            setField("Start_Date", "");
        }

        nurseProfileStatus.textContent = "";

    } catch (error) {
        console.error("Nurse profile error:", error);
        nurseProfileStatus.textContent = error.message;
    }
}

nurseProfileForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!nurseProfileForm.reportValidity()) {
        return;
    }

    const profileData = {
        firstName: getField("First_Name"),
        lastName: getField("Last_Name"),
        email: getField("Email"),
        phone: getField("Phone"),
        street: getField("Street"),
        city: getField("City"),
        state: getField("State"),
        zipCode: getField("Zip_Code")
    };

    const saveButton = nurseProfileForm.querySelector(
        'button[type="submit"]'
    );

    saveButton.disabled = true;
    nurseProfileStatus.textContent = "Saving changes...";

    try {
        const response = await fetch(
            `${API_URL}/api/nurse/profile`,
            {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(profileData)
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Could not save profile."
            );
        }

        nurseProfileStatus.textContent =
            "Profile updated successfully!";

        await loadNurseProfile();

        nurseProfileStatus.textContent =
            "Profile updated successfully!";

    } catch (error) {
        console.error("Nurse profile update error:", error);
        nurseProfileStatus.textContent = error.message;

    } finally {
        saveButton.disabled = false;
    }
});

loadNurseProfile();
