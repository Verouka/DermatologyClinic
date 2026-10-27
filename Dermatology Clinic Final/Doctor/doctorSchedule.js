
(() => {
    const SCHEDULE_API_BASE = 'http://127.0.0.1:3000';
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const formatMonth = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
    const formatRange = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
    let displayedMonday = mondayOf(new Date());
    let latestRequest = 0;

    function mondayOf(date) {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        d.setDate(d.getDate() - (d.getDay() + 6) % 7);
        return d;
    }

    function addDays(date, amount) {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        d.setDate(d.getDate() + amount);
        return d;
    }

    function dateKey(date) {
        return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')].join('-');
    }

    function sqlDateKey(value) {
        return value ? String(value).slice(0, 10) : '';
    }

    function timeText(value) {
        if (!value) return '—';
        const match = /^(\d{1,2}):(\d{2})/.exec(String(value));
        if (!match) return String(value);
        const hour = Number(match[1]);
        return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
    }

    function normalizeStatus(value) {
        return String(value || 'Scheduled').trim().toLowerCase().replace(/\s+/g, ' ');
    }


    function statusColor(status) {
        switch (normalizeStatus(status)) {
            case 'checked in':
            case 'ready for doctor':
            case 'completed': return 'green';
            case 'waiting':
            case 'in triage': return '#c36b00';
            case 'in consultation': return '#2563eb';
            case 'cancelled':
            case 'canceled': return 'red';
            default: return 'gray';
        }
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function showNotice(message) {
        setText('scheduleNotice', message);
    }

    async function scheduleRequest(path, options = {}) {
        const response = await fetch(`${SCHEDULE_API_BASE}${path}`, {
            credentials: 'include',
            ...options
        });
        let data;
        try {
            data = await response.json();
        } catch {
            throw new Error('The server returned an invalid response.');
        }
        if (!response.ok) throw new Error(data.error || `Schedule request failed (${response.status}).`);
        return data;
    }

    function showWeekHeader() {
        const sunday = addDays(displayedMonday, 6);
        const start = formatMonth.format(displayedMonday);
        const end = formatMonth.format(sunday);
        setText('calendarMonthTitle', start === end ? start : `${start} – ${end}`);
        setText('calendarRange', `${formatRange.format(displayedMonday)} – ${formatRange.format(sunday)}`);

        const row = document.getElementById('calendarDayHeaders');
        row.replaceChildren();
        const today = dateKey(new Date());
        for (let i = 0; i < 7; i++) {
            const day = addDays(displayedMonday, i);
            const th = document.createElement('th');
            if (dateKey(day) === today) th.classList.add('calendarIsToday');
            const label = document.createElement('span');
            label.className = 'calendarWeekday';
            label.textContent = weekdays[i];
            const dayNumber = document.createElement('span');
            dayNumber.className = 'calendarDate';
            dayNumber.textContent = day.getDate();
            th.append(label, dayNumber);
            row.appendChild(th);
        }
    }

    function showWorkHours(shifts) {
        if (!shifts.length) {
            setText('workingDayValue', 'No assigned shifts');
            for (const id of ['startTimeValue', 'endTimeValue', 'officeValue']) setText(id, '—');
            return;
        }
        setText('workingDayValue', [...new Set(shifts.map(s => s.Day_of_Week))].join(', '));
        const first = [...shifts].sort((a, b) => String(a.Start_Time).localeCompare(String(b.Start_Time)))[0];
        const last = [...shifts].sort((a, b) => String(b.End_Time).localeCompare(String(a.End_Time)))[0];
        setText('startTimeValue', timeText(first.Start_Time));
        setText('endTimeValue', timeText(last.End_Time));
        setText('officeValue', [...new Set(shifts.map(s =>
            [s.Office_City, s.Office_State].filter(Boolean).join(', ') || `Office ${s.Office_ID}`))].join(' / '));
    }

    function nameOf(appointment) {
        return [appointment.First_Name, appointment.Middle_Name, appointment.Last_Name]
            .filter(Boolean).join(' ') || 'Unknown Patient';
    }

    function showCalendar(appointments, shifts) {
        const row = document.getElementById('calendarAppointmentCells');
        row.replaceChildren();
        for (let i = 0; i < 7; i++) {
            const date = addDays(displayedMonday, i);
            const dateString = dateKey(date);
            const td = document.createElement('td');
            td.className = 'calendarCell';

            for (const shift of shifts.filter(s =>
                String(s.Day_of_Week).toLowerCase() === weekdays[i].toLowerCase())) {
                const item = document.createElement('div');
                item.className = 'calendarShift';
                item.textContent = `Shift ${timeText(shift.Start_Time)}–${timeText(shift.End_Time)}`;
                td.appendChild(item);
            }

            for (const appt of appointments.filter(a => sqlDateKey(a.Appointment_Date) === dateString)) {
                const a = document.createElement('a');
                a.className = 'calendarEvent';
                a.href = '#weeklyAppointmentRows'; // Stay on the Doctor Schedule page.
                a.textContent = `${timeText(appt.Appointment_Time)} — ${nameOf(appt)}`;
                a.title = appt.Appointment_Status || 'Scheduled';
                td.appendChild(a);
            }
            if (!td.childElementCount) {
                const span = document.createElement('span');
                span.className = 'calendarEmpty';
                span.textContent = '—';
                td.appendChild(span);
            }
            row.appendChild(td);
        }
    }

    function addCell(row, value) {
        const cell = row.insertCell();
        cell.textContent = value === null || value === undefined || value === '' ? '—' : String(value);
        return cell;
    }

    function showEmptyTable(message) {
        const body = document.getElementById('weeklyAppointmentRows');
        body.replaceChildren();
        const row = body.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 7;
        cell.textContent = message;
    }

    function makeButton(label, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        // Same navy/action style as the nurse's Start Triage button.
        button.style.backgroundColor = 'rgb(2, 2, 85)';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        button.style.padding = '9px 12px';
        button.style.marginTop = '8px';
        button.style.cursor = 'pointer';
        button.style.fontWeight = 'bold';
        button.addEventListener('click', async () => {
            button.disabled = true;
            try { await onClick(); } finally { button.disabled = false; }
        });
        return button;
    }

    async function updateStatus(apptId, action) {
        showNotice('Updating appointment status...');
        try {
            const data = await scheduleRequest(
                `/api/doctor/schedule/appointments/${encodeURIComponent(apptId)}/${action}`,
                { method: 'PATCH' }
            );
            await loadSchedule(false);
            showNotice(data.message || 'Appointment updated.');
        } catch (error) {
            console.error('Doctor schedule status update:', error);
            showNotice(error.message);
            await loadSchedule(false);
        }
    }

    function showStatusCell(row, appointment) {
        const cell = row.insertCell();
        const status = appointment.Appointment_Status || 'Scheduled';
        const strong = document.createElement('span');
        strong.textContent = status;
        strong.style.color = statusColor(status);
        strong.style.fontWeight = 'bold';
        cell.appendChild(strong);

        const statusKey = normalizeStatus(status);
        const isToday = sqlDateKey(appointment.Appointment_Date) === dateKey(new Date());

        if (isToday && statusKey === 'ready for doctor') {
            cell.appendChild(document.createElement('div'));
            cell.appendChild(makeButton('Start Consultation', () =>
                updateStatus(appointment.Appointment_ID, 'start-consultation')));
        } else if (isToday && statusKey === 'in consultation') {
            cell.appendChild(document.createElement('div'));
            cell.appendChild(makeButton('Complete Appointment', () =>
                updateStatus(appointment.Appointment_ID, 'complete')));
        } else if (['checked in', 'waiting', 'in triage'].includes(statusKey)) {
            const note = document.createElement('div');
            note.textContent = 'Waiting for nurse';
            note.style.color = '#777';
            cell.appendChild(note);
        } else if (statusKey === 'scheduled') {
            const note = document.createElement('div');
            note.textContent = 'Awaiting check-in';
            note.style.color = '#777';
            cell.appendChild(note);
        }
    }

    function showAppointmentTable(appointments) {
        if (!appointments.length) {
            showEmptyTable('No assigned appointments for this week.');
            return;
        }
        const body = document.getElementById('weeklyAppointmentRows');
        body.replaceChildren();
        for (const appointment of appointments) {
            const row = body.insertRow();
            addCell(row, appointment.Appointment_ID);
            addCell(row, sqlDateKey(appointment.Appointment_Date));
            addCell(row, timeText(appointment.Appointment_Time));
            addCell(row, nameOf(appointment));
            addCell(row, appointment.Appointment_Description || 'N/A');
            addCell(row, appointment.OFFICE_Office_ID);
            showStatusCell(row, appointment); // Reuse existing Status column; no HTML edits.
        }
    }

    async function loadSchedule(showLoading = true) {
        const requestId = ++latestRequest;
        showWeekHeader();
        if (showLoading) showNotice('Loading schedule...');
        try {
            const data = await scheduleRequest(
                `/api/doctor/schedule?weekStart=${encodeURIComponent(dateKey(displayedMonday))}`
            );
            if (requestId !== latestRequest) return;
            if (!Array.isArray(data.workHours) || !Array.isArray(data.weeklyAppointments)) {
                throw new Error('Unexpected schedule response from backend.');
            }
            showWorkHours(data.workHours);
            showCalendar(data.weeklyAppointments, data.workHours);
            showAppointmentTable(data.weeklyAppointments);
            if (showLoading) showNotice(`${data.weeklyAppointments.length} appointment(s) this week.`);
        } catch (error) {
            if (requestId !== latestRequest) return;
            console.error('Doctor schedule loading error:', error);
            showNotice(error.message);
            showEmptyTable('Unable to load appointments.');
            document.getElementById('calendarAppointmentCells').replaceChildren();
        }
    }

    function initialize() {
        const prev = document.getElementById('previousWeek');
        const next = document.getElementById('nextWeek');
        const today = document.getElementById('todayWeek');
        if (!prev || !next || !today || !document.getElementById('weeklyAppointmentRows')) return;
        prev.addEventListener('click', () => {
            displayedMonday = addDays(displayedMonday, -7);
            loadSchedule();
        });
        next.addEventListener('click', () => {
            displayedMonday = addDays(displayedMonday, 7);
            loadSchedule();
        });
        today.addEventListener('click', () => {
            displayedMonday = mondayOf(new Date());
            loadSchedule();
        });
        loadSchedule();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
