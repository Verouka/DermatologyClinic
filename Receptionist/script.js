document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       BACKEND CONFIGURATION
       No sample data lives in this file. Everything is loaded
       from your server. Change these values to match your API.

       Expected endpoints (JSON):
         GET   /api/receptionist/me      -> { name, role, address, phone, email }
         PATCH /api/receptionist/me      <- { phone, address, email }
         POST  /api/receptionist/password<- { currentPassword, newPassword }
         GET   /api/patients             -> [{ id, firstName, lastName, dob, phone, email, address }]
         POST  /api/patients             <- patient object -> created patient
         GET   /api/doctors              -> [{ id, name }]
         GET   /api/appointments         -> [{ id, patientId, doctorId, date, time, reason,
                                              status, visitStatus }]
                                            date = "YYYY-MM-DD", time = "HH:MM"
                                            status = Pending | Scheduled | Cancelled | Rejected
                                            visitStatus = Scheduled | Checked In | Checked Out
         POST  /api/appointments         <- appointment fields -> created appointment
         PATCH /api/appointments/:id     <- any changed fields -> updated appointment
         GET   /api/invoices             -> [{ id, patientId, date, amount, status }]
                                            status = Paid | Unpaid
         PATCH /api/invoices/:id         <- { status }
         POST  /api/logout
       ===================================================== */

    const API_BASE = "";                // e.g. "https://api.yourclinic.com"
    const LOGIN_PAGE = "/LoginPage.html";    // where to send the user on logout / expired session

    const CLINIC_DAYS = [1, 2, 3, 4, 5]; // Monday–Friday
    const CLINIC_OPEN = "09:00";
    const CLINIC_CLOSE = "17:00";

    // ---------- State (starts empty, filled from the server) ----------
    const today = getLocalDate();

    let patients = [];
    let doctors = [];
    let appointments = [];
    let invoices = [];
    let profile = { name: "", role: "Receptionist", address: "", phone: "", email: "" };

    let settings = loadPreferences();
    let editingAppointmentId = null;
    let toastTimeout;
    let idleTimer;

    const sections = document.querySelectorAll(".pageSection");
    const navLinks = document.querySelectorAll(".navLink");
    const modal = document.getElementById("appointmentModal");
    const appointmentForm = document.getElementById("appointmentForm");
    const patientForm = document.getElementById("patientForm");

    // =====================================================
    // API HELPER
    // =====================================================

    async function api(path, options = {}) {
        const response = await fetch(API_BASE + path, {
            method: options.method || "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: options.body ? JSON.stringify(options.body) : undefined
        });

        if (response.status === 401) {
            window.location.href = LOGIN_PAGE;
            throw new Error("Session expired");
        }

        if (!response.ok) {
            let message = "Request failed (" + response.status + ")";
            try {
                const data = await response.json();
                if (data && data.message) message = data.message;
            } catch (e) { /* response had no JSON body */ }
            throw new Error(message);
        }

        if (response.status === 204) return null;

        try {
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    function showError(message) {
        const banner = document.getElementById("errorBanner");
        banner.textContent = message;
        banner.hidden = !message;
    }

    // =====================================================
    // GENERAL HELPERS
    // =====================================================

    function getLocalDate() {
        const d = new Date();
        return d.getFullYear() + "-" +
            String(d.getMonth() + 1).padStart(2, "0") + "-" +
            String(d.getDate()).padStart(2, "0");
    }

    function formatDate(dateString) {
        if (!dateString) return "—";
        const parts = String(dateString).slice(0, 10).split("-");
        if (parts.length !== 3) return dateString;
        const [year, month, day] = parts;

        if (settings.dateFormat === "DD/MM/YYYY") return `${day}/${month}/${year}`;
        if (settings.dateFormat === "YYYY-MM-DD") return `${year}-${month}-${day}`;
        return `${month}/${day}/${year}`;
    }

    function formatTime(timeString) {
        if (!timeString) return "—";
        const parts = String(timeString).split(":");
        const hour = Number(parts[0]);
        const minute = parts[1];

        if (settings.timeFormat === "24") {
            return `${String(hour).padStart(2, "0")}:${minute}`;
        }
        return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
            .format(Number(amount) || 0);
    }

    function escapeHTML(value) {
        const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
        return String(value ?? "").replace(/[&<>"']/g, function (c) { return map[c]; });
    }

    function padId(prefix, id) {
        return `${prefix}-${String(id).padStart(4, "0")}`;
    }

    function getPatientName(patientId) {
        const p = patients.find(function (x) { return x.id === patientId; });
        return p ? `${p.firstName} ${p.lastName}` : "Unknown Patient";
    }

    function getDoctorName(appointment) {
        if (appointment.doctorName) return appointment.doctorName;
        const d = doctors.find(function (x) { return x.id === appointment.doctorId; });
        return d ? d.name : "Unassigned";
    }

    function statusClass(status) {
        return {
            "Pending": "pending", "Cancelled": "cancelled", "Rejected": "rejected",
            "Scheduled": "scheduled", "Checked In": "checked-in", "Checked Out": "checked-out",
            "Paid": "paid", "Unpaid": "unpaid"
        }[status] || "";
    }

    function showToast(message) {
        const toast = document.getElementById("toast");
        toast.textContent = message;
        toast.classList.add("show");
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(function () { toast.classList.remove("show"); }, 3000);
    }

    function isActiveAppointment(a) {
        return a.status !== "Cancelled" && a.status !== "Rejected";
    }

    function isUpcoming(a) {
        return a.date >= today && isActiveAppointment(a) && a.visitStatus !== "Checked Out";
    }

    function byDateTime(a, b) {
        return String(a.date).localeCompare(String(b.date)) ||
            String(a.time).localeCompare(String(b.time));
    }

    function emptyRow(cols, message) {
        return `<tr><td colspan="${cols}">${escapeHTML(message)}</td></tr>`;
    }

    function setBusy(form, busy) {
        form.querySelectorAll("button[type=submit]").forEach(function (b) { b.disabled = busy; });
    }

    // =====================================================
    // PREFERENCES (stored in this browser only)
    // =====================================================

    function loadPreferences() {
        const defaults = {
            dateFormat: "MM/DD/YYYY", timeFormat: "12", notifications: "on",
            timeout: "0", startPage: "dashboard"
        };
        try {
            return Object.assign(defaults, JSON.parse(localStorage.getItem("receptionistPrefs") || "{}"));
        } catch (e) {
            return defaults;
        }
    }

    function savePreferences() {
        try {
            localStorage.setItem("receptionistPrefs", JSON.stringify(settings));
        } catch (e) { /* storage unavailable */ }
    }

    // =====================================================
    // NAVIGATION
    // =====================================================

    function showSection(sectionId) {
        const target = document.getElementById(sectionId);
        if (!target || !target.classList.contains("pageSection")) return;

        sections.forEach(function (s) { s.classList.toggle("active", s.id === sectionId); });
        navLinks.forEach(function (l) { l.classList.toggle("active", l.dataset.section === sectionId); });

        if (window.location.hash !== `#${sectionId}`) window.location.hash = sectionId;
    }

    navLinks.forEach(function (link) {
        link.addEventListener("click", function (e) {
            e.preventDefault();
            showSection(link.dataset.section);
        });
    });

    document.querySelectorAll("[data-go]").forEach(function (b) {
        b.addEventListener("click", function () { showSection(b.dataset.go); });
    });

    window.addEventListener("hashchange", function () {
        const id = window.location.hash.slice(1);
        if (id) showSection(id);
    });

    // =====================================================
    // HEADER / PROFILE
    // =====================================================

    function renderHeaderDate() {
        document.getElementById("currentDate").textContent =
            new Date().toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric", year: "numeric"
            });
    }

    function renderProfile() {
        const dash = "—";
        document.getElementById("profileName").textContent = profile.name || dash;
        document.getElementById("profileRole").textContent = profile.role || "Receptionist";
        document.getElementById("profileAddress").textContent = profile.address || dash;
        document.getElementById("profilePhone").textContent = profile.phone || dash;

        document.getElementById("settingsPhone").value = profile.phone || "";
        document.getElementById("settingsAddress").value = profile.address || "";
        document.getElementById("settingsEmail").value = profile.email || "";

        const first = (profile.name || "").trim().split(" ")[0];
        document.getElementById("userIcon").textContent =
            profile.name ? profile.name.charAt(0).toUpperCase() : "R";
        document.getElementById("userLabel").textContent = profile.name || "Receptionist";
        document.getElementById("welcomeHeading").textContent =
            first ? `WELCOME, ${first.toUpperCase()}` : "WELCOME, RECEPTIONIST";
    }

    function populatePreferences() {
        document.getElementById("settingsDateFormat").value = settings.dateFormat;
        document.getElementById("settingsTimeFormat").value = settings.timeFormat;
        document.getElementById("settingsNotifications").value = settings.notifications;
        document.getElementById("settingsTimeout").value = settings.timeout;
        document.getElementById("settingsStartPage").value = settings.startPage;
    }

    // =====================================================
    // MY SCHEDULE (clinic hours: Mon–Fri, 9 AM – 5 PM)
    // =====================================================

    function highlightToday() {
        const day = String(new Date().getDay());
        document.querySelectorAll("#scheduleTable tr").forEach(function (row) {
            row.classList.toggle("todayRow", row.dataset.day === day);
        });
    }

    // =====================================================
    // SUMMARY
    // =====================================================

    function updateSummary() {
        const todays = appointments.filter(function (a) {
            return a.date === today && isActiveAppointment(a);
        });
        const pending = appointments.filter(function (a) { return a.status === "Pending"; });
        const approved = appointments.filter(function (a) { return a.status === "Scheduled"; });

        document.getElementById("totalPatients").textContent = patients.length;
        document.getElementById("totalAppointments").textContent = todays.length;
        document.getElementById("totalPending").textContent = pending.length;

        document.getElementById("reportPatients").textContent = patients.length;
        document.getElementById("reportAppointments").textContent = appointments.length;
        document.getElementById("reportApproved").textContent = approved.length;
    }

    // =====================================================
    // PATIENTS
    // =====================================================

    function renderPatients() {
        const table = document.getElementById("patientTable");
        const search = document.getElementById("patientSearch").value.trim().toLowerCase();

        const filtered = patients.filter(function (p) {
            return [padId("P", p.id), p.firstName, p.lastName, `${p.firstName} ${p.lastName}`, p.phone, p.email]
                .join(" ").toLowerCase().includes(search);
        });

        if (filtered.length === 0) {
            table.innerHTML = emptyRow(5, patients.length === 0
                ? "No patients registered yet."
                : "No matching patients found.");
            return;
        }

        table.innerHTML = filtered.map(function (p) {
            return `
                <tr>
                    <td>${padId("P", p.id)}</td>
                    <td>${escapeHTML(p.firstName)} ${escapeHTML(p.lastName)}</td>
                    <td>${escapeHTML(formatDate(p.dob))}</td>
                    <td>${escapeHTML(p.phone)}</td>
                    <td>${escapeHTML(p.email || "—")}</td>
                </tr>`;
        }).join("");
    }

    document.getElementById("patientSearch").addEventListener("input", renderPatients);

    patientForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const data = {
            firstName: document.getElementById("patientFirstName").value.trim(),
            lastName: document.getElementById("patientLastName").value.trim(),
            dob: document.getElementById("patientDOB").value,
            phone: document.getElementById("patientPhone").value.trim(),
            email: document.getElementById("patientEmail").value.trim(),
            address: document.getElementById("patientAddress").value.trim(),
            reason: document.getElementById("patientReason").value
        };

        if (!data.firstName || !data.lastName || !data.dob || !data.phone) {
            showToast("Please complete all required fields.");
            return;
        }
        if (data.dob > today) {
            showToast("Date of birth cannot be in the future.");
            return;
        }

        setBusy(patientForm, true);
        try {
            const created = await api("/api/patients", { method: "POST", body: data });
            patients.push(created);
            patientForm.reset();
            renderAll();
            showToast("Patient registered successfully.");
            showSection("patients");
        } catch (error) {
            showToast(error.message);
        } finally {
            setBusy(patientForm, false);
        }
    });

    // =====================================================
    // APPOINTMENT TABLES
    // =====================================================

    function statusBadge(status) {
        return `<span class="status ${statusClass(status)}">${escapeHTML(status)}</span>`;
    }

    function renderTodayAppointments() {
        const table = document.getElementById("todayTable");
        const list = appointments
            .filter(function (a) { return a.date === today && isActiveAppointment(a); })
            .sort(byDateTime);

        if (list.length === 0) {
            table.innerHTML = emptyRow(6, "No appointments scheduled today.");
            return;
        }

        table.innerHTML = list.map(function (a) {
            return `
                <tr>
                    <td>${escapeHTML(getPatientName(a.patientId))}</td>
                    <td>${escapeHTML(formatTime(a.time))}</td>
                    <td>${escapeHTML(getDoctorName(a))}</td>
                    <td>${escapeHTML(a.reason)}</td>
                    <td>${statusBadge(a.status)}</td>
                    <td><button class="tableButton" data-action="view" data-id="${a.id}">View</button></td>
                </tr>`;
        }).join("");
    }

    function renderAppointments() {
        const table = document.getElementById("appointmentsTable");
        const list = appointments.filter(isUpcoming).sort(byDateTime);

        if (list.length === 0) {
            table.innerHTML = emptyRow(7, "No upcoming appointments.");
            return;
        }

        table.innerHTML = list.map(function (a) {
            let buttons = `<button class="tableButton" data-action="edit" data-id="${a.id}">Reschedule</button>`;

            if (a.status === "Pending") {
                buttons += `<button class="tableButton" data-action="approve" data-id="${a.id}">Approve</button>`;
            }
            buttons += `<button class="dangerButton" data-action="cancel" data-id="${a.id}">Cancel</button>`;

            return `
                <tr>
                    <td>${escapeHTML(getPatientName(a.patientId))}</td>
                    <td>${escapeHTML(formatDate(a.date))}</td>
                    <td>${escapeHTML(formatTime(a.time))}</td>
                    <td>${escapeHTML(getDoctorName(a))}</td>
                    <td>${escapeHTML(a.reason)}</td>
                    <td>${statusBadge(a.status)}</td>
                    <td><div class="tableActions">${buttons}</div></td>
                </tr>`;
        }).join("");
    }

    function renderRequests() {
        const table = document.getElementById("requestsTable");
        const list = appointments.filter(function (a) { return a.status === "Pending"; }).sort(byDateTime);

        if (list.length === 0) {
            table.innerHTML = emptyRow(7, "There are no pending appointment requests.");
            return;
        }

        table.innerHTML = list.map(function (a) {
            return `
                <tr>
                    <td>${escapeHTML(getPatientName(a.patientId))}</td>
                    <td>${escapeHTML(formatDate(a.date))}</td>
                    <td>${escapeHTML(formatTime(a.time))}</td>
                    <td>${escapeHTML(getDoctorName(a))}</td>
                    <td>${escapeHTML(a.reason)}</td>
                    <td>${statusBadge("Pending")}</td>
                    <td>
                        <div class="tableActions">
                            <button class="tableButton" data-action="approve" data-id="${a.id}">Approve</button>
                            <button class="dangerButton" data-action="reject" data-id="${a.id}">Reject</button>
                        </div>
                    </td>
                </tr>`;
        }).join("");
    }

    // =====================================================
    // CHECK-IN / CHECK-OUT
    // =====================================================

    function renderCheckin() {
        const table = document.getElementById("checkinTable");
        const search = document.getElementById("checkinSearch").value.trim().toLowerCase();
        const statusFilter = document.getElementById("visitStatusFilter").value;

        const list = appointments
            .filter(isActiveAppointment)
            .filter(function (a) {
                const text = [padId("A", a.id), a.id, getPatientName(a.patientId), getDoctorName(a), a.reason, a.date]
                    .join(" ").toLowerCase();
                return text.includes(search) && (!statusFilter || a.visitStatus === statusFilter);
            })
            .sort(byDateTime);

        if (list.length === 0) {
            table.innerHTML = emptyRow(6, appointments.length === 0
                ? "No appointments to check in."
                : "No matching appointments found.");
            return;
        }

        table.innerHTML = list.map(function (a) {
            let action;
            if (a.visitStatus === "Checked In") {
                action = `<button class="tableButton" data-action="checkout" data-id="${a.id}">Check Out</button>`;
            } else if (a.visitStatus === "Checked Out") {
                action = `<span class="status checked-out">Visit Complete</span>`;
            } else {
                action = `<button class="tableButton" data-action="checkin" data-id="${a.id}">Check In</button>`;
            }

            return `
                <tr>
                    <td>${escapeHTML(getPatientName(a.patientId))}</td>
                    <td>${padId("A", a.id)}<br>${escapeHTML(formatDate(a.date))}</td>
                    <td>${escapeHTML(formatTime(a.time))}</td>
                    <td>${escapeHTML(getDoctorName(a))}</td>
                    <td>${statusBadge(a.visitStatus || "Scheduled")}</td>
                    <td>${action}</td>
                </tr>`;
        }).join("");
    }

    document.getElementById("checkinSearch").addEventListener("input", renderCheckin);
    document.getElementById("visitStatusFilter").addEventListener("change", renderCheckin);

    // =====================================================
    // BILLING
    // =====================================================

    function renderBilling() {
        const table = document.getElementById("billingTable");
        const search = document.getElementById("billingSearch").value.trim().toLowerCase();

        const list = invoices.filter(function (inv) {
            return [padId("I", inv.id), inv.id, getPatientName(inv.patientId), inv.date, inv.status]
                .join(" ").toLowerCase().includes(search);
        });

        if (list.length === 0) {
            table.innerHTML = emptyRow(6, invoices.length === 0
                ? "No billing records yet."
                : "No matching billing records found.");
            return;
        }

        table.innerHTML = list.map(function (inv) {
            const action = inv.status === "Unpaid"
                ? `<button class="tableButton" data-action="pay" data-id="${inv.id}">Mark Paid</button>`
                : `<span class="status paid">Paid</span>`;

            return `
                <tr>
                    <td>${padId("I", inv.id)}</td>
                    <td>${escapeHTML(getPatientName(inv.patientId))}</td>
                    <td>${escapeHTML(formatDate(inv.date))}</td>
                    <td>${escapeHTML(formatCurrency(inv.amount))}</td>
                    <td>${statusBadge(inv.status)}</td>
                    <td>${action}</td>
                </tr>`;
        }).join("");
    }

    document.getElementById("billingSearch").addEventListener("input", renderBilling);

    // =====================================================
    // SETTINGS FORMS
    // =====================================================

    const contactForm = document.getElementById("contactForm");

    contactForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const phone = document.getElementById("settingsPhone").value.trim();
        const address = document.getElementById("settingsAddress").value.trim();
        const email = document.getElementById("settingsEmail").value.trim();

        if (!phone) {
            showToast("Phone number cannot be empty.");
            return;
        }

        setBusy(contactForm, true);
        try {
            const updated = await api("/api/receptionist/me", {
                method: "PATCH",
                body: { phone: phone, address: address, email: email }
            });
            profile = Object.assign(profile, updated || { phone: phone, address: address, email: email });
            renderProfile();
            showToast("Contact information updated.");
        } catch (error) {
            showToast(error.message);
        } finally {
            setBusy(contactForm, false);
        }
    });

    document.getElementById("preferencesForm").addEventListener("submit", function (event) {
        event.preventDefault();

        settings.dateFormat = document.getElementById("settingsDateFormat").value;
        settings.timeFormat = document.getElementById("settingsTimeFormat").value;
        settings.notifications = document.getElementById("settingsNotifications").value;
        settings.timeout = document.getElementById("settingsTimeout").value;
        settings.startPage = document.getElementById("settingsStartPage").value;

        savePreferences();
        resetIdleTimer();
        renderAll();
        showToast("Preferences saved.");
    });

    const passwordForm = document.getElementById("passwordForm");

    passwordForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const currentPassword = document.getElementById("currentPassword").value;
        const newPassword = document.getElementById("newPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (newPassword.length < 8) {
            showToast("New password must be at least 8 characters.");
            return;
        }
        if (newPassword !== confirmPassword) {
            showToast("New passwords do not match.");
            return;
        }

        setBusy(passwordForm, true);
        try {
            await api("/api/receptionist/password", {
                method: "POST",
                body: { currentPassword: currentPassword, newPassword: newPassword }
            });
            passwordForm.reset();
            showToast("Password updated.");
        } catch (error) {
            showToast(error.message);
        } finally {
            setBusy(passwordForm, false);
        }
    });

    // =====================================================
    // TABLE ACTIONS
    // =====================================================

    async function updateAppointment(id, changes, successMessage) {
        try {
            const updated = await api(`/api/appointments/${id}`, { method: "PATCH", body: changes });
            const appointment = appointments.find(function (a) { return a.id === id; });
            Object.assign(appointment, updated || changes);
            renderAll();
            showToast(successMessage);
        } catch (error) {
            showToast(error.message);
        }
    }

    document.addEventListener("click", async function (event) {
        const button = event.target.closest("[data-action]");
        if (!button) return;

        const action = button.dataset.action;
        const id = Number(button.dataset.id);

        if (action === "pay") {
            const invoice = invoices.find(function (i) { return i.id === id; });
            if (!invoice || invoice.status === "Paid") return;

            if (!window.confirm(`Mark invoice ${padId("I", invoice.id)} for ${formatCurrency(invoice.amount)} as paid?`)) return;

            try {
                const updated = await api(`/api/invoices/${id}`, { method: "PATCH", body: { status: "Paid" } });
                Object.assign(invoice, updated || { status: "Paid" });
                renderBilling();
                showToast("Invoice marked as paid.");
            } catch (error) {
                showToast(error.message);
            }
            return;
        }

        const appointment = appointments.find(function (a) { return a.id === id; });
        if (!appointment) return;
        const name = getPatientName(appointment.patientId);

        if (action === "view") {
            showToast(`${name} — ${formatDate(appointment.date)} at ${formatTime(appointment.time)} with ${getDoctorName(appointment)}`);
        } else if (action === "edit") {
            openAppointmentModal(appointment);
        } else if (action === "approve") {
            updateAppointment(id, { status: "Scheduled" }, "Appointment request approved.");
        } else if (action === "reject") {
            updateAppointment(id, { status: "Rejected" }, "Appointment request rejected.");
        } else if (action === "cancel") {
            if (window.confirm("Are you sure you want to cancel this appointment?")) {
                updateAppointment(id, { status: "Cancelled" }, "Appointment cancelled.");
            }
        } else if (action === "checkin") {
            if (appointment.status === "Pending") {
                showToast("Approve the appointment before checking in.");
                return;
            }
            updateAppointment(id, { visitStatus: "Checked In" }, `${name} checked in.`);
        } else if (action === "checkout") {
            if (appointment.visitStatus !== "Checked In") {
                showToast("Check in the patient before checking out.");
                return;
            }
            updateAppointment(id, { visitStatus: "Checked Out" }, `${name} checked out.`);
        }
    });

    // =====================================================
    // APPOINTMENT MODAL
    // =====================================================

    function populateSelects(patientId, doctorId) {
        document.getElementById("appointmentPatient").innerHTML = patients.map(function (p) {
            return `<option value="${p.id}" ${p.id === patientId ? "selected" : ""}>${escapeHTML(p.firstName)} ${escapeHTML(p.lastName)}</option>`;
        }).join("");

        const doctorSelect = document.getElementById("appointmentDoctor");
        doctorSelect.innerHTML = doctors.length === 0
            ? '<option value="">No doctors available</option>'
            : doctors.map(function (d) {
                return `<option value="${d.id}" ${d.id === doctorId ? "selected" : ""}>${escapeHTML(d.name)}</option>`;
            }).join("");
    }

    function openAppointmentModal(appointment = null) {
        if (patients.length === 0) {
            showToast("Register a patient before creating an appointment.");
            showSection("registration");
            return;
        }
        if (doctors.length === 0) {
            showToast("No doctors are available yet. Check your server connection.");
            return;
        }

        appointmentForm.reset();
        editingAppointmentId = appointment ? appointment.id : null;

        document.getElementById("appointmentModalTitle").textContent =
            appointment ? "Reschedule Appointment" : "New Appointment";

        populateSelects(
            appointment ? appointment.patientId : patients[0].id,
            appointment ? appointment.doctorId : doctors[0].id
        );

        document.getElementById("appointmentDate").value = appointment ? appointment.date : today;
        document.getElementById("appointmentTime").value = appointment ? appointment.time : CLINIC_OPEN;
        document.getElementById("appointmentReason").value = appointment ? appointment.reason : "";

        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
    }

    function closeAppointmentModal() {
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
        editingAppointmentId = null;
    }

    document.getElementById("addAppointmentButton").addEventListener("click", function () {
        openAppointmentModal();
    });
    document.getElementById("closeModalButton").addEventListener("click", closeAppointmentModal);
    document.getElementById("cancelModalButton").addEventListener("click", closeAppointmentModal);

    modal.addEventListener("click", function (e) {
        if (e.target === modal) closeAppointmentModal();
    });

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeAppointmentModal();
    });

    appointmentForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const data = {
            patientId: Number(document.getElementById("appointmentPatient").value),
            doctorId: Number(document.getElementById("appointmentDoctor").value),
            date: document.getElementById("appointmentDate").value,
            time: document.getElementById("appointmentTime").value,
            reason: document.getElementById("appointmentReason").value.trim()
        };

        if (!data.patientId || !data.doctorId || !data.date || !data.time || !data.reason) {
            showToast("Please complete all appointment fields.");
            return;
        }
        if (data.date < today) {
            showToast("Please select today or a future date.");
            return;
        }

        const [y, m, d] = data.date.split("-").map(Number);
        if (!CLINIC_DAYS.includes(new Date(y, m - 1, d).getDay())) {
            showToast("The clinic is open Monday to Friday only.");
            return;
        }
        if (data.time < CLINIC_OPEN || data.time >= CLINIC_CLOSE) {
            showToast("Appointments must be between 9:00 AM and 5:00 PM.");
            return;
        }

        const conflict = appointments.find(function (a) {
            return a.id !== editingAppointmentId &&
                a.doctorId === data.doctorId &&
                a.date === data.date &&
                a.time === data.time &&
                isActiveAppointment(a);
        });
        if (conflict) {
            showToast("That doctor already has an appointment at that date and time.");
            return;
        }

        setBusy(appointmentForm, true);
        try {
            if (editingAppointmentId !== null) {
                const updated = await api(`/api/appointments/${editingAppointmentId}`, {
                    method: "PATCH", body: data
                });
                const existing = appointments.find(function (a) { return a.id === editingAppointmentId; });
                Object.assign(existing, updated || data);
                showToast("Appointment updated successfully.");
            } else {
                const created = await api("/api/appointments", {
                    method: "POST",
                    body: Object.assign({ status: "Scheduled", visitStatus: "Scheduled" }, data)
                });
                appointments.push(created);
                showToast("New appointment created successfully.");
            }
            closeAppointmentModal();
            renderAll();
        } catch (error) {
            showToast(error.message);
        } finally {
            setBusy(appointmentForm, false);
        }
    });

    // =====================================================
    // LOGOUT AND AUTO-LOGOUT
    // =====================================================

    async function logout() {
        try {
            await api("/api/auth/logout", { method: "POST" });
        } catch (e) { /* leave the page even if the call fails */ }
        window.location.href = LOGIN_PAGE;
    }

    document.getElementById("logoutButton").addEventListener("click", logout);

    function resetIdleTimer() {
        clearTimeout(idleTimer);
        const minutes = Number(settings.timeout);
        if (!minutes) return;
        idleTimer = setTimeout(logout, minutes * 60 * 1000);
    }

    ["click", "keydown", "mousemove", "touchstart"].forEach(function (name) {
        document.addEventListener(name, resetIdleTimer, { passive: true });
    });

    // =====================================================
    // RENDER + LOAD
    // =====================================================

    function renderAll() {
        renderPatients();
        renderTodayAppointments();
        renderAppointments();
        renderRequests();
        renderCheckin();
        renderBilling();
        updateSummary();
    }

    async function loadData() {
        showError("");

        const jobs = [
            api("/api/receptionist/me").then(function (r) { profile = Object.assign(profile, r); renderProfile(); }),
            api("/api/patients").then(function (r) { patients = r || []; }),
            api("/api/doctors").then(function (r) { doctors = r || []; }),
            api("/api/appointments").then(function (r) { appointments = r || []; }),
            api("/api/invoices").then(function (r) { invoices = r || []; })
        ];

        const results = await Promise.allSettled(jobs);
        renderAll();

        if (results.some(function (r) { return r.status === "rejected"; })) {
            showError("Some information could not be loaded. Check your connection to the server and refresh the page.");
        }
    }

    // =====================================================
    // INITIALIZE
    // =====================================================

    document.getElementById("patientDOB").max = today;
    document.getElementById("appointmentDate").min = today;

    renderHeaderDate();
    highlightToday();
    populatePreferences();
    renderProfile();
    renderAll();
    resetIdleTimer();

    const initial = window.location.hash.slice(1);
    const initialEl = document.getElementById(initial);

    if (initialEl && initialEl.classList.contains("pageSection")) {
        showSection(initial);
    } else {
        showSection(settings.startPage || "dashboard");
    }

    loadData();
});