
(() => {
    const API_BASE = "http://127.0.0.1:3000";
    const POLL_MS = 20000;

    function initializeNotifications() {
        const bell = document.querySelector(".picon.bell");
        if (!bell || bell.querySelector(".notificationBadge")) return;

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
        let loading = false;
        let readKey = null;
        let transientRead = new Set();

        function readIds() {
            const ids = new Set(transientRead);
            if (!readKey) return ids;
            try {
                const saved = JSON.parse(localStorage.getItem(readKey) || "[]");
                if (Array.isArray(saved)) {
                    saved.forEach(value => ids.add(String(value)));
                }
            } catch {
                // Storage can be unavailable in private browsing.
            }
            return ids;
        }

        function rememberRead(id) {
            transientRead.add(String(id));
            const ids = readIds();
            ids.add(String(id));
            try {
                if (readKey) localStorage.setItem(readKey, JSON.stringify([...ids]));
            } catch {
                // Keep read state for this tab if storage is unavailable.
            }
        }

        async function loadNotifications() {
            if (loading) return;
            loading = true;
            try {
                const response = await fetch(`${API_BASE}/api/doctor/notifications`, {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store"
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Could not load notifications");
                if (!Array.isArray(data.notifications)) throw new Error("Invalid response");

                readKey = `doctor-cancel-read-v2-${data.viewerId}`;
                const storedRead = readIds();
                const notifications = data.notifications.map(notice => ({
                    ...notice,
                    Is_Read: Boolean(notice.Is_Read) || storedRead.has(String(notice.Notification_ID))
                }));
                const unread = notifications.filter(notice => !notice.Is_Read).length;
                badge.textContent = unread > 99 ? "99+" : String(unread);
                badge.hidden = unread === 0;
                list.replaceChildren();

                if (!notifications.length) {
                    const empty = document.createElement("p");
                    empty.className = "notificationEmpty";
                    empty.textContent = "You have no notifications yet.";
                    list.appendChild(empty);
                    return;
                }

                for (const notice of notifications) {
                    const item = document.createElement("div");
                    item.className = "notificationItem";
                    if (!notice.Is_Read) item.classList.add("unreadNotification");

                    const title = document.createElement("strong");
                    title.textContent = notice.Title || "Notification";
                    const message = document.createElement("p");
                    message.textContent = notice.Message || "";
                    const date = document.createElement("small");
                    date.textContent = "Cancellation time not recorded";
                    item.append(title, message, date);

                    if (!notice.Is_Read) {
                        const readButton = document.createElement("button");
                        readButton.type = "button";
                        readButton.className = "markReadBtn";
                        readButton.textContent = "Mark as read";
                        readButton.addEventListener("click", async () => {
                            readButton.disabled = true;
                            try {
                                const response = await fetch(
                                    `${API_BASE}/api/doctor/notifications/${encodeURIComponent(notice.Notification_ID)}/read`,
                                    { method: "PATCH", credentials: "include" }
                                );
                                if (!response.ok) {
                                    const data = await response.json().catch(() => ({}));
                                    throw new Error(data.error || "Could not mark as read");
                                }
                                rememberRead(notice.Notification_ID);
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
                console.error("Doctor notification load error:", error);
                if (!panel.hidden) list.textContent = error.message;
            } finally {
                loading = false;
            }
        }

        function toggleNotifications() {
            panel.hidden = !panel.hidden;
            bell.setAttribute("aria-expanded", String(!panel.hidden));
            if (!panel.hidden) {
                const rect = bell.getBoundingClientRect();
                panel.style.top = `${rect.bottom + 10}px`;
                panel.style.left = `${Math.max(10, Math.min(rect.right - 350, window.innerWidth - 360))}px`;
                loadNotifications();
            }
        }

        bell.addEventListener("click", toggleNotifications);
        bell.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleNotifications();
            }
        });
        panel.querySelector(".closeNotifications").addEventListener("click", () => {
            panel.hidden = true;
            bell.setAttribute("aria-expanded", "false");
        });

        loadNotifications();
        window.setInterval(() => {
            if (!document.hidden) loadNotifications();
        }, POLL_MS);
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) loadNotifications();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeNotifications);
    } else {
        initializeNotifications();
    }
})();
