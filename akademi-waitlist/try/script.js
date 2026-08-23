const DEFAULT_API_URLS = ["https://akademi-app-1.onrender.com"];

function parseUrls(...sources) {
  const seen = new Set();
  return sources
    .flatMap((source) => String(source || "").split(","))
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter((value) => value && !seen.has(value) && seen.add(value));
}

const API_URLS = parseUrls(
  window.AKADEMI_API_URL,
  window.AKADEMI_API_FALLBACK_URLS,
  ...DEFAULT_API_URLS,
);
const SESSION_STORAGE_KEY = "akademi_demo_exam_prep_session";
const VISITOR_STORAGE_KEY = "akademi_waitlist_visitor_id";
const DEFAULT_API_TIMEOUT_MS = 15000;
const FEEDBACK_API_TIMEOUT_MS = 60000;
const analyticsSessionId = `demo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const trackedSelections = new Set();
let currentApiBaseUrl = API_URLS[0];

const state = {
  materials: [],
  materialQuery: new URLSearchParams(window.location.search).get("course") || "",
  session: null,
  selectedAnswer: "",
  reasoning: "",
  attempt: null,
  loading: true,
  busy: false,
  feedbackSlow: false,
  error: "",
  view: "materials",
};

class DemoApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function getVisitorId() {
  try {
    const existing = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing) return existing;
    const created = `awv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(VISITOR_STORAGE_KEY, created);
    return created;
  } catch {
    return `awv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

const visitorId = getVisitorId();

function attribution() {
  const params = new URLSearchParams(window.location.search);
  return {
    page_url: window.location.href,
    page_path: window.location.pathname,
    referrer: document.referrer || "",
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_content: params.get("utm_content") || "",
    utm_term: params.get("utm_term") || "",
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function track(eventName, metadata = {}, options = {}) {
  const payload = {
    event_name: eventName,
    visitor_id: visitorId,
    session_id: analyticsSessionId,
    ...attribution(),
    metadata,
  };
  for (const baseUrl of API_URLS) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/waitlist/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: Boolean(options.keepalive),
      }, 3500);
      if (response.ok) return true;
    } catch {
      // Analytics must never interrupt the learning experience.
    }
  }
  return false;
}

async function api(path, options = {}, timeoutMs = DEFAULT_API_TIMEOUT_MS) {
  let lastError = null;
  for (const baseUrl of API_URLS) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      }, timeoutMs);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new DemoApiError(
          data.message || "Akademi couldn't load this question right now. Try again.",
          data.code || "DEMO_UNAVAILABLE",
          response.status,
        );
      }
      currentApiBaseUrl = baseUrl;
      return data;
    } catch (error) {
      lastError = error?.name === "AbortError"
        ? new DemoApiError(
          "Akademi is taking longer than expected to prepare your feedback. Please try again.",
          "DEMO_REQUEST_TIMEOUT",
          504,
        )
        : error;
      if (error instanceof DemoApiError && error.status < 500) throw error;
    }
  }
  throw lastError || new DemoApiError("Akademi couldn't load this question right now. Try again.", "DEMO_UNAVAILABLE", 503);
}

function saveSessionId(id) {
  try {
    if (id) sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // The demo still works when browser storage is unavailable.
  }
}

function savedSessionId() {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function create(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = String(text);
  return element;
}

function append(parent, ...children) {
  children.flat().filter(Boolean).forEach((child) => parent.appendChild(child));
  return parent;
}

function button(label, className, onClick, options = {}) {
  const element = create("button", className, label);
  element.type = "button";
  element.disabled = Boolean(options.disabled);
  if (options.ariaLabel) element.setAttribute("aria-label", options.ariaLabel);
  element.addEventListener("click", onClick);
  return element;
}

function announce(message) {
  const announcer = document.getElementById("announcer");
  announcer.textContent = "";
  window.setTimeout(() => { announcer.textContent = message; }, 20);
}

function replaceScreen(content) {
  const screen = document.getElementById("demoScreen");
  screen.replaceChildren(content);
}

function appHeader(title, meta, icon = "A") {
  const header = create("div", "app-header");
  const mark = create("div", "app-mark", icon);
  mark.setAttribute("aria-hidden", "true");
  const copy = create("div", "app-heading");
  append(copy, create("h3", "", title), create("p", "", meta));
  return append(header, mark, copy);
}

function errorMessage(message = state.error) {
  return message ? create("div", "error-message", message) : null;
}

function renderLoading() {
  const content = create("div", "screen-content");
  append(content, appHeader("Guided Exam Prep", "Public demo", "✦"));
  append(content, create("div", "skeleton title"));
  for (let index = 0; index < 4; index += 1) append(content, create("div", "skeleton"));
  replaceScreen(content);
}

function renderMaterials() {
  state.view = "materials";
  const content = create("div", "screen-content");
  append(content, appHeader("Guided Exam Prep", "Choose a verified material", "✦"));
  append(content, create("h3", "screen-title", "What do you want to practice?"));
  append(content, create("p", "screen-copy", "Pick a real Akademi material and start with one guided question."));

  const searchWrap = create("div", "search-wrap");
  const search = create("input", "search-input");
  search.type = "search";
  search.placeholder = "Search course or material";
  search.value = state.materialQuery;
  search.setAttribute("aria-label", "Search course or material");
  append(searchWrap, search);
  append(content, searchWrap, errorMessage());

  const label = create("p", "section-label", "Public demo materials");
  const list = create("div", "material-list");
  append(content, label, list);

  const updateList = () => {
    const query = search.value.trim().toLowerCase();
    state.materialQuery = search.value;
    const filtered = state.materials.filter((material) =>
      !query || material.title.toLowerCase().includes(query) || String(material.courseCode || "").toLowerCase().includes(query),
    );
    list.replaceChildren();
    if (filtered.length === 0) {
      const empty = create("div", "empty-state");
      append(
        empty,
        create("div", "empty-icon", "◇"),
        create("h3", "", state.materials.length ? "No matching material" : "Demo materials are being prepared"),
        create("p", "", state.materials.length
          ? "Try a different course code or material title."
          : "The public catalog is controlled by Akademi. Check back shortly or join the waitlist for access."),
      );
      if (!state.materials.length) {
        const join = create("a", "primary-button");
        join.href = "/#waitlist";
        join.textContent = "Join the waitlist";
        join.style.display = "flex";
        join.style.alignItems = "center";
        join.style.justifyContent = "center";
        join.addEventListener("click", () => void track("demo_conversion_clicked", { placement: "empty_catalog" }, { keepalive: true }));
        append(empty, join);
      }
      append(list, empty);
      return;
    }
    filtered.forEach((material) => {
      const choice = button("", "material-button", () => void startDemo(material));
      const icon = create("span", "material-icon", "▤");
      icon.setAttribute("aria-hidden", "true");
      const copy = create("span", "material-copy");
      append(
        copy,
        create("p", "material-title", material.title),
        create("p", "material-meta", `${material.courseCode || "General"} · ${material.questionCount} available questions`),
      );
      const arrow = create("span", "material-arrow", "›");
      arrow.setAttribute("aria-hidden", "true");
      append(choice, icon, copy, arrow);
      choice.setAttribute("aria-label", `Practice ${material.courseCode || material.title}`);
      append(list, choice);
    });
  };
  search.addEventListener("input", updateList);
  updateList();
  replaceScreen(content);
}

function progressPercent(session) {
  return Math.min(100, Math.round((session.progress.completed / session.progress.total) * 100));
}

function renderSession() {
  const session = state.session;
  const question = session && session.currentQuestion;
  if (!session || !question) {
    showConversion();
    return;
  }
  state.view = "question";
  const feedback = state.attempt && state.attempt.feedback;
  const content = create("div", "screen-content");
  append(content, appHeader(session.material.title, session.material.courseCode || "General", "▤"));

  const progressRow = create("div", "progress-row");
  append(
    progressRow,
    create("span", "", session.isRetry ? "Same-concept retry" : `Question ${Math.min(session.progress.completed + 1, session.progress.total)} of ${session.progress.total}`),
    create("span", "", `${progressPercent(session)}%`),
  );
  const trackEl = create("div", "progress-track");
  const fill = create("div", "progress-fill");
  fill.style.width = `${progressPercent(session)}%`;
  append(trackEl, fill);
  append(content, progressRow, trackEl);

  const questionCard = create("section", "card question-card");
  questionCard.setAttribute("aria-labelledby", "questionText");
  append(questionCard, create("span", "badge", question.difficulty), create("p", "question-text", question.text));
  questionCard.lastChild.id = "questionText";
  append(content, questionCard);

  const options = create("div", "options");
  options.setAttribute("role", "radiogroup");
  options.setAttribute("aria-label", "Answer options");
  question.options.forEach((option, index) => {
    const selected = state.selectedAnswer === option;
    const correct = Boolean(feedback && feedback.correctAnswer === option);
    const incorrect = Boolean(feedback && selected && !feedback.isCorrect);
    const optionClass = ["option", selected ? "selected" : "", correct ? "correct" : "", incorrect ? "incorrect" : ""]
      .filter(Boolean).join(" ");
    const choice = button("", optionClass, () => selectAnswer(option), { disabled: Boolean(feedback) || state.busy });
    choice.setAttribute("role", "radio");
    choice.setAttribute("aria-checked", String(selected));
    append(choice, create("span", "option-letter", String.fromCharCode(65 + index)), create("span", "option-label", option));
    append(options, choice);
  });
  append(content, options);

  if (state.selectedAnswer || feedback) append(content, renderReasoningCard());
  if (state.error) append(content, errorMessage());
  if (feedback) append(content, renderFeedback());
  replaceScreen(content);
}

function selectAnswer(option) {
  if (state.attempt || state.busy) return;
  state.selectedAnswer = option;
  const questionId = state.session.currentQuestion.id;
  if (!trackedSelections.has(questionId)) {
    trackedSelections.add(questionId);
    void track("demo_question_answered", {
      material_id: state.session.material.id,
      question_id: questionId,
    });
  }
  renderSession();
  document.querySelector(".reasoning-input")?.focus();
}

function renderReasoningCard() {
  const card = create("section", "card reasoning-card");
  append(
    card,
    create("h4", "", "Why do you think this is the answer?"),
    create("p", "supporting", "Explain your thinking in your own words. Akademi will check both your answer and your reasoning."),
  );
  const input = create("textarea", "reasoning-input");
  input.placeholder = "I chose this because...";
  input.value = state.reasoning;
  input.maxLength = 2000;
  input.disabled = Boolean(state.attempt) || state.busy;
  input.setAttribute("aria-label", "Explain why you chose this answer");
  const count = create("span", "character-count", `${state.reasoning.length}/2,000`);
  const submit = button(
    state.busy
      ? (state.feedbackSlow ? "Still preparing your feedback..." : "Checking your reasoning...")
      : "Check my reasoning",
    "primary-button",
    () => void submitReasoning(),
    { disabled: state.busy || Boolean(state.attempt) || state.reasoning.trim().length < 5 },
  );
  input.addEventListener("input", () => {
    state.reasoning = input.value;
    count.textContent = `${state.reasoning.length}/2,000`;
    submit.disabled = state.busy || state.reasoning.trim().length < 5;
  });
  append(card, input, count);
  if (!state.attempt) append(card, submit);
  return card;
}

function feedbackList(title, items) {
  if (!Array.isArray(items) || !items.length) return null;
  const section = create("div", "");
  append(section, create("p", "supporting", title));
  const list = create("ul", "feedback-list");
  items.forEach((item) => append(list, create("li", "", item)));
  append(section, list);
  return section;
}

function renderFeedback() {
  const attempt = state.attempt;
  const feedback = attempt.feedback;
  const wrap = create("section", "feedback-wrap");
  wrap.setAttribute("aria-label", "Akademi feedback");

  if (attempt.correctionMessage) append(wrap, create("div", "correction", attempt.correctionMessage));
  const verdict = create("div", `card verdict ${feedback.isCorrect ? "correct" : "incorrect"}`);
  const verdictCopy = create("div", "");
  append(
    verdictCopy,
    create("h4", "", feedback.isCorrect ? "Correct" : "Not quite"),
    create("p", "", feedback.isCorrect
      ? `Correct answer: ${feedback.correctAnswer}`
      : `Your answer: ${feedback.selectedAnswer}\nCorrect answer: ${feedback.correctAnswer}`),
  );
  append(verdict, create("span", "verdict-icon", feedback.isCorrect ? "✓" : "×"), verdictCopy);
  append(wrap, verdict);

  const why = create("div", "card feedback-card");
  append(why, create("h4", "", "Why this is correct"), create("p", "", feedback.teachingExplanation.whyCorrect));
  const concept = create("div", "concept-box");
  append(concept, create("strong", "", "Key concept"), create("span", "", feedback.teachingExplanation.keyConcept));
  append(why, concept);
  append(wrap, why);

  const reasoning = create("div", "card feedback-card");
  append(reasoning, create("h4", "", "Your reasoning"));
  append(
    reasoning,
    feedbackList("What you understood", feedback.reasoningAssessment.whatYouGotRight),
    feedbackList("What to improve", feedback.reasoningAssessment.whatYouMissed),
  );
  if (!feedback.personalized) {
    append(reasoning, create("p", "supporting", "Personalized analysis was unavailable, so this uses the verified answer explanation."));
  }
  append(wrap, reasoning);

  const study = create("div", "card feedback-card study-card");
  append(
    study,
    create("p", "study-eyebrow", "Go and study this"),
    create("p", "study-title", feedback.studyRecommendation.title),
  );
  const topics = create("ul", "feedback-list");
  feedback.studyRecommendation.topics.forEach((topic) => append(topics, create("li", "", topic)));
  append(study, topics, create("p", "", feedback.studyRecommendation.instruction));
  append(wrap, study);

  if (Array.isArray(feedback.optionBreakdown) && feedback.optionBreakdown.length) {
    const details = create("details", "card feedback-card details");
    append(details, create("summary", "", "Understand every option"));
    feedback.optionBreakdown.forEach((item) => {
      const explanation = create("div", "option-explanation");
      append(explanation, create("p", "", `${item.isCorrect ? "✓" : "•"} ${item.option}`), create("p", "", item.whyItFitsOrDoesNotFit));
      append(details, explanation);
    });
    append(wrap, details);
  }

  if (state.session.isComplete) {
    append(wrap, button("Finish demo", "primary-button", finishDemo));
  } else {
    const branch = create("div", "card branch-card");
    append(
      branch,
      create("h4", "", "Want to try this kind of question again?"),
      create("p", "", "Akademi will find another grounded question testing the closest concept in this material."),
    );
    const actions = create("div", "button-stack");
    append(
      actions,
      button(state.busy ? "Finding another..." : "Yes, give me another", "primary-button", () => void retryQuestion(), { disabled: state.busy }),
      button("No, continue", "secondary-button", () => void continueDemo(), { disabled: state.busy }),
    );
    append(branch, actions);
    append(wrap, branch);
  }
  return wrap;
}

async function loadMaterials(preserveError = false) {
  state.loading = true;
  if (!preserveError) state.error = "";
  renderLoading();
  try {
    state.materials = await api("/demo/exam-prep/materials");
  } catch (error) {
    state.materials = [];
    state.error = error.message || "Akademi couldn't load the demo materials right now. Try again.";
  } finally {
    state.loading = false;
    renderMaterials();
  }
}

async function startDemo(material) {
  state.busy = true;
  state.error = "";
  renderLoading();
  void track("demo_material_selected", { material_id: material.id, course_code: material.courseCode || "" });
  try {
    state.session = await api("/demo/exam-prep/sessions", {
      method: "POST",
      body: JSON.stringify({ materialId: material.id }),
    });
    saveSessionId(state.session.id);
    state.selectedAnswer = "";
    state.reasoning = "";
    state.attempt = state.session.currentAttempt || null;
    state.busy = false;
    renderSession();
    announce("Your first Akademi question is ready.");
  } catch (error) {
    state.error = error.message;
    renderMaterials();
  } finally {
    state.busy = false;
  }
}

async function submitReasoning() {
  if (state.busy || !state.session?.currentQuestion || state.reasoning.trim().length < 5) return;
  state.busy = true;
  state.feedbackSlow = false;
  state.error = "";
  renderSession();
  const slowFeedbackTimer = window.setTimeout(() => {
    if (!state.busy || state.attempt) return;
    state.feedbackSlow = true;
    renderSession();
    announce("Akademi is still preparing your feedback.");
  }, 8000);
  const question = state.session.currentQuestion;
  void track("demo_reasoning_submitted", {
    material_id: state.session.material.id,
    question_id: question.id,
    reasoning_length: state.reasoning.trim().length,
  });
  try {
    const attempt = await api(
      `/demo/exam-prep/sessions/${encodeURIComponent(state.session.id)}/questions/${encodeURIComponent(question.id)}/submit`,
      {
        method: "POST",
        body: JSON.stringify({ selectedAnswer: state.selectedAnswer, reasoning: state.reasoning }),
      },
      FEEDBACK_API_TIMEOUT_MS,
    );
    state.attempt = attempt;
    state.session.currentAttempt = attempt;
    state.session.progress = attempt.progress;
    state.session.isComplete = attempt.isComplete;
    void track("demo_feedback_viewed", {
      material_id: state.session.material.id,
      question_id: question.id,
      correct: attempt.feedback.isCorrect,
      retry: state.session.isRetry,
    });
    announce(attempt.feedback.isCorrect ? "Correct. Akademi feedback is ready." : "Not quite. Akademi feedback is ready.");
  } catch (error) {
    state.error = error.message;
    if (error.code === "DEMO_SESSION_EXPIRED") {
      saveSessionId(null);
      state.session = null;
    }
  } finally {
    window.clearTimeout(slowFeedbackTimer);
    state.busy = false;
    state.feedbackSlow = false;
    if (state.session) renderSession();
    else void loadMaterials();
  }
}

async function retryQuestion() {
  if (state.busy || !state.session?.currentQuestion) return;
  state.busy = true;
  state.error = "";
  renderSession();
  const sourceQuestionId = state.session.currentQuestion.id;
  void track("demo_retry_yes", { material_id: state.session.material.id, question_id: sourceQuestionId });
  try {
    state.session = await api(
      `/demo/exam-prep/sessions/${encodeURIComponent(state.session.id)}/questions/${encodeURIComponent(sourceQuestionId)}/retry`,
      { method: "POST", body: "{}" },
    );
    state.selectedAnswer = "";
    state.reasoning = "";
    state.attempt = null;
    window.scrollTo({ top: 0, behavior: "smooth" });
    announce("A similar question is ready.");
  } catch (error) {
    state.error = error.message;
  } finally {
    state.busy = false;
    renderSession();
  }
}

async function continueDemo() {
  if (state.busy || !state.session?.currentQuestion) return;
  state.busy = true;
  state.error = "";
  renderSession();
  const completedQuestionId = state.session.currentQuestion.id;
  void track("demo_retry_no", { material_id: state.session.material.id, question_id: completedQuestionId });
  try {
    state.session = await api(`/demo/exam-prep/sessions/${encodeURIComponent(state.session.id)}/next`, {
      method: "POST",
      body: JSON.stringify({ questionId: completedQuestionId }),
    });
    state.selectedAnswer = "";
    state.reasoning = "";
    state.attempt = state.session.currentAttempt || null;
    if (state.session.isComplete) finishDemo();
    else {
      window.scrollTo({ top: 0, behavior: "smooth" });
      announce("Your next question is ready.");
    }
  } catch (error) {
    state.error = error.message;
  } finally {
    state.busy = false;
    if (state.view !== "conversion") renderSession();
  }
}

function finishDemo() {
  void track("demo_completed", {
    material_id: state.session?.material.id || "",
    questions_evaluated: state.session?.progress.completed || 0,
  });
  showConversion();
}

function showConversion() {
  state.view = "conversion";
  saveSessionId(null);
  const content = create("div", "conversion");
  append(
    content,
    create("div", "conversion-mark", "✦"),
    create("h3", "", "Imagine doing this with your actual courses."),
    create("p", "", "Akademi doesn't just tell you whether you're wrong. It helps you understand what went wrong and what to study next."),
  );
  const actions = create("div", "button-stack");
  const join = create("a", "primary-button");
  join.href = "/#waitlist";
  join.textContent = "Join the waitlist";
  join.style.display = "flex";
  join.style.alignItems = "center";
  join.style.justifyContent = "center";
  join.addEventListener("click", () => void track("demo_conversion_clicked", { placement: "demo_complete" }, { keepalive: true }));
  const another = button("Try another material", "secondary-button", () => {
    state.session = null;
    state.attempt = null;
    state.selectedAnswer = "";
    state.reasoning = "";
    state.error = "";
    void loadMaterials();
  });
  append(actions, join, another);
  append(content, actions, create("p", "conversion-note", "No account was created for this demo."));
  replaceScreen(content);
  announce("Demo complete. You can join the Akademi waitlist or try another material.");
}

async function restoreOrStart() {
  renderLoading();
  void track("try_page_viewed", { experience: "exam_prep" });
  document.querySelectorAll("[data-conversion]").forEach((link) => {
    link.addEventListener("click", () => void track("demo_conversion_clicked", { placement: link.dataset.conversion }, { keepalive: true }));
  });
  const sessionId = savedSessionId();
  if (sessionId) {
    try {
      state.session = await api(`/demo/exam-prep/sessions/${encodeURIComponent(sessionId)}`);
      state.attempt = state.session.currentAttempt || null;
      state.selectedAnswer = state.attempt?.selectedAnswer || "";
      state.reasoning = state.attempt?.reasoning || "";
      if (state.session.isComplete) showConversion();
      else renderSession();
      return;
    } catch (error) {
      saveSessionId(null);
      if (error.code === "DEMO_SESSION_EXPIRED") state.error = error.message;
    }
  }
  await loadMaterials(Boolean(state.error));
}

void restoreOrStart();
