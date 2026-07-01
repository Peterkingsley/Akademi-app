const DEFAULT_API_URLS = [
  "https://akademi-app-1.onrender.com",
  "https://akademi-app.onrender.com",
];

function parseCandidateUrls(...sources) {
  const seen = new Set();
  const candidates = [];

  sources.forEach((source) => {
    if (!source) return;

    String(source)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((value) => {
        const normalized = value.replace(/\/+$/, "");
        if (seen.has(normalized)) return;
        seen.add(normalized);
        candidates.push(normalized);
      });
  });

  return candidates;
}

const API_CANDIDATE_URLS = parseCandidateUrls(
  window.AKADEMI_API_URL,
  window.AKADEMI_API_FALLBACK_URLS,
  ...DEFAULT_API_URLS
);
const WHATSAPP_CHANNEL_URL =
  window.AKADEMI_WHATSAPP_CHANNEL_URL || "https://whatsapp.com/channel/0029VbCc2PP3gvWgv5V9rG0s";

let currentApiBaseUrl = API_CANDIDATE_URLS[0] || DEFAULT_API_URLS[0];

const form = document.getElementById("waitlistForm");
const statusEl = document.getElementById("formStatus");
const schoolSearch = document.getElementById("schoolSearch");
const schoolId = document.getElementById("schoolId");
const schoolResults = document.getElementById("schoolResults");
const facultyTrigger = document.getElementById("facultyTrigger");
const facultyValue = document.getElementById("facultyValue");
const facultyResults = document.getElementById("facultyResults");
const departmentTrigger = document.getElementById("departmentTrigger");
const departmentValue = document.getElementById("departmentValue");
const departmentId = document.getElementById("departmentId");
const departmentResults = document.getElementById("departmentResults");

let selectedSchool = null;
let selectedFaculty = null;
let selectedDepartment = null;
let faculties = [];
let departments = [];
let schoolSearchTimer = null;
let latestSchoolSearchRequestId = 0;

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `form-note ${type || ""}`.trim();
}

function closeResults(except) {
  [schoolResults, facultyResults, departmentResults].forEach((el) => {
    if (el !== except) el.classList.remove("open");
  });
}

function renderOptions(container, items, getTitle, getSubtitle, onSelect, emptyMessage) {
  container.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "lookup-empty";
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    container.classList.add("open");
    return;
  }

  items.forEach((item) => {
    const button = document.createElement("button");
    button.className = "lookup-option";
    button.type = "button";
    const title = document.createElement("strong");
    title.textContent = getTitle(item);
    button.appendChild(title);
    const subtitleText = getSubtitle(item);
    if (subtitleText) {
      const subtitle = document.createElement("small");
      subtitle.textContent = subtitleText;
      button.appendChild(subtitle);
    }
    button.addEventListener("click", () => onSelect(item));
    container.appendChild(button);
  });

  container.classList.add("open");
}

