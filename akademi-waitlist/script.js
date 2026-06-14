const API_BASE_URL = window.AKADEMI_API_URL || "https://akademi-app.onrender.com";

const form = document.getElementById("waitlistForm");
const statusEl = document.getElementById("formStatus");

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `form-note ${type || ""}`.trim();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = form.querySelector("button[type='submit']");
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  payload.source = "akademi_waitlist_static_site";
  payload.metadata = {
    page: window.location.href,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  submitButton.disabled = true;
  submitButton.textContent = "Joining...";
  setStatus("Saving your spot...", "");

  try {
    const response = await fetch(`${API_BASE_URL}/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Could not join waitlist.");
    }

    setStatus("You're on the Akademi beta waitlist. We'll reach out when your school or department is ready.", "success");
    form.reset();
  } catch (error) {
    setStatus(error.message || "Something went wrong. Please try again.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Join the waitlist";
  }
});
