import pool from "../database.js";
import { getSession } from "../services/sessionService.js";

const BASE_PATH = "/api/admin/schedule";


/* =====================================
   HELPERS
===================================== */

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json"
    });

    res.end(JSON.stringify(data));
}


async function getRequestBody(req) {
    if (req.body && typeof req.body === "object") {
        return req.body;
    }

    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk;
        });

        req.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch {
                reject(new Error("Invalid JSON request body."));
            }
        });

        req.on("error", reject);
    });
}


function timeToMinutes(time) {
    if (!time) return NaN;

    const [hours, minutes] = String(time)
        .split(":")
        .map(Number);

    return hours * 60 + minutes;
}


function normalizeTime(time) {
    if (!time) return null;

    const parts = String(time).split(":");

    if (parts.length < 2) return null;

    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);

    if (
        !Number.isInteger(hours) ||
        !Number.isInteger(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        return null;
    }

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
}


function isValidId(value) {
    return Number.isInteger(value) && value > 0;
}


function parseOptionalId(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const id = Number(value);

    if (!isValidId(id)) {
        throw new Error("Invalid staff ID.");
    }

    return id;
}


function isClosedDay(office, day) {
    if (!office.Days_Closed) return false;

    const closedDays = String(office.Days_Closed)
        .split(/[,;|]/)
        .map(value => value.trim().toLowerCase());

    return closedDays.includes(day.toLowerCase());
}


function getFullName(row) {
    return [
        row.First_Name,
        row.Middle_Name,
        row.Last_Name
    ].filter(Boolean).join(" ");
}


function hasNoOverlaps(schedules) {
    const sorted = [...schedules].sort(
        (a, b) =>
            timeToMinutes(a.Start_Time) -
            timeToMinutes(b.Start_Time)
    );

    for (let i = 1; i < sorted.length; i++) {
        if (
            timeToMinutes(sorted[i].Start_Time) <
            timeToMinutes(sorted[i - 1].End_Time)
        ) {
            return false;
        }
    }

    return true;
}


function hasContinuousCoverage(schedules, openTime, closeTime) {
    if (!schedules.length) return false;

    const sorted = [...schedules].sort(
        (a, b) =>
            timeToMinutes(a.Start_Time) -
            timeToMinutes(b.Start_Time)
    );

    if (!hasNoOverlaps(sorted)) return false;

    if (
        timeToMinutes(sorted[0].Start_Time) !==
        timeToMinutes(openTime)
    ) {
        return false;
    }

    for (let i = 1; i < sorted.length; i++) {
        if (
            timeToMinutes(sorted[i].Start_Time) !==
            timeToMinutes(sorted[i - 1].End_Time)
        ) {
            return false;
        }
    }

    return (
        timeToMinutes(sorted[sorted.length - 1].End_Time) ===
        timeToMinutes(closeTime)
    );
}


/* =====================================
   STAFF CONFIGURATION
===================================== */

const STAFF_CONFIG = {
    doctor: {
        table: "doctor",
        idColumn: "Doctor_ID",
        scheduleColumn: "DOCTOR_Doctor_ID"
    },

    nurse: {
        table: "nurse",
        idColumn: "Nurse_ID",
        scheduleColumn: "NURSE_Nurse_ID"
    },

    receptionist: {
        table: "receptionist",
        idColumn: "Receptionist_ID",
        scheduleColumn: "RECEPTIONIST_Receptionist_ID"
    },

    administrator: {
        table: "administrator",
        idColumn: "Administrator_ID",
        scheduleColumn: "ADMINISTRATOR_Administrator_ID"
    }
};


const DAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
];


/* =====================================
   AUTHENTICATION
===================================== */

function authorizeAdministrator(req, res) {
    const session = getSession(req);

    if (!session || session.role !== "administrator") {
        sendJSON(res, 401, {
            message: "Unauthorized. Administrator access required."
        });

        return false;
    }

    if (!session.administratorId) {
        sendJSON(res, 403, {
            message: "Administrator session is invalid."
        });

        return false;
    }

    return true;
}


/* =====================================
   OFFICE HELPERS
===================================== */