async function fetchJson(path) {
  let lastError = null;

  const orderedBaseUrls = [
    currentApiBaseUrl,
    ...API_CANDIDATE_URLS.filter((baseUrl) => baseUrl !== currentApiBaseUrl),
  ];

  for (const baseUrl of orderedBaseUrls) {
    try {
      const response = await fetch(`${baseUrl}${path}`);
      const data = await response.json().catch(() => []);

      if (!response.ok) {
        const message = data.message || "Could not load options.";
        if (response.status >= 500) {
          throw new Error(message);
        }
        currentApiBaseUrl = baseUrl;
        throw new Error(message);
      }

      currentApiBaseUrl = baseUrl;
      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Could not load options.");
}

async function fetchUniversitySuggestions(query) {
  let lastError = null;
  const orderedBaseUrls = [
    currentApiBaseUrl,
    ...API_CANDIDATE_URLS.filter((baseUrl) => baseUrl !== currentApiBaseUrl),
  ];
  let emptyResult = [];

  for (const baseUrl of orderedBaseUrls) {
    try {
      const response = await fetch(`${baseUrl}/universities?search=${encodeURIComponent(query)}&limit=12`);
      const data = await response.json().catch(() => []);

      if (!response.ok) {
        const message = data.message || "Could not load schools.";
        if (response.status >= 500) {
          throw new Error(message);
        }
        throw new Error(message);
      }

      if (Array.isArray(data) && data.length > 0) {
        currentApiBaseUrl = baseUrl;
        return data;
      }

      if (Array.isArray(data)) {
        emptyResult = data;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (emptyResult.length === 0 && lastError) {
    throw lastError;
  }

  return emptyResult;
}

function resetFaculty() {
  selectedFaculty = null;
  faculties = [];
  facultyValue.value = "";
  facultyTrigger.textContent = selectedSchool ? "Select faculty" : "Pick school first";
  facultyTrigger.disabled = !selectedSchool;
  facultyResults.classList.remove("open");
  resetDepartment();
}

function resetDepartment() {
  selectedDepartment = null;
  departments = [];
  departmentValue.value = "";
  departmentId.value = "";
  departmentTrigger.textContent = selectedFaculty ? "Select department" : "Pick faculty first";
  departmentTrigger.disabled = !selectedFaculty;
  departmentResults.classList.remove("open");
}

async function selectSchool(school) {
  selectedSchool = school;
  schoolSearch.value = school.name;
  schoolId.value = school.id;
  schoolResults.classList.remove("open");
  resetFaculty();
  setStatus("School selected. Pick your faculty next.", "");

  try {
    faculties = await fetchJson(`/universities/${encodeURIComponent(school.id)}/faculties`);
  } catch (error) {
    setStatus(error.message || "Could not load faculties.", "error");
  }
}

function selectFaculty(faculty) {
  selectedFaculty = faculty;
  facultyValue.value = faculty.name;
  facultyTrigger.textContent = faculty.name;
  facultyResults.classList.remove("open");
  resetDepartment();
  setStatus("Faculty selected. Pick your department next.", "");
}

async function selectDepartment(department) {
  selectedDepartment = department;
  departmentValue.value = department.name;
  departmentId.value = department.id;
  departmentTrigger.textContent = department.name;
  departmentResults.classList.remove("open");
  setStatus("Looks good. Finish the form and join the waitlist.", "");
}

schoolSearch.addEventListener("input", () => {
  const query = schoolSearch.value.trim();
  const requestId = ++latestSchoolSearchRequestId;
  selectedSchool = null;
  schoolId.value = "";
  resetFaculty();
  clearTimeout(schoolSearchTimer);

  if (query.length < 2) {
    schoolResults.classList.remove("open");
    return;
  }

  schoolSearchTimer = setTimeout(async () => {
    try {
      const schools = await fetchUniversitySuggestions(query);
      if (requestId !== latestSchoolSearchRequestId || schoolSearch.value.trim() !== query) {
        return;
      }
      renderOptions(
        schoolResults,
        schools,
        (school) => school.name,
        (school) => school.location || "",
        selectSchool,
        "No school found. Try the full official school name."
      );
    } catch (error) {
      if (requestId !== latestSchoolSearchRequestId || schoolSearch.value.trim() !== query) {
        return;
      }
      renderOptions(schoolResults, [], () => "", () => "", () => {}, error.message || "Could not load schools.");
    }
  }, 260);
});

facultyTrigger.addEventListener("click", () => {
  if (!selectedSchool) return;
  closeResults(facultyResults);
  renderOptions(
    facultyResults,
    faculties,
    (faculty) => faculty.name,
    (faculty) => `${faculty.departmentCount} departments`,
    selectFaculty,
    "No faculties found for this school yet."
  );
});

departmentTrigger.addEventListener("click", async () => {
  if (!selectedSchool || !selectedFaculty) return;
  closeResults(departmentResults);

  try {
    if (!departments.length) {
      departments = await fetchJson(
        `/universities/${encodeURIComponent(selectedSchool.id)}/departments?faculty=${encodeURIComponent(selectedFaculty.name)}`
      );
    }
    renderOptions(
      departmentResults,
      departments,
      (department) => department.name,
      (department) => department.faculty,
      selectDepartment,
      "No departments found under this faculty yet."
    );
  } catch (error) {
    renderOptions(departmentResults, [], () => "", () => "", () => {}, error.message || "Could not load departments.");
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".lookup-field")) {
    closeResults();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = form.querySelector("button[type='submit']");
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  if (!selectedSchool || !schoolId.value) {
    setStatus("Please select your school from the Akademi database suggestions.", "error");
    schoolSearch.focus();
    return;
  }

  if (!selectedFaculty || !facultyValue.value) {
    setStatus("Please select your faculty after choosing your school.", "error");
    facultyTrigger.focus();
    return;
  }

  if (!selectedDepartment || !departmentId.value) {
    setStatus("Please select your department after choosing your faculty.", "error");
    departmentTrigger.focus();
    return;
  }

  payload.source = "akademi_waitlist_static_site";
  payload.metadata = {
    page: window.location.href,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    school_id: schoolId.value,
    faculty: facultyValue.value,
    department_id: departmentId.value,
  };

  submitButton.disabled = true;
  submitButton.textContent = "Joining...";
  setStatus("Saving your spot...", "");

  try {
    let joined = false;
    let lastError = null;

    for (const baseUrl of API_CANDIDATE_URLS) {
      try {
        const response = await fetch(`${baseUrl}/waitlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message = data.message || "Could not join waitlist.";
          if (response.status >= 500) {
            throw new Error(message);
          }
          throw new Error(message);
        }

        currentApiBaseUrl = baseUrl;
        joined = true;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!joined) {
      throw lastError || new Error("Could not join waitlist.");
    }

    setStatus("You're on the list. Redirecting you to our WhatsApp channel...", "success");
    form.reset();
    selectedSchool = null;
    schoolId.value = "";
    resetFaculty();
    setTimeout(() => {
      window.location.href = WHATSAPP_CHANNEL_URL;
    }, 600);
  } catch (error) {
    setStatus(error.message || "Something went wrong. Please try again.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Join the waitlist";
  }
});
