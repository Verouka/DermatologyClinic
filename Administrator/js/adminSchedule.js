const API_BASE = "http://127.0.0.1:3000/api/admin/schedule";

const officeSelect = document.getElementById("officeId");
const officeMessage = document.getElementById("officeMessage");

const weeklyScheduleSection = document.getElementById("weeklyScheduleSection");
const weeklyScheduleTableBody = document.getElementById("weeklyScheduleTableBody");
const weeklyScheduleMessage = document.getElementById("weeklyScheduleMessage");

const scheduleSection = document.getElementById("scheduleSection");
const editScheduleTitle = document.getElementById("editScheduleTitle");
const daySelect = document.getElementById("dayOfWeek");
const dayStatus = document.getElementById("dayStatus");
const officeHoursDisplay = document.getElementById("officeHoursDisplay");

const dayScheduleContainer = document.getElementById("dayScheduleContainer");
const dayScheduleTableBody = document.getElementById("dayScheduleTableBody");

const addTimeSlotBtn = document.getElementById("addTimeSlotBtn");
const scheduleActions = document.getElementById("scheduleActions");
const saveScheduleBtn = document.getElementById("saveScheduleBtn");
const cancelScheduleBtn = document.getElementById("cancelScheduleBtn");
const scheduleMessage = document.getElementById("scheduleMessage");

const DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
];

const STAFF_ROLES = [
    {
        key: "doctorId",
        role: "doctor",
        label: "Doctor"
    },
    {
        key: "nurseId",
        role: "nurse",
        label: "Nurse"
    },
    {
        key: "receptionistId",
        role: "receptionist",
        label: "Receptionist"
    },
    {
        key: "administratorId",
        role: "administrator",
        label: "Administrator"
    }
];

let offices = [];

let staff = {
    doctor: [],
    nurse: [],
    receptionist: [],
    administrator: []
};

let weeklySchedule = [];
let draftSchedule = [];

let selectedOfficeId = null;
let selectedDay = null;

let officeHours = null;
let isClosedDay = false;
let isDirty = false;


// --------------------------------------------------
// API REQUEST
// --------------------------------------------------

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: "include",
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
    }

    return data;
}


// --------------------------------------------------
// INITIALIZATION
// --------------------------------------------------

document.addEventListener("DOMContentLoaded", initializeSchedulePage);

async function initializeSchedulePage() {
    try {
        await loadOffices();
        await loadAllStaff();

        officeSelect.addEventListener("change", handleOfficeChange);

        daySelect.addEventListener("change", handleDayChange);

        addTimeSlotBtn.addEventListener("click", addTimeSlot);

        saveScheduleBtn.addEventListener("click", saveSchedule);

        cancelScheduleBtn.addEventListener("click", cancelEditing);

    } catch (error) {
        officeMessage.textContent = error.message;
    }
}


// --------------------------------------------------
// LOAD OFFICES
// --------------------------------------------------

async function loadOffices() {
    const data = await apiRequest(`${API_BASE}/offices`);

    offices = Array.isArray(data)
        ? data
        : data.offices || [];

    officeSelect.innerHTML = `
        <option value="">Select an office</option>
    `;

    offices.forEach(office => {
        const officeId = office.Office_ID ?? office.officeId;

        const option = document.createElement("option");

        option.value = officeId;

        const officeName =
            office.Office_Name ||
            office.Name ||
            `Office ${officeId}`;

        option.textContent = office.City
            ? `${officeName} - ${office.City}`
            : officeName;

        officeSelect.appendChild(option);
    });
}


// --------------------------------------------------
// LOAD STAFF
// --------------------------------------------------

async function loadAllStaff() {
    for (const staffRole of STAFF_ROLES) {
        const data = await apiRequest(
            `${API_BASE}/staff?role=${staffRole.role}`
        );

        staff[staffRole.role] = Array.isArray(data)
            ? data
            : data.staff || [];
    }
}


// --------------------------------------------------
// OFFICE CHANGE
// --------------------------------------------------

