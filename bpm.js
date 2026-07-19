"use strict";

(() => {
    const endpoint = "https://heart-api.aledsamuel.workers.dev/v1/public/latest";
    const pollIntervalMilliseconds = 60_000;
    const requestTimeoutMilliseconds = 10_000;

    const valueElement = document.querySelector("#bpm-value");
    const statusElement = document.querySelector("#bpm-status");
    const timeElement = document.querySelector("#bpm-time");

    let pollTimer = null;
    let activeController = null;
    let hasDisplayedReading = false;

    function showReading(payload) {
        const measuredAt = new Date(payload.measuredAt);

        valueElement.textContent = String(payload.bpm);
        statusElement.textContent = payload.live ? "Live" : "Last reading";
        statusElement.dataset.live = String(payload.live);
        hasDisplayedReading = true;

        if (Number.isNaN(measuredAt.getTime())) {
            timeElement.textContent = "";
            timeElement.removeAttribute("datetime");
            return;
        }

        timeElement.dateTime = payload.measuredAt;
        timeElement.textContent = `Measured ${measuredAt.toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "medium",
        })}`;
    }

    function showNoReading(message) {
        valueElement.textContent = "—";
        statusElement.textContent = message;
        statusElement.dataset.live = "false";
        timeElement.textContent = "";
        timeElement.removeAttribute("datetime");
        hasDisplayedReading = false;
    }

    function isReading(payload) {
        return payload !== null
            && typeof payload === "object"
            && payload.version === 1
            && typeof payload.live === "boolean"
            && Number.isInteger(payload.bpm)
            && payload.bpm >= 20
            && payload.bpm <= 250
            && typeof payload.measuredAt === "string";
    }

    async function refreshReading() {
        if (activeController !== null) {
            return;
        }

        const controller = new AbortController();
        activeController = controller;
        const timeout = window.setTimeout(
            () => controller.abort(),
            requestTimeoutMilliseconds,
        );

        try {
            const response = await fetch(endpoint, {
                cache: "no-store",
                headers: { Accept: "application/json" },
                signal: controller.signal,
            });
            if (!response.ok) {
                throw new Error(`Unexpected response: ${response.status}`);
            }

            const payload = await response.json();
            if (isReading(payload)) {
                showReading(payload);
            } else if (
                payload !== null
                && typeof payload === "object"
                && payload.version === 1
                && payload.live === false
                && payload.bpm === null
                && payload.measuredAt === null
            ) {
                showNoReading("No reading yet");
            } else {
                throw new Error("Unexpected response body");
            }
        } catch (error) {
            if (controller.signal.aborted && document.hidden) {
                return;
            }

            if (hasDisplayedReading) {
                statusElement.textContent = "Connection unavailable";
                statusElement.dataset.live = "false";
            } else {
                showNoReading("Connection unavailable");
            }
        } finally {
            window.clearTimeout(timeout);
            if (activeController === controller) {
                activeController = null;
            }
        }
    }

    function startPolling() {
        if (pollTimer !== null) {
            return;
        }

        void refreshReading();
        pollTimer = window.setInterval(
            () => void refreshReading(),
            pollIntervalMilliseconds,
        );
    }

    function stopPolling() {
        if (pollTimer !== null) {
            window.clearInterval(pollTimer);
            pollTimer = null;
        }
        activeController?.abort();
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            stopPolling();
        } else {
            startPolling();
        }
    });

    if (!document.hidden) {
        startPolling();
    }
})();