async function getOffice(connection, officeId, lock = false) {
    const [rows] = await connection.execute(
        `
        SELECT
            Office_ID,
            City,
            Days_Closed,
            Open_Time,
            Close_Time
        FROM office
        WHERE Office_ID = ?
        ${lock ? "FOR UPDATE" : ""}
        `,
        [officeId]
    );

    return rows[0] || null;
}


/* =====================================
   SCHEDULE HELPERS
===================================== */

async function getDaySchedule(connection, officeId, day, lock = false) {
    const [rows] = await connection.execute(
        `
        SELECT
            Schedule_ID,
            Day_of_Week,
            Start_Time,
            End_Time,
            OFFICE_Office_ID,
            DOCTOR_Doctor_ID,
            NURSE_Nurse_ID,
            RECEPTIONIST_Receptionist_ID,
            ADMINISTRATOR_Administrator_ID
        FROM schedule
        WHERE OFFICE_Office_ID = ?
          AND Day_of_Week = ?
        ORDER BY Start_Time ASC
        ${lock ? "FOR UPDATE" : ""}
        `,
        [officeId, day]
    );

    return rows;
}


/* =====================================
   STAFF VALIDATION
===================================== */

async function validateStaffExists(connection, role, staffId) {
    if (staffId === null) return true;

    const config = STAFF_CONFIG[role];

    const [rows] = await connection.execute(
        `
        SELECT ${config.idColumn}
        FROM ${config.table}
        WHERE ${config.idColumn} = ?
        `,
        [staffId]
    );

    return rows.length > 0;
}


async function hasStaffConflict(
    connection,
    role,
    staffId,
    officeId,
    day,
    startTime,
    endTime
) {
    if (staffId === null) return false;

    const config = STAFF_CONFIG[role];

    const [rows] = await connection.execute(
        `
        SELECT Schedule_ID
        FROM schedule
        WHERE ${config.scheduleColumn} = ?
          AND Day_of_Week = ?
          AND Start_Time < ?
          AND End_Time > ?
          AND NOT (
              OFFICE_Office_ID = ?
              AND Day_of_Week = ?
          )
        LIMIT 1
        `,
        [
            staffId,
            day,
            endTime,
            startTime,
            officeId,
            day
        ]
    );

    return rows.length > 0;
}

function getStaffAssignments(schedules) {
    const assignments = new Map();

    for (const slot of schedules) {
        for (const [role, config] of Object.entries(STAFF_CONFIG)) {
            const rawId = slot[config.scheduleColumn];

            if (rawId === null || rawId === undefined || rawId === "") {
                continue;
            }

            const staffId = Number(rawId);

            if (!isValidId(staffId)) continue;

            const key = `${role}:${staffId}`;

            if (!assignments.has(key)) {
                assignments.set(key, {
                    role,
                    staffId,
                    intervals: []
                });
            }

            const start = normalizeTime(slot.Start_Time);
            const end = normalizeTime(slot.End_Time);

            assignments.get(key).intervals.push(
                `${start?.slice(0, 5)}-${end?.slice(0, 5)}`
            );
        }
    }

    for (const assignment of assignments.values()) {
        assignment.intervals.sort();
    }

    return assignments;
}


async function notifyChangedStaff(
    connection,
    previousSchedules,
    newSchedules,
    office,
    day
) {
    const previousAssignments = getStaffAssignments(previousSchedules);
    const newAssignments = getStaffAssignments(newSchedules);

    const allStaffKeys = new Set([
        ...previousAssignments.keys(),
        ...newAssignments.keys()
    ]);

    for (const key of allStaffKeys) {
        const previous = previousAssignments.get(key);
        const current = newAssignments.get(key);

        const previousIntervals = previous?.intervals || [];
        const newIntervals = current?.intervals || [];

        // No notification if this person's assignments did not change.
        if (
            JSON.stringify(previousIntervals) ===
            JSON.stringify(newIntervals)
        ) {
            continue;
        }

        const assignment = current || previous;
        const config = STAFF_CONFIG[assignment.role];

        const [users] = await connection.execute(
            `
            SELECT DISTINCT UserID
            FROM usercredential
            WHERE ${config.scheduleColumn} = ?
            `,
            [assignment.staffId]
        );

        if (users.length === 0) {
            continue;
        }

        const officeName =
            `Office ${office.Office_ID}` +
            (office.City ? ` (${office.City})` : "");

        const previousText = previousIntervals.length
            ? previousIntervals.join(", ")
            : "No assigned times";

        const newText = newIntervals.length
            ? newIntervals.join(", ")
            : "No assigned times";

        const message =
            `Your ${day} schedule at ${officeName} has changed. ` +
            `Previous: ${previousText}. ` +
            `New: ${newText}.`;

        for (const user of users) {
            await connection.execute(
                `
                INSERT INTO notification (
                    UserID,
                    Title,
                    Message,
                    Is_Read,
                    Created_At
                )
                VALUES (?, ?, ?, 0, NOW())
                `,
                [
                    user.UserID,
                    "Your Schedule Has Changed",
                    message.slice(0, 500)
                ]
            );
        }
    }
}


/* =====================================
   GET OFFICES
===================================== */

async function handleGetOffices(res) {
    const [offices] = await pool.execute(
        `
        SELECT
            Office_ID,
            City,
            Days_Closed,
            Open_Time,
            Close_Time
        FROM office
        ORDER BY Office_ID
        `
    );

    sendJSON(res, 200, { offices });
}


/* =====================================
   GET STAFF
===================================== */

async function handleGetStaff(url, res) {
    const role = url.searchParams.get("role");

    if (!STAFF_CONFIG[role]) {
        sendJSON(res, 400, {
            message: "Invalid staff role."
        });

        return;
    }

    const config = STAFF_CONFIG[role];

    const [staff] = await pool.execute(
        `
        SELECT
            ${config.idColumn} AS Staff_ID,
            ${config.idColumn},
            First_Name,
            Middle_Name,
            Last_Name
        FROM ${config.table}
        ORDER BY Last_Name, First_Name
        `
    );

    sendJSON(res, 200, {
        staff: staff.map(person => ({
            ...person,
            Full_Name: getFullName(person)
        }))
    });
}


/* =====================================
   GET WEEKLY SCHEDULE
===================================== */

async function handleGetSchedule(url, res) {
    const officeId = Number(url.searchParams.get("officeId"));

    if (!isValidId(officeId)) {
        sendJSON(res, 400, {
            message: "A valid office ID is required."
        });

        return;
    }

    const [officeRows] = await pool.execute(
        `
        SELECT
            Office_ID,
            City,
            Days_Closed,
            Open_Time,
            Close_Time
        FROM office
        WHERE Office_ID = ?
        `,
        [officeId]
    );

    if (!officeRows.length) {
        sendJSON(res, 404, {
            message: "Office not found."
        });

        return;
    }

    const [schedules] = await pool.execute(
        `
        SELECT
            s.Schedule_ID,
            s.Day_of_Week,
            s.Start_Time,
            s.End_Time,
            s.OFFICE_Office_ID,

            s.DOCTOR_Doctor_ID,
            s.NURSE_Nurse_ID,
            s.RECEPTIONIST_Receptionist_ID,
            s.ADMINISTRATOR_Administrator_ID,

            CONCAT_WS(
                ' ',
                d.First_Name,
                d.Middle_Name,
                d.Last_Name
            ) AS Doctor_Name,

            CONCAT_WS(
                ' ',
                n.First_Name,
                n.Middle_Name,
                n.Last_Name
            ) AS Nurse_Name,

            CONCAT_WS(
                ' ',
                r.First_Name,
                r.Middle_Name,
                r.Last_Name
            ) AS Receptionist_Name,

            CONCAT_WS(
                ' ',
                a.First_Name,
                a.Middle_Name,
                a.Last_Name
            ) AS Administrator_Name

        FROM schedule s

        LEFT JOIN doctor d
            ON s.DOCTOR_Doctor_ID = d.Doctor_ID

        LEFT JOIN nurse n
            ON s.NURSE_Nurse_ID = n.Nurse_ID

        LEFT JOIN receptionist r
            ON s.RECEPTIONIST_Receptionist_ID = r.Receptionist_ID

        LEFT JOIN administrator a
            ON s.ADMINISTRATOR_Administrator_ID = a.Administrator_ID

        WHERE s.OFFICE_Office_ID = ?

        ORDER BY
            FIELD(
                s.Day_of_Week,
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday',
                'Sunday'
            ),
            s.Start_Time
        `,
        [officeId]
    );

    sendJSON(res, 200, {
        office: officeRows[0],
        schedules
    });
}


/* =====================================
   VALIDATE ALL OFFICE SCHEDULES

   Exported so adminClinicInfoRoutes.js
   can call it after office hours change.
===================================== */

export async function validateAllOfficeSchedules() {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [offices] = await connection.execute(
            `
            SELECT
                Office_ID,
                City,
                Days_Closed,
                Open_Time,
                Close_Time
            FROM office
            ORDER BY Office_ID
            `
        );

        const [administrators] = await connection.execute(
            `
            SELECT
                uc.UserID
            FROM usercredential uc
            INNER JOIN administrator a
                ON uc.ADMINISTRATOR_Administrator_ID =
                   a.Administrator_ID
            WHERE LOWER(uc.role) = 'administrator'
            `
        );

        const [allSchedules] = await connection.execute(
            `
            SELECT
                Schedule_ID,
                Day_of_Week,
                Start_Time,
                End_Time,
                OFFICE_Office_ID
            FROM schedule
            `
        );

        const invalidOffices = [];
        let notificationsCreated = 0;

        for (const office of offices) {
            const officeId = office.Office_ID;
            const issues = [];

            const openTime = normalizeTime(office.Open_Time);
            const closeTime = normalizeTime(office.Close_Time);

            if (
                !openTime ||
                !closeTime ||
                timeToMinutes(openTime) >= timeToMinutes(closeTime)
            ) {
                issues.push(
                    "Office opening or closing hours are missing or invalid."
                );
            } else {
                for (const day of DAYS) {
                    if (isClosedDay(office, day)) {
                        continue;
                    }

                    const daySchedules = allSchedules.filter(
                        schedule =>
                            Number(schedule.OFFICE_Office_ID) ===
                                Number(officeId) &&
                            schedule.Day_of_Week === day
                    );

                    if (daySchedules.length === 0) {
                        issues.push(`${day}: no schedule exists.`);
                        continue;
                    }

                    const invalidSlot = daySchedules.some(slot => {
                        const start = normalizeTime(slot.Start_Time);
                        const end = normalizeTime(slot.End_Time);

                        return (
                            !start ||
                            !end ||
                            timeToMinutes(start) >= timeToMinutes(end)
                        );
                    });

                    if (invalidSlot) {
                        issues.push(`${day}: invalid timeslot.`);
                        continue;
                    }

                    if (
                        !hasContinuousCoverage(
                            daySchedules,
                            openTime,
                            closeTime
                        )
                    ) {
                        issues.push(
                            `${day}: missing, overlapping, or discontinuous coverage.`
                        );
                    }
                }
            }

            if (issues.length === 0) {
                continue;
            }

            invalidOffices.push({
                officeId,
                city: office.City,
                issues
            });

            const title = `Office ${officeId} Schedule Is Invalid`;

            const issueMessage = issues.join(" ").slice(0, 500);

            const message =
                `Office ${officeId}${office.City ? ` (${office.City})` : ""} has an invalid schedule. ${issueMessage}`;

            for (const administrator of administrators) {
                const [existing] = await connection.execute(
                    `
                    SELECT Notification_ID
                    FROM notification
                    WHERE UserID = ?
                      AND Title = ?
                      AND Is_Read = 0
                    LIMIT 1
                    `,
                    [
                        administrator.UserID,
                        title
                    ]
                );

                if (existing.length > 0) {
                    continue;
                }

                await connection.execute(
                    `
                    INSERT INTO notification (
                        UserID,
                        Title,
                        Message,
                        Is_Read,
                        Created_At
                    )
                    VALUES (?, ?, ?, 0, NOW())
                    `,
                    [
                        administrator.UserID,
                        title,
                        message
                    ]
                );

                notificationsCreated++;
            }
        }

        await connection.commit();

        return {
            officesChecked: offices.length,
            invalidOffices,
            notificationsCreated
        };

    } catch (error) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error(
                "Schedule validation rollback error:",
                rollbackError
            );
        }

        console.error(
            "Office schedule validation error:",
            error
        );

        throw error;

    } finally {
        connection.release();
    }
}


/* =====================================
   SAVE ENTIRE DAY
===================================== */

async function handleSaveDay(req, res) {
    let body;

    try {
        body = await getRequestBody(req);
    } catch (error) {
        sendJSON(res, 400, {
            message: error.message
        });

        return;
    }

    const officeId = Number(body.officeId);
    const dayOfWeek = body.dayOfWeek;

    if (!isValidId(officeId)) {
        sendJSON(res, 400, {
            message: "A valid office ID is required."
        });

        return;
    }

    if (!DAYS.includes(dayOfWeek)) {
        sendJSON(res, 400, {
            message: "Please select a valid day of the week."
        });

        return;
    }

    if (!Array.isArray(body.timeSlots)) {
        sendJSON(res, 400, {
            message: "A valid list of timeslots is required."
        });

        return;
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const office = await getOffice(
            connection,
            officeId,
            true
        );

        if (!office) {
            await connection.rollback();

            sendJSON(res, 404, {
                message: "Office not found."
            });

            return;
        }

        const previousSchedules = await getDaySchedule(
            connection,
            officeId,
            dayOfWeek,
            true
        );

        if (isClosedDay(office, dayOfWeek)) {
            await connection.rollback();

            sendJSON(res, 400, {
                message: `The office is closed on ${dayOfWeek}.`
            });

            return;
        }

        if (!office.Open_Time || !office.Close_Time) {
            await connection.rollback();

            sendJSON(res, 400, {
                message: "The office does not have configured opening hours."
            });

            return;
        }

        const openTime = normalizeTime(office.Open_Time);
        const closeTime = normalizeTime(office.Close_Time);

        if (!openTime || !closeTime) {
            await connection.rollback();

            sendJSON(res, 400, {
                message: "The office has invalid opening hours."
            });

            return;
        }

        if (
            timeToMinutes(openTime) >=
            timeToMinutes(closeTime)
        ) {
            await connection.rollback();

            sendJSON(res, 400, {
                message: "The office opening hours are invalid."
            });

            return;
        }

        if (body.timeSlots.length === 0) {
            await connection.rollback();

            sendJSON(res, 400, {
                message: "The schedule must contain at least one timeslot."
            });

            return;
        }

        const schedules = [];

        for (let i = 0; i < body.timeSlots.length; i++) {
            const slot = body.timeSlots[i];

            if (!slot || typeof slot !== "object") {
                throw new Error(`Timeslot ${i + 1} is invalid.`);
            }

            const startTime = normalizeTime(slot.startTime);
            const endTime = normalizeTime(slot.endTime);

            if (!startTime || !endTime) {
                throw new Error(
                    `Timeslot ${i + 1} has an invalid start or end time.`
                );
            }

            const startMinutes = timeToMinutes(startTime);
            const endMinutes = timeToMinutes(endTime);

            if (startMinutes >= endMinutes) {
                throw new Error(
                    `Timeslot ${i + 1} must end after it starts.`
                );
            }

            if (
                startMinutes < timeToMinutes(openTime) ||
                endMinutes > timeToMinutes(closeTime)
            ) {
                throw new Error(
                    `Timeslot ${i + 1} must be within office hours (${openTime.slice(0, 5)} to ${closeTime.slice(0, 5)}).`
                );
            }

            schedules.push({
                Start_Time: startTime,
                End_Time: endTime,
                DOCTOR_Doctor_ID: parseOptionalId(slot.doctorId),
                NURSE_Nurse_ID: parseOptionalId(slot.nurseId),
                RECEPTIONIST_Receptionist_ID: parseOptionalId(slot.receptionistId),
                ADMINISTRATOR_Administrator_ID: parseOptionalId(slot.administratorId)
            });
        }

        if (
            !hasContinuousCoverage(
                schedules,
                openTime,
                closeTime
            )
        ) {
            await connection.rollback();

            sendJSON(res, 400, {
                message:
                    "The schedule must provide continuous coverage from office opening to closing, without gaps or overlapping timeslots."
            });

            return;
        }

        // Validate all staff assignments before replacing the old schedule.
        for (let i = 0; i < schedules.length; i++) {
            const slot = schedules[i];

            const assignments = {
                doctor: slot.DOCTOR_Doctor_ID,
                nurse: slot.NURSE_Nurse_ID,
                receptionist: slot.RECEPTIONIST_Receptionist_ID,
                administrator: slot.ADMINISTRATOR_Administrator_ID
            };

            for (const [role, staffId] of Object.entries(assignments)) {
                if (staffId === null) continue;

                const exists = await validateStaffExists(
                    connection,
                    role,
                    staffId
                );

                if (!exists) {
                    throw new Error(
                        `The selected ${role} in timeslot ${i + 1} does not exist.`
                    );
                }

                const conflict = await hasStaffConflict(
                    connection,
                    role,
                    staffId,
                    officeId,
                    dayOfWeek,
                    slot.Start_Time,
                    slot.End_Time
                );

                if (conflict) {
                    throw new Error(
                        `The selected ${role} in timeslot ${i + 1} is already scheduled at another office during this time.`
                    );
                }
            }
        }

        // Replace the complete schedule for this office/day.
        await connection.execute(
            `
            DELETE FROM schedule
            WHERE OFFICE_Office_ID = ?
              AND Day_of_Week = ?
            `,
            [officeId, dayOfWeek]
        );

        for (const slot of schedules) {
            await connection.execute(
                `
                INSERT INTO schedule (
                    Day_of_Week,
                    Start_Time,
                    End_Time,
                    OFFICE_Office_ID,
                    DOCTOR_Doctor_ID,
                    NURSE_Nurse_ID,
                    RECEPTIONIST_Receptionist_ID,
                    ADMINISTRATOR_Administrator_ID
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    dayOfWeek,
                    slot.Start_Time,
                    slot.End_Time,
                    officeId,
                    slot.DOCTOR_Doctor_ID,
                    slot.NURSE_Nurse_ID,
                    slot.RECEPTIONIST_Receptionist_ID,
                    slot.ADMINISTRATOR_Administrator_ID
                ]
            );
        }

        await notifyChangedStaff(
            connection,
            previousSchedules,
            schedules,
            office,
            dayOfWeek
        );

        await connection.commit();

        sendJSON(res, 200, {
            message: `${dayOfWeek}'s schedule was saved successfully.`,
            timeslotsSaved: schedules.length
        });

    } catch (error) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error(
                "Schedule rollback error:",
                rollbackError
            );
        }

        console.error("Save daily schedule error:", error);

        const isValidationError =
            error.message &&
            (
                error.message.startsWith("Timeslot") ||
                error.message.startsWith("Invalid staff ID") ||
                error.message.startsWith("The selected")
            );

        sendJSON(res, isValidationError ? 400 : 500, {
            message: isValidationError
                ? error.message
                : "An error occurred while saving the schedule."
        });

    } finally {
        connection.release();
    }
}