async function handleOfficeChange() {
    if (isDirty && !confirmDiscardChanges()) {
        officeSelect.value = selectedOfficeId || "";
        return;
    }

    selectedOfficeId = officeSelect.value || null;

    selectedDay = null;

    daySelect.value = "";

    weeklySchedule = [];
    draftSchedule = [];

    officeHours = null;
    isClosedDay = false;
    isDirty = false;

    weeklyScheduleSection.hidden = true;
    scheduleSection.hidden = true;

    weeklyScheduleTableBody.innerHTML = "";
    weeklyScheduleMessage.textContent = "";

    dayScheduleContainer.hidden = true;
    scheduleActions.hidden = true;

    officeHoursDisplay.textContent =
        "Office hours: Select an office to view its hours.";

    officeMessage.textContent = "";
    scheduleMessage.textContent = "";

    if (!selectedOfficeId) {
        return;
    }

    try {
        officeMessage.textContent = "Loading office schedule...";

        const data = await apiRequest(
            `${API_BASE}?officeId=${encodeURIComponent(selectedOfficeId)}`
        );

        weeklySchedule = getSchedulesFromResponse(data);

        const selectedOffice = offices.find(office =>
            String(office.Office_ID ?? office.officeId) ===
            String(selectedOfficeId)
        );

        officeHours = {
            openTime:
                selectedOffice?.Open_Time ??
                selectedOffice?.openTime ??
                data.office?.Open_Time ??
                data.office?.openTime,

            closeTime:
                selectedOffice?.Close_Time ??
                selectedOffice?.closeTime ??
                data.office?.Close_Time ??
                data.office?.closeTime,

            daysClosed:
                selectedOffice?.Days_Closed ??
                selectedOffice?.daysClosed ??
                data.office?.Days_Closed ??
                data.office?.daysClosed ??
                ""
        };

        renderWeeklySchedule();

        weeklyScheduleSection.hidden = false;

        officeMessage.textContent = "";

    } catch (error) {
        officeMessage.textContent = error.message;
    }
}


// --------------------------------------------------
// GET SCHEDULES FROM API RESPONSE
// --------------------------------------------------

function getSchedulesFromResponse(data) {
    if (Array.isArray(data)) {
        return data;
    }

    if (Array.isArray(data.schedules)) {
        return data.schedules;
    }

    if (Array.isArray(data.schedule)) {
        return data.schedule;
    }

    return [];
}


// --------------------------------------------------
// FORMAT OFFICE HOURS
// --------------------------------------------------

function formatDisplayTime(value) {
    if (!value) {
        return null;
    }

    const time = String(value).slice(0, 5);
    const [hours, minutes] = time.split(":").map(Number);

    if (
        !Number.isInteger(hours) ||
        !Number.isInteger(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        return time;
    }

    const period = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;

    return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}


function updateOfficeHoursDisplay() {
    if (!officeHours) {
        officeHoursDisplay.textContent =
            "Office hours are unavailable.";

        return;
    }

    const openTime = formatDisplayTime(officeHours.openTime);
    const closeTime = formatDisplayTime(officeHours.closeTime);

    if (!openTime || !closeTime) {
        officeHoursDisplay.textContent =
            "Office hours have not been configured.";

        return;
    }

    officeHoursDisplay.textContent =
        `Office Hours: ${openTime} – ${closeTime}`;
}


// --------------------------------------------------
// WEEKLY SCHEDULE OVERVIEW
// --------------------------------------------------

function renderWeeklySchedule() {
    weeklyScheduleTableBody.innerHTML = "";

    DAYS.forEach(day => {
        const daySlots = weeklySchedule
            .filter(slot => getSlotDay(slot) === day)
            .map(slot => normalizeSlot(slot))
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

        // DAY HEADER
        const headerRow = document.createElement("tr");

        const headerCell = document.createElement("td");
        headerCell.colSpan = 8;

        const headerContainer = document.createElement("div");

        headerContainer.style.display = "flex";
        headerContainer.style.justifyContent = "space-between";
        headerContainer.style.alignItems = "center";
        headerContainer.style.gap = "12px";

        const dayTitle = document.createElement("strong");
        dayTitle.textContent = day;

        const editButton = document.createElement("button");

        editButton.type = "button";
        editButton.innerHTML =
            '<i class="ri-edit-line"></i> Edit';

        editButton.addEventListener("click", () => {
            openDayEditor(day);
        });

        headerContainer.appendChild(dayTitle);
        headerContainer.appendChild(editButton);

        headerCell.appendChild(headerContainer);
        headerRow.appendChild(headerCell);

        weeklyScheduleTableBody.appendChild(headerRow);


        // CLOSED DAY
        if (isOfficeClosed(day)) {
            const closedRow = document.createElement("tr");
            const closedCell = document.createElement("td");

            closedCell.colSpan = 8;
            closedCell.textContent = "Clinic Closed";

            closedRow.appendChild(closedCell);
            weeklyScheduleTableBody.appendChild(closedRow);

            return;
        }


        // NO SCHEDULE
        if (daySlots.length === 0) {
            const emptyRow = document.createElement("tr");
            const emptyCell = document.createElement("td");

            emptyCell.colSpan = 8;
            emptyCell.textContent = "No schedule configured.";

            emptyRow.appendChild(emptyCell);
            weeklyScheduleTableBody.appendChild(emptyRow);

            return;
        }


        // TIMESLOTS
        daySlots.forEach(slot => {
            const row = document.createElement("tr");

            // DAY
            appendTextCell(row, day);

            // TIMES
            appendTextCell(row, slot.startTime);
            appendTextCell(row, slot.endTime);

            // STAFF
            appendTextCell(row, getAssignedStaffName("doctor", slot));
            appendTextCell(row, getAssignedStaffName("nurse", slot));
            appendTextCell(row, getAssignedStaffName("receptionist", slot));
            appendTextCell(row, getAssignedStaffName("administrator", slot));

            // ACTIONS
            row.appendChild(document.createElement("td"));

            weeklyScheduleTableBody.appendChild(row);
        });
    });
}


// --------------------------------------------------
// ADD TEXT CELL
// --------------------------------------------------

function appendTextCell(row, value) {
    const cell = document.createElement("td");

    cell.textContent = value || "Unassigned";

    row.appendChild(cell);
}


// --------------------------------------------------
// GET ASSIGNED STAFF NAME
// --------------------------------------------------

function getAssignedStaffName(role, slot) {
    const roleInfo = STAFF_ROLES.find(item => item.role === role);

    if (!roleInfo) {
        return "Unassigned";
    }

    const staffId = slot[roleInfo.key];

    if (!staffId) {
        return "Unassigned";
    }

    // Prefer names returned directly by the backend.
    const backendNameFields = {
        doctor: [
            "Doctor_Name",
            "Doctor_Full_Name",
            "Doctor_Name_Full",
            "doctorName"
        ],
        nurse: [
            "Nurse_Name",
            "Nurse_Full_Name",
            "nurseName"
        ],
        receptionist: [
            "Receptionist_Name",
            "Receptionist_Full_Name",
            "receptionistName"
        ],
        administrator: [
            "Administrator_Name",
            "Administrator_Full_Name",
            "administratorName"
        ]
    };

    for (const field of backendNameFields[role]) {
        if (slot[field]) {
            return slot[field];
        }
    }

    // Otherwise find the staff member in the loaded staff list.
    const person = staff[role].find(item => {
        const id =
            item.Staff_ID ??
            item.staffId ??
            item.Doctor_ID ??
            item.Nurse_ID ??
            item.Receptionist_ID ??
            item.Administrator_ID;

        return String(id) === String(staffId);
    });

    return getStaffFullName(person) || `Staff ${staffId}`;
}


// --------------------------------------------------
// GET STAFF FULL NAME
// --------------------------------------------------

function getStaffFullName(person) {
    if (!person) {
        return "";
    }

    if (person.Full_Name || person.fullName) {
        return person.Full_Name || person.fullName;
    }

    const firstName =
        person.First_Name ??
        person.firstName ??
        "";

    const lastName =
        person.Last_Name ??
        person.lastName ??
        "";

    return `${firstName} ${lastName}`.trim();
}


// --------------------------------------------------
// OPEN DAY EDITOR
// --------------------------------------------------

function openDayEditor(day) {
    if (isDirty && !confirmDiscardChanges()) {
        return;
    }

    selectedDay = day;

    daySelect.value = day;

    scheduleSection.hidden = false;
    weeklyScheduleSection.hidden = true;

    editScheduleTitle.textContent = `Edit ${day} Schedule`;

    loadDayForEditing(day);

    scheduleSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


// --------------------------------------------------
// LOAD DAY FOR EDITING
// --------------------------------------------------

function loadDayForEditing(day) {
    selectedDay = day;

    draftSchedule = [];
    isDirty = false;

    scheduleMessage.textContent = "";

    // Display the selected office's hours while editing.
    updateOfficeHoursDisplay();

    isClosedDay = isOfficeClosed(day);

    if (isClosedDay) {
        dayStatus.textContent = "Clinic Closed";
        dayScheduleContainer.hidden = true;
        scheduleActions.hidden = true;
        return;
    }

    const daySlots = weeklySchedule
        .filter(slot => getSlotDay(slot) === day)
        .map(slot => normalizeSlot(slot))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

    draftSchedule = daySlots;

    dayStatus.textContent = daySlots.length
        ? `Editing the recurring schedule for ${day}.`
        : `No schedule exists for ${day}. Add time slots to create one.`;

    dayScheduleContainer.hidden = false;
    scheduleActions.hidden = false;

    renderSchedule();
}


// --------------------------------------------------
// DAY CHANGE
// --------------------------------------------------

function handleDayChange() {
    if (isDirty && !confirmDiscardChanges()) {
        daySelect.value = selectedDay || "";
        return;
    }

    const day = daySelect.value;

    if (!day) {
        selectedDay = null;
        dayScheduleContainer.hidden = true;
        scheduleActions.hidden = true;
        dayStatus.textContent = "Select a day to edit its schedule.";
        return;
    }

    loadDayForEditing(day);

    editScheduleTitle.textContent = `Edit ${day} Schedule`;
}


// --------------------------------------------------
// CANCEL EDITING
// --------------------------------------------------

function cancelEditing() {
    if (isDirty && !confirmDiscardChanges()) {
        return;
    }

    isDirty = false;
    draftSchedule = [];

    selectedDay = null;
    daySelect.value = "";

    scheduleMessage.textContent = "";

    scheduleSection.hidden = true;
    weeklyScheduleSection.hidden = false;

    weeklyScheduleSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


// --------------------------------------------------
// CLOSED DAY CHECK
// --------------------------------------------------

function isOfficeClosed(day) {
    const closedDays = String(officeHours?.daysClosed || "")
        .split(/[,;|]/)
        .map(value => value.trim().toLowerCase())
        .filter(Boolean);

    return closedDays.includes(day.toLowerCase());
}


// --------------------------------------------------
// NORMALIZE SCHEDULE DATA
// --------------------------------------------------

function normalizeSlot(slot) {
    return {
        scheduleId:
            slot.Schedule_ID ??
            slot.scheduleId ??
            slot.ScheduleID ??
            null,

        startTime: normalizeTime(
            slot.Start_Time ?? slot.startTime
        ),

        endTime: normalizeTime(
            slot.End_Time ?? slot.endTime
        ),

        doctorId: getStaffId(
            slot.DOCTOR_Doctor_ID ??
            slot.Doctor_ID ??
            slot.doctorId
        ),

        nurseId: getStaffId(
            slot.NURSE_Nurse_ID ??
            slot.Nurse_ID ??
            slot.nurseId
        ),

        receptionistId: getStaffId(
            slot.RECEPTIONIST_Receptionist_ID ??
            slot.Receptionist_ID ??
            slot.receptionistId
        ),

        administratorId: getStaffId(
            slot.ADMINISTRATOR_Administrator_ID ??
            slot.Administrator_ID ??
            slot.administratorId
        )
    };
}


function getSlotDay(slot) {
    return (
        slot.Day_Of_Week ??
        slot.Day_of_Week ??
        slot.DayOfWeek ??
        slot.dayOfWeek ??
        slot.Day ??
        ""
    );
}


function getStaffId(value) {
    return value === null || value === undefined || value === ""
        ? ""
        : String(value);
}


function normalizeTime(value) {
    if (!value) return "";

    return String(value).slice(0, 5);
}


// --------------------------------------------------
// RENDER EDITABLE SCHEDULE
// --------------------------------------------------

function renderSchedule() {
    dayScheduleTableBody.innerHTML = "";

    if (draftSchedule.length === 0) {
        dayScheduleTableBody.innerHTML = `
            <tr>
                <td colspan="7">
                    No time slots. Click "Add Time Slot" to create one.
                </td>
            </tr>
        `;

        return;
    }

    draftSchedule.forEach((slot, index) => {
        const row = document.createElement("tr");

        // START TIME
        const startCell = document.createElement("td");
        const startInput = document.createElement("input");

        startInput.type = "time";
        startInput.value = slot.startTime;
        startInput.required = true;

        startInput.addEventListener("change", () => {
            draftSchedule[index].startTime = startInput.value;
            markDirty();
        });

        startCell.appendChild(startInput);
        row.appendChild(startCell);


        // END TIME
        const endCell = document.createElement("td");
        const endInput = document.createElement("input");

        endInput.type = "time";
        endInput.value = slot.endTime;
        endInput.required = true;

        endInput.addEventListener("change", () => {
            draftSchedule[index].endTime = endInput.value;
            markDirty();
        });

        endCell.appendChild(endInput);
        row.appendChild(endCell);


        // STAFF ASSIGNMENTS
        STAFF_ROLES.forEach(staffRole => {
            const cell = document.createElement("td");

            const select = createStaffSelect(
                staffRole.role,
                slot[staffRole.key]
            );

            select.addEventListener("change", () => {
                draftSchedule[index][staffRole.key] = select.value;
                markDirty();
            });

            cell.appendChild(select);
            row.appendChild(cell);
        });


        // ACTIONS
        const actionsCell = document.createElement("td");

        const deleteButton = document.createElement("button");

        deleteButton.type = "button";
        deleteButton.innerHTML =
            '<i class="ri-delete-bin-line"></i> Remove';

        deleteButton.addEventListener("click", () => {
            draftSchedule.splice(index, 1);

            markDirty();
            renderSchedule();
        });

        actionsCell.appendChild(deleteButton);
        row.appendChild(actionsCell);

        dayScheduleTableBody.appendChild(row);
    });
}


// --------------------------------------------------
// CREATE STAFF DROPDOWN
// --------------------------------------------------

function createStaffSelect(role, selectedId = "") {
    const select = document.createElement("select");

    const unassigned = document.createElement("option");

    unassigned.value = "";
    unassigned.textContent = "Unassigned";

    select.appendChild(unassigned);

    staff[role].forEach(person => {
        const id =
            person.Staff_ID ??
            person.staffId ??
            person.Doctor_ID ??
            person.Nurse_ID ??
            person.Receptionist_ID ??
            person.Administrator_ID;

        const fullName = getStaffFullName(person);

        const option = document.createElement("option");

        option.value = id;
        option.textContent = fullName || `Staff ${id}`;

        select.appendChild(option);
    });

    select.value = selectedId || "";

    return select;
}


// --------------------------------------------------
// ADD TIME SLOT
// --------------------------------------------------

function addTimeSlot() {
    if (isClosedDay) {
        return;
    }

    draftSchedule.push({
        scheduleId: null,
        startTime: "",
        endTime: "",
        doctorId: "",
        nurseId: "",
        receptionistId: "",
        administratorId: ""
    });

    markDirty();
    renderSchedule();
}


// --------------------------------------------------
// TRACK UNSAVED CHANGES
// --------------------------------------------------

function markDirty() {
    isDirty = true;

    scheduleMessage.textContent = "You have unsaved changes.";
    scheduleMessage.style.color = "";
}


function confirmDiscardChanges() {
    return confirm(
        "You have unsaved schedule changes. Discard them?"
    );
}


// --------------------------------------------------
// SAVE DAILY SCHEDULE
// --------------------------------------------------

async function saveSchedule() {
    if (!selectedOfficeId || !selectedDay) {
        scheduleMessage.textContent =
            "Select an office and day first.";
        return;
    }

    if (isClosedDay) {
        scheduleMessage.textContent =
            "This office is closed on the selected day.";
        return;
    }

    if (draftSchedule.length === 0) {
        scheduleMessage.textContent =
            "Add at least one time slot before saving.";
        return;
    }

    const timeSlots = draftSchedule.map(slot => ({
        startTime: slot.startTime,
        endTime: slot.endTime,

        doctorId: slot.doctorId || null,
        nurseId: slot.nurseId || null,
        receptionistId: slot.receptionistId || null,
        administratorId: slot.administratorId || null
    }));

    for (let i = 0; i < timeSlots.length; i++) {
        const slot = timeSlots[i];

        if (!slot.startTime || !slot.endTime) {
            scheduleMessage.textContent =
                `Time slot ${i + 1} needs a start and end time.`;
            return;
        }

        if (slot.startTime >= slot.endTime) {
            scheduleMessage.textContent =
                `Time slot ${i + 1} must end after it starts.`;
            return;
        }
    }

    const confirmed = confirm(
        `Save all changes to the ${selectedDay} schedule?`
    );

    if (!confirmed) {
        return;
    }

    saveScheduleBtn.disabled = true;
    saveScheduleBtn.innerHTML = "Saving...";

    scheduleMessage.textContent = "";

    try {
        const data = await apiRequest(`${API_BASE}/day`, {
            method: "POST",

            body: JSON.stringify({
                officeId: Number(selectedOfficeId),
                dayOfWeek: selectedDay,
                timeSlots
            })
        });

        isDirty = false;

        await reloadSchedule();

        scheduleMessage.textContent =
            data.message || "Schedule saved successfully.";

    } catch (error) {
        scheduleMessage.textContent = error.message;

    } finally {
        saveScheduleBtn.disabled = false;

        saveScheduleBtn.innerHTML =
            '<i class="ri-save-line"></i> Save Changes';
    }
}


// --------------------------------------------------
// RELOAD SCHEDULE AFTER SAVING
// --------------------------------------------------

async function reloadSchedule() {
    const data = await apiRequest(
        `${API_BASE}?officeId=${encodeURIComponent(selectedOfficeId)}`
    );

    weeklySchedule = getSchedulesFromResponse(data);

    // Refresh office hours in case they were changed elsewhere.
    const updatedOffice = offices.find(office =>
        String(office.Office_ID ?? office.officeId) ===
        String(selectedOfficeId)
    );

    officeHours = {
        openTime:
            updatedOffice?.Open_Time ??
            updatedOffice?.openTime ??
            data.office?.Open_Time ??
            data.office?.openTime,

        closeTime:
            updatedOffice?.Close_Time ??
            updatedOffice?.closeTime ??
            data.office?.Close_Time ??
            data.office?.closeTime,

        daysClosed:
            updatedOffice?.Days_Closed ??
            updatedOffice?.daysClosed ??
            data.office?.Days_Closed ??
            data.office?.daysClosed ??
            ""
    };

    updateOfficeHoursDisplay();

    renderWeeklySchedule();

    draftSchedule = weeklySchedule
        .filter(slot => getSlotDay(slot) === selectedDay)
        .map(slot => normalizeSlot(slot))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

    renderSchedule();

    dayStatus.textContent =
        `Editing the recurring schedule for ${selectedDay}.`;
}