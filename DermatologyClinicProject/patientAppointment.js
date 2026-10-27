


async function loadPatientAppointments() {
    const upcomingBody = document.getElementById("upcomingAppointmentsBody");
    const pastBody = document.getElementById("pastAppointmentsBody");

    try {
        const response = await fetch(
            "http://127.0.0.1:3000/api/patient/appointments",
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!response.ok) {
            throw new Error("Could not load appointments");
        }

        const appointments = await response.json();

        upcomingBody.innerHTML = "";
        pastBody.innerHTML = "";

        const now = new Date();

        // Cancelled appointments go to history, regardless of date.
        function isCancelled(appointment) {
            const status = (appointment.Appointment_Status || "")
                .toLowerCase();

            return status === "cancelled" || status === "canceled";
        }

        function getAppointmentDateTime(appointment) {
            const date = String(appointment.Appointment_Date).slice(0, 10);
            const time = appointment.Appointment_Time || "00:00:00";

            return new Date(`${date}T${time}`);
        }

        const upcoming = appointments.filter(appointment => {
            return !isCancelled(appointment) &&
                getAppointmentDateTime(appointment) >= now;
        });

        const past = appointments.filter(appointment => {
            return isCancelled(appointment) ||
                getAppointmentDateTime(appointment) < now;
        });

        function addRows(items, tbody, isUpcoming) {

            if (items.length === 0) {
                const row = tbody.insertRow();
                const cell = row.insertCell();

                cell.colSpan = isUpcoming ? 7 : 6;

                cell.textContent = isUpcoming
                    ? "No upcoming appointments found."
                    : "No appointment history found.";

                return;
            }

            items.forEach(appointment => {
                const row = tbody.insertRow();

                const doctorName =
                    `Dr. ${appointment.Doctor_First_Name} ${appointment.Doctor_Last_Name}`;

                const officeLocation =
                    `${appointment.Office_Street}, ${appointment.Office_City}, ${appointment.Office_State}`;

                const values = [
                    appointment.Appointment_Date
                        ? String(appointment.Appointment_Date).slice(0, 10)
                        : "",
                    appointment.Appointment_Time || "",
                    doctorName,
                    appointment.Appointment_Description || "",
                    officeLocation,
                    appointment.Appointment_Status || "Pending"
                ];

                values.forEach(value => {
                    const cell = row.insertCell();
                    cell.textContent = value;
                });

                if (isUpcoming) {
                    const actionCell = row.insertCell();

                    if (appointment.Appointment_Status === "Pending") {
                        const cancelButton = document.createElement("button");

                        cancelButton.textContent = "Cancel";
                        cancelButton.type = "button";
                        cancelButton.className = "cancelBtn";

                        cancelButton.addEventListener("click", async () => {
                            const confirmed = confirm(
                                "Are you sure you want to cancel this appointment?"
                            );

                            if (!confirmed) return;

                            cancelButton.disabled = true;

                            try {
                                const response = await fetch(
                                    `http://127.0.0.1:3000/api/patient/appointments/${appointment.Appointment_ID}/cancel`,
                                    {
                                        method: "PATCH",
                                        credentials: "include"
                                    }
                                );

                                const result = await response.json();

                                if (!response.ok) {
                                    throw new Error(
                                        result.error || "Could not cancel appointment"
                                    );
                                }

                                alert("Appointment cancelled successfully!");

                                await loadPatientAppointments();

                            } catch (error) {
                                console.error("Cancellation error:", error);
                                alert(error.message);
                                cancelButton.disabled = false;
                            }
                        });

                        actionCell.appendChild(cancelButton);

                    } else {
                        actionCell.textContent = "—";
                    }
                }
            });
        }

        addRows(upcoming, upcomingBody, true);
        addRows(past, pastBody, false);

    } catch (error) {
        console.error("Appointment loading error:", error);

        upcomingBody.innerHTML =
            '<tr><td colspan="7">Could not load appointments.</td></tr>';

        pastBody.innerHTML =
            '<tr><td colspan="6">Could not load appointments.</td></tr>';
    }
}

loadPatientAppointments();