/* =====================================
   MAIN ROUTE HANDLER
===================================== */

export async function handleAdminScheduleRoutes(req, res) {
    const url = new URL(req.url, "http://localhost");
    const pathname = url.pathname;

    if (
        pathname !== BASE_PATH &&
        !pathname.startsWith(`${BASE_PATH}/`)
    ) {
        return false;
    }

    if (!authorizeAdministrator(req, res)) {
        return true;
    }

    try {
        // GET /api/admin/schedule/offices
        if (
            req.method === "GET" &&
            pathname === `${BASE_PATH}/offices`
        ) {
            await handleGetOffices(res);
            return true;
        }

        // GET /api/admin/schedule/staff?role=doctor
        if (
            req.method === "GET" &&
            pathname === `${BASE_PATH}/staff`
        ) {
            await handleGetStaff(url, res);
            return true;
        }

        // GET /api/admin/schedule?officeId=1
        if (
            req.method === "GET" &&
            pathname === BASE_PATH
        ) {
            await handleGetSchedule(url, res);
            return true;
        }

        // POST /api/admin/schedule/validate
        if (
            req.method === "POST" &&
            pathname === `${BASE_PATH}/validate`
        ) {
            const result = await validateAllOfficeSchedules();

            sendJSON(res, 200, {
                message: "Office schedule validation completed.",
                ...result
            });

            return true;
        }

        // POST /api/admin/schedule/day
        if (
            req.method === "POST" &&
            pathname === `${BASE_PATH}/day`
        ) {
            await handleSaveDay(req, res);
            return true;
        }

        sendJSON(res, 404, {
            message: "Schedule route not found."
        });

        return true;

    } catch (error) {
        console.error("Admin schedule route error:", error);

        sendJSON(res, 500, {
            message: "An unexpected schedule error occurred."
        });

        return true;
    }
}