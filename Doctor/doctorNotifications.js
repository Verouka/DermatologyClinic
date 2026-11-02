


(() => {
    const API_BASE = "";

    document.addEventListener("DOMContentLoaded", () => {
        const bell = document.querySelector(".picon.bell");

        if (!bell) return;

        bell.style.position = "relative";
        bell.style.cursor = "pointer";
        bell.setAttribute("role", "button");
        bell.setAttribute("tabindex", "0");
        bell.setAttribute("aria-label", "Notifications");
        bell.setAttribute("aria-expanded", "false");

        const badge = document.createElement("span");
        badge.className = "notificationBadge";
        badge.hidden = true;
        bell.appendChild(badge);

        const panel = document.createElement("div");
        panel.className = "notificationPanel";
        panel.hidden = true;

        panel.innerHTML = `
            <div class="notificationPanelHeader">
                <h3>Notifications</h3>
                <button type="button" class="closeNotifications"
                        aria-label="Close notifications">&times;</button>
            </div>
            <div class="notificationList"></div>
        `;

        document.body.appendChild(panel);

        const list = panel.querySelector(".notificationList");

        async function loadNotifications() {
            try {
                const response = await fetch(
                    `${API_BASE}/api/doctor/notifications`,
                    {
                        credentials: "include"
                    }
                );

                if (!response.ok) {
                    throw new Error("Could not load notifications");
                }

                const data = await response.json();

                badge.textContent = data.unreadCount > 99
                    ? "99+"
                    : String(data.unreadCount);

                badge.hidden = data.unreadCount === 0;

                list.replaceChildren();

                if (data.notifications.length === 0) {
                    const empty = document.createElement("p");
                    empty.className = "notificationEmpty";
                    empty.textContent = "You have no notifications yet.";
                    list.appendChild(empty);
                    return;
                }

                for (const notification of data.notifications) {
                    const item = document.createElement("div");
                    item.className = "notificationItem";

                    if (!notification.Is_Read) {
                        item.classList.add("unreadNotification");
                    }

                    const title = document.createElement("strong");
                    title.textContent = notification.Title;

                    const message = document.createElement("p");
                    message.textContent = notification.Message;

                    const date = document.createElement("small");
                    date.textContent = new Date(
                        notification.Created_At
                    ).toLocaleString();

                    item.append(title, message, date);

                    if (!notification.Is_Read) {
                        const readButton = document.createElement("button");
                        readButton.type = "button";
                        readButton.className = "markReadBtn";
                        readButton.textContent = "Mark as read";

                        readButton.addEventListener("click", async () => {
                            readButton.disabled = true;

                            try {
                                const result = await fetch(
                                    `${API_BASE}/api/doctor/notifications/${notification.Notification_ID}/read`,
                                    {
                                        method: "PATCH",
                                        credentials: "include"
                                    }
                                );

                                if (!result.ok) {
                                    throw new Error(
                                        "Could not update notification"
                                    );
                                }

                                await loadNotifications();

                            } catch (error) {
                                alert(error.message);
                                readButton.disabled = false;
                            }
                        });

                        item.appendChild(readButton);
                    }

                    list.appendChild(item);
                }

            } catch (error) {
                console.error(error);
                list.textContent = "Unable to load notifications.";
            }
        }

        function toggleNotifications() {
            panel.hidden = !panel.hidden;
            bell.setAttribute(
                "aria-expanded",
                String(!panel.hidden)
            );

            if (!panel.hidden) {
                const rect = bell.getBoundingClientRect();

                const left = Math.max(
                    10,
                    Math.min(
                        rect.right - 350,
                        window.innerWidth - 360
                    )
                );

                panel.style.top = `${rect.bottom + 10}px`;
                panel.style.left = `${left}px`;

                loadNotifications();
            }
        }

        bell.addEventListener("click", toggleNotifications);

        bell.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleNotifications();
            }
        });

        panel.querySelector(".closeNotifications")
            .addEventListener("click", () => {
                panel.hidden = true;
                bell.setAttribute("aria-expanded", "false");
            });

        loadNotifications();
    });

})();
