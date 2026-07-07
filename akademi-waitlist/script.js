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
const schoolSearchCache = new Map();
const schoolSearchCacheTtlMs = 5 * 60 * 1000;
const schoolSearchCacheMaxEntries = 80;
const analyticsSessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const analyticsStorageKey = "akademi_waitlist_visitor_id";
const firedAnalyticsEvents = new Set();

function getVisitorId() {
  try {
    const existing = window.localStorage.getItem(analyticsStorageKey);
    if (existing) return existing;
    const created = `awv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(analyticsStorageKey, created);
    return created;
  } catch {
    return `awv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

const analyticsVisitorId = getVisitorId();
const LOOKUP_FETCH_TIMEOUT_MS = 7000;
const ANALYTICS_FETCH_TIMEOUT_MS = 3500;
const SUBMIT_FETCH_TIMEOUT_MS = 15000;

function normalizeLookupValue(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s&(),.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLookupKey(value) {
  return normalizeLookupValue(value).toLowerCase();
}

function getCachedSchoolSearch(cacheKey) {
  const cached = schoolSearchCache.get(cacheKey);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    schoolSearchCache.delete(cacheKey);
    return null;
  }

  return cached.data;
}

function setCachedSchoolSearch(cacheKey, data) {
  schoolSearchCache.set(cacheKey, {
    expiresAt: Date.now() + schoolSearchCacheTtlMs,
    data,
  });

  if (schoolSearchCache.size > schoolSearchCacheMaxEntries) {
    const oldestKey = schoolSearchCache.keys().next().value;
    if (oldestKey) {
      schoolSearchCache.delete(oldestKey);
    }
  }
}

function buildSchoolSearchFallbacks(query) {
  const base = normalizeLookupValue(query);
  const variants = new Set();
  const push = (value) => {
    const normalized = normalizeLookupValue(value);
    if (normalized.length >= 2) variants.add(normalized);
  };

  push(base);
  push(base.replace(/\buni(?:v(?:ersity)?)?\b/gi, "university"));
  push(base.replace(/\bfed(?:eral)?\s+uni(?:v(?:ersity)?)?\b/gi, "federal university"));
  push(base.replace(/\bfut\b/gi, "federal university of technology"));
  push(base.replace(/\bstate\s+uni(?:v(?:ersity)?)?\b/gi, "state university"));
  push(base.replace(/\bpoly\b/gi, "polytechnic"));
  push(base.replace(/[(),.-]/g, " "));

  return Array.from(variants).slice(0, 6);
}

function scoreSchoolMatch(query, school) {
  const normalizedQuery = normalizeLookupKey(query);
  const normalizedName = normalizeLookupKey(school.name);
  if (!normalizedQuery || !normalizedName) return 0;
  if (normalizedName === normalizedQuery) return 1000;
  if (normalizedName.startsWith(normalizedQuery)) return 800 - (normalizedName.length - normalizedQuery.length);
  if (normalizedName.includes(normalizedQuery)) return 600 - (normalizedName.indexOf(normalizedQuery) || 0);

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const nameTokens = normalizedName.split(" ").filter(Boolean);
  let tokenHits = 0;
  queryTokens.forEach((token) => {
    if (nameTokens.some((nameToken) => nameToken.startsWith(token) || nameToken.includes(token))) {
      tokenHits += 1;
    }
  });

  return tokenHits > 0 ? tokenHits * 80 : 0;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = LOOKUP_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

const RESERVED_PATH_CODES = new Set(["index.html", "styles.css", "script.js", "assets", "favicon.ico"]);

function getPathReferralCode() {
  const segments = window.location.pathname.split("/").filter(Boolean);
  if (segments.length !== 1) return null;

  const raw = decodeURIComponent(segments[0]);
  if (!/^[A-Za-z0-9_-]{2,64}$/.test(raw)) return null;
  if (RESERVED_PATH_CODES.has(raw.toLowerCase())) return null;

  return raw.toLowerCase();
}

function getWaitlistAttribution() {
  const params = new URLSearchParams(window.location.search);
  const pathCode = getPathReferralCode();

  return {
    page_url: window.location.href,
    page_path: window.location.pathname,
    referrer: document.referrer || "",
    utm_source: params.get("utm_source") || pathCode || "",
    utm_medium: params.get("utm_medium") || (pathCode ? "referral" : ""),
    utm_campaign: params.get("utm_campaign") || "",
    utm_content: params.get("utm_content") || "",
    utm_term: params.get("utm_term") || "",
  };
}

async function trackWaitlistEvent(eventName, extra = {}, options = {}) {
  const { once = false, keepalive = false } = options;
  const dedupeKey = once ? eventName : null;
  if (dedupeKey && firedAnalyticsEvents.has(dedupeKey)) {
    return;
  }

  const payload = {
    event_name: eventName,
    visitor_id: analyticsVisitorId,
    session_id: analyticsSessionId,
    ...getWaitlistAttribution(),
    ...extra,
  };

  let lastError = null;
  for (const baseUrl of API_CANDIDATE_URLS) {
    try {
      const response = await fetchWithTimeout(
        `${baseUrl}/waitlist/events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive,
        },
        ANALYTICS_FETCH_TIMEOUT_MS
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Could not track event.");
      }

      currentApiBaseUrl = baseUrl;
      if (dedupeKey) {
        firedAnalyticsEvents.add(dedupeKey);
      }
      return true;
    } catch (error) {
      lastError = error;
    }
  }

  if (window.console && lastError) {
    console.warn("Waitlist tracking failed:", lastError);
  }

  return false;
}

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
      const response = await fetchWithTimeout(`${baseUrl}${path}`);
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
  const normalizedQuery = normalizeLookupValue(query);
  const cacheKey = normalizeLookupKey(normalizedQuery);
  const cached = getCachedSchoolSearch(cacheKey);
  if (cached) {
    return cached;
  }

  let lastError = null;
  const orderedBaseUrls = [
    currentApiBaseUrl,
    ...API_CANDIDATE_URLS.filter((baseUrl) => baseUrl !== currentApiBaseUrl),
  ];
  const mergedResults = new Map();
  let sawSuccessfulResponse = false;
  const fallbackQueries = buildSchoolSearchFallbacks(normalizedQuery);

  for (const baseUrl of orderedBaseUrls) {
    try {
      for (const candidateQuery of fallbackQueries) {
        const response = await fetchWithTimeout(`${baseUrl}/universities?search=${encodeURIComponent(candidateQuery)}&limit=12`);
        const data = await response.json().catch(() => []);

        if (!response.ok) {
          const message = data.message || "Could not load schools.";
          if (response.status >= 500) {
            throw new Error(message);
          }
          throw new Error(message);
        }

        sawSuccessfulResponse = true;
        if (Array.isArray(data)) {
          data.forEach((school) => {
            if (school?.id && !mergedResults.has(school.id)) {
              mergedResults.set(school.id, school);
            }
          });
        }
      }
    } catch (error) {
      lastError = error;
    }
  }

  const rankedResults = Array.from(mergedResults.values())
    .map((school) => ({
      school,
      score: scoreSchoolMatch(normalizedQuery, school),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.school.name.localeCompare(b.school.name))
    .slice(0, 12)
    .map((item) => item.school);

  if (!rankedResults.length && !sawSuccessfulResponse && lastError) {
    throw lastError;
  }

  setCachedSchoolSearch(cacheKey, rankedResults);
  return rankedResults;
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
  void trackWaitlistEvent("waitlist_school_selected", {
    school_name: school.name,
    metadata: {
      school_id: school.id,
      location: school.location || null,
    },
  });

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
  const rawQuery = schoolSearch.value;
  const query = normalizeLookupValue(rawQuery);
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
    void trackWaitlistEvent("waitlist_school_search", {
      school_query: query,
    });
    try {
      const schools = await fetchUniversitySuggestions(query);
      if (requestId !== latestSchoolSearchRequestId || normalizeLookupValue(schoolSearch.value) !== query) {
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
      if (requestId !== latestSchoolSearchRequestId || normalizeLookupValue(schoolSearch.value) !== query) {
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

  const attribution = getWaitlistAttribution();
  payload.source = "akademi_waitlist_static_site";
  payload.utm_source = attribution.utm_source || "";
  payload.utm_medium = attribution.utm_medium || "";
  payload.utm_campaign = attribution.utm_campaign || "";
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
        const response = await fetchWithTimeout(
          `${baseUrl}/waitlist`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
          SUBMIT_FETCH_TIMEOUT_MS
        );

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

    await trackWaitlistEvent("waitlist_submit_success", {
      school_name: selectedSchool?.name || "",
      metadata: {
        school_id: schoolId.value,
        faculty: facultyValue.value,
        department: departmentValue.value,
        main_struggle: payload.main_struggle || null,
      },
    });

    setStatus(
      "You have joined the waitlist and you will be redirected to our WhatsApp channel to stay updated.",
      "success"
    );
    form.reset();
    selectedSchool = null;
    schoolId.value = "";
    resetFaculty();
    setTimeout(async () => {
      await trackWaitlistEvent(
        "waitlist_redirect_whatsapp",
        {
          metadata: {
            destination: WHATSAPP_CHANNEL_URL,
          },
        },
        { keepalive: true }
      );
      window.location.href = WHATSAPP_CHANNEL_URL;
    }, 1600);
  } catch (error) {
    setStatus(error.message || "Something went wrong. Please try again.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Join the waitlist";
  }
});

form.addEventListener(
  "focusin",
  () => {
    void trackWaitlistEvent("waitlist_form_started", {}, { once: true });
  },
  { passive: true }
);

void trackWaitlistEvent("waitlist_page_view", {}, { once: true });
