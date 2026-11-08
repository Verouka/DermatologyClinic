document.addEventListener("DOMContentLoaded", async () => {

    const API_URL = "http://127.0.0.1:3000/api/admin/notifications";
    const VALIDATION_URL = "http://127.0.0.1:3000/api/admin/schedule/validate";

    const notificationBell = document.getElementById("notificationBell");
    const notificationCount = document.getElementById("notificationCount");
    const notificationPopup = document.getElementById("notificationPopup");
    const notificationList = document.getElementById("notificationList");

    let notifications = [];


    /* =====================================
       VALIDATE OFFICE SCHEDULES
    ===================================== */

    async function validateOfficeSchedules() {
        try {
            const response = await fetch(VALIDATION_URL, {
                method: "POST",
                credentials: "include"
            });

            if (!response.ok) {
                throw new Error("Failed to validate office schedules.");
            }

            const data = await response.json();

            console.log(
                "Office schedule validation completed:",
                data
            );

            if (data.invalidOffices?.length > 0) {
                console.warn(
                    "Invalid office schedules detected:",
                    data.invalidOffices
                );
            }

        } catch (error) {
            console.error(
                "Error validating office schedules:",
                error
            );
        }
    }


    /* =====================================
       LOAD NOTIFICATIONS
    ===================================== */

    async function loadNotifications() {
        try {
            const response = await fetch(API_URL, {
                method: "GET",
                credentials: "include"
            });

            if (!response.ok) {
                throw new Error("Failed to load notifications.");
            }

            const data = await response.json();

            notifications = Array.isArray(data)
                ? data
                : data.notifications || [];

            updateNotificationCount();
            renderNotifications();

        } catch (error) {
            console.error("Error loading notifications:", error);

            if (notificationList) {
                notificationList.innerHTML = "";

                const errorMessage = document.createElement("p");
                errorMessage.className = "notification-error";
                errorMessage.textContent = "Unable to load notifications.";

                notificationList.appendChild(errorMessage);
            }
        }
    }


    /* =====================================
       UPDATE NOTIFICATION COUNT
    ===================================== */

    function updateNotificationCount() {
        if (!notificationCount) return;

        const unreadCount = notifications.length;

        notificationCount.textContent =
            unreadCount > 99 ? "99+" : unreadCount;

        notificationCount.hidden = unreadCount === 0;
    }


    /* =====================================
       RENDER NOTIFICATIONS
    ===================================== */

    function renderNotifications() {
        if (!notificationList) return;

        notificationList.innerHTML = "";

        if (notifications.length === 0) {
            const emptyMessage = document.createElement("p");
            emptyMessage.className = "notification-empty";
            emptyMessage.textContent = "No unread notifications.";

            notificationList.appendChild(emptyMessage);
            return;
        }

        notifications.forEach(notification => {

            const notificationItem = document.createElement("div");
            notificationItem.className = "notification-item";

            const notificationContent = document.createElement("div");
            notificationContent.className = "notification-content";

            const title = document.createElement("h4");
            title.className = "notification-title";
            title.textContent = notification.Title || "Notification";

            const message = document.createElement("p");
            message.className = "notification-message";
            message.textContent = notification.Message || "";

            const timestamp = document.createElement("small");
            timestamp.className = "notification-timestamp";
            timestamp.textContent = formatTimestamp(notification.Created_At);

            const markReadButton = document.createElement("button");
            markReadButton.className = "notification-mark-read";
            markReadButton.type = "button";
            markReadButton.textContent = "Mark as read";

            markReadButton.addEventListener("click", () => {
                markNotificationAsRead(
                    notification.Notification_ID,
                    markReadButton
                );
            });

            notificationContent.appendChild(title);
            notificationContent.appendChild(message);
            notificationContent.appendChild(timestamp);

            notificationItem.appendChild(notificationContent);
            notificationItem.appendChild(markReadButton);

            notificationList.appendChild(notificationItem);
        });
    }


    /* =====================================
       FORMAT TIMESTAMP
    ===================================== */

    function formatTimestamp(timestamp) {
        if (!timestamp) {
            return "";
        }

        const date = new Date(timestamp);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleString();
    }


    /* =====================================
       MARK NOTIFICATION AS READ
    ===================================== */

    async function markNotificationAsRead(notificationId, button) {

        button.disabled = true;
        button.textContent = "Updating...";

        try {
            const response = await fetch(
                `${API_URL}/${encodeURIComponent(notificationId)}/read`,
                {
                    method: "PATCH",
                    credentials: "include"
                }
            );

            if (!response.ok) {
                throw new Error("Failed to mark notification as read.");
            }

            notifications = notifications.filter(notification =>
                String(notification.Notification_ID) !== String(notificationId)
            );

            updateNotificationCount();
            renderNotifications();

        } catch (error) {
            console.error(
                "Error marking notification as read:",
                error
            );

            button.disabled = false;
            button.textContent = "Mark as read";

            alert("Unable to mark notification as read. Please try again.");
        }
    }


    /* =====================================
       POPUP EVENTS
    ===================================== */

    if (
        notificationBell &&
        notificationPopup
    ) {
        notificationBell.addEventListener("click", (event) => {
            event.stopPropagation();

            const isOpen = !notificationPopup.hidden;

            notificationPopup.hidden = isOpen;

            notificationBell.setAttribute(
                "aria-expanded",
                String(!isOpen)
            );
        });

        notificationPopup.addEventListener("click", (event) => {
            event.stopPropagation();
        });

        document.addEventListener("click", () => {
            notificationPopup.hidden = true;

            notificationBell.setAttribute(
                "aria-expanded",
                "false"
            );
        });
    }


    /* =====================================
       INITIALIZE NOTIFICATIONS
    ===================================== */

    // Validate schedules before retrieving notifications.
    await validateOfficeSchedules();

    // Load notifications after validation finishes.
    await loadNotifications();

});