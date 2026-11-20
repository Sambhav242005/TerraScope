const byId = (id) => document.getElementById(id);
const video = byId("video");
const continuous = byId("continuous");
const editor = byId("editor");
const cueList = byId("cues");
const playButton = byId("play");
let cues = [];
let cueButtons = [];
let active = 0;
let highlighted = -1;
let waiting = false;
let ready = false;
let objectUrl;
let intendedSeek = null;
let seekInProgress = false;
let frame;
let loadedName = "terrascope-submission.mp4";

function validate(list) {
  if (!Array.isArray(list) || !list.length) throw new Error("Enter at least one cue.");
  let previousEnd = 0;
  return list.map(({ start, end, text }, index) => {
    const valid = Number.isFinite(start) && Number.isFinite(end) &&
      start >= previousEnd && end > start && typeof text === "string" && text.trim();
    if (!valid) throw new Error("Check cue " + (index + 1) + ": enter non-overlapping times and narration.");
    previousEnd = end;
    return { start, end, text: text.trim() };
  });
}

function clock(seconds) {
  const minutes = Math.floor(seconds / 60);
  const tail = (seconds % 60).toFixed(3).replace(/\.?0+$/, "");
  return minutes + ":" + tail.padStart(tail.includes(".") ? 4 : 2, "0");
}

function showCue(index) {
  if (index !== highlighted) {
    cueButtons[highlighted]?.removeAttribute("aria-current");
    const button = cueButtons[index];
    if (button) {
      button.setAttribute("aria-current", "true");
      const listBox = cueList.getBoundingClientRect();
      const cueBox = button.getBoundingClientRect();
      if (cueBox.top < listBox.top || cueBox.bottom > listBox.bottom) {
        cueList.scrollTop += cueBox.top - listBox.top - 4;
      }
    }
    highlighted = index;
  }
  byId("previous").disabled = !cues.length || active === 0;
  byId("repeat").disabled = !cues.length;
  byId("next").disabled = active >= cues.length - 1;
  playButton.disabled = !ready || waiting;
  let status = "Load or enter a cue list to begin.";
  if (cues.length && index < 0) status = "Between cues.";
  if (index >= 0) status = "Cue " + (index + 1) + " of " + cues.length + ".";
  if (waiting) {
    status += active < cues.length - 1 ? " Paused. Finish speaking, then choose Next." : " Final cue. Take your time finishing.";
  }
  const announcement = byId("cue-status");
  if (announcement.textContent !== status) announcement.textContent = status;
}

function seek(time) {
  const target = Math.min(time, video.duration);
  if (video.currentTime === target) return;
  intendedSeek = target;
  video.currentTime = target;
}

function playVideo() {
  if (!ready || waiting) return;
  video.play().catch((error) => {
    if (error.name !== "AbortError") byId("video-status").textContent = "Could not start video. Try the player controls or choose another file.";
  });
}

function selectCue(index, play = false) {
  if (!cues[index]) return;
  waiting = false;
  active = index;
  video.pause();
  showCue(index);
  if (!ready) return;
  seek(cues[index].start);
  if (play && cues[index].start < video.duration) playVideo();
}

function renderCues(list) {
  cues = list;
  highlighted = -1;
  cueButtons = cues.map((cue, index) => {
    const button = document.createElement("button");
    button.className = "cue";
    const time = document.createElement("time");
    time.textContent = clock(cue.start) + " – " + clock(cue.end);
    const narration = document.createElement("span");
    narration.textContent = cue.text;
    button.append(time, narration);
    button.addEventListener("click", () => selectCue(index, true));
    return button;
  });
  cueList.replaceChildren(...cueButtons.map((button) => {
    const item = document.createElement("li");
    item.append(button);
    return item;
  }));
  selectCue(0);
}

function syncContinuous() {
  const time = video.currentTime;
  const index = cues.findIndex((cue) => cue.start <= time && time < cue.end);
  if (index >= 0) active = index;
  else active = Math.max(0, cues.findLastIndex((cue) => cue.start <= time));
  showCue(index);
}

function checkBoundary() {
  if (!ready || video.seeking || seekInProgress || !cues.length) return;
  if (continuous.checked) {
    syncContinuous();
    return;
  }
  const boundary = Math.min(cues[active].end, video.duration);
  if (!waiting && video.currentTime >= boundary) {
    waiting = true;
    video.pause();
    seek(boundary);
    showCue(active);
  }
}

function trackPlayback() {
  checkBoundary();
  if (!video.paused) frame = requestAnimationFrame(trackPlayback);
}

function videoLoaded() {
  ready = Number.isFinite(video.duration) && video.duration > 0;
  if (!ready) return;
  selectCue(active);
  video.playbackRate = Number(byId("speed").value);
  const short = cues.at(-1)?.end > video.duration;
  byId("video-status").textContent = loadedName + " · " + clock(video.duration) +
    (short ? ". Some cue times extend beyond this video." : "");
  showCue(cues.length ? active : -1);
}

video.addEventListener("loadedmetadata", videoLoaded);
video.addEventListener("error", () => {
  ready = false;
  showCue(highlighted);
  byId("video-status").textContent = "Could not open " + loadedName + ". Choose a local video, or rehearse with the script controls alone.";
});
video.addEventListener("play", () => {
  if (waiting) {
    video.pause();
    seek(cues[active].end);
  } else {
    playButton.textContent = "Pause video";
    cancelAnimationFrame(frame);
    trackPlayback();
  }
});
video.addEventListener("pause", () => {
  cancelAnimationFrame(frame);
  playButton.textContent = "Play video";
});
video.addEventListener("seeking", () => {
  seekInProgress = true;
});
video.addEventListener("seeked", () => {
  seekInProgress = false;
  const ownSeek = intendedSeek !== null && Math.abs(video.currentTime - intendedSeek) < .01;
  intendedSeek = null;
  if (!cues.length) return;
  if (continuous.checked) syncContinuous();
  else if (!ownSeek && waiting) seek(cues[active].end);
  else if (!ownSeek) {
    const index = cues.findIndex((cue) => cue.start <= video.currentTime && video.currentTime < cue.end);
    if (index >= 0) {
      active = index;
      showCue(index);
    } else {
      const next = cues.findIndex((cue) => cue.start > video.currentTime);
      if (next >= 0) selectCue(next, !video.paused);
      else selectCue(cues.length - 1);
    }
  }
  checkBoundary();
});
video.addEventListener("timeupdate", checkBoundary);
video.addEventListener("ended", checkBoundary);
byId("file").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  ready = false;
  intendedSeek = null;
  seekInProgress = false;
  video.pause();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  loadedName = file.name;
  video.src = objectUrl;
  event.target.value = "";
  byId("video-status").textContent = "Opening " + loadedName + "…";
  showCue(highlighted);
});
byId("speed").addEventListener("change", (event) => {
  video.playbackRate = Number(event.target.value);
});
continuous.addEventListener("change", () => {
  if (!ready || !cues.length) return;
  if (continuous.checked) {
    waiting = false;
    syncContinuous();
  } else {
    selectCue(active, !video.paused);
  }
});
byId("previous").addEventListener("click", () => selectCue(active - 1, true));
byId("repeat").addEventListener("click", () => selectCue(active, true));
byId("next").addEventListener("click", () => selectCue(active + 1, true));
playButton.addEventListener("click", () => {
  if (video.paused) playVideo();
  else video.pause();
});
document.addEventListener("keydown", (event) => {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat ||
      event.target.closest("input, textarea, select, video, [contenteditable]")) return;
  const shortcut = { arrowleft: "previous", arrowright: "next", r: "repeat", p: "play" }[event.key.toLowerCase()];
  if (shortcut) {
    event.preventDefault();
    byId(shortcut).click();
  }
});

function download(name, content) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function applyEdits() {
  try {
    const edited = validate(JSON.parse(editor.value));
    if (ready) {
      const beyondVideo = edited.at(-1).end > video.duration;
      byId("edit-status").textContent = beyondVideo ? "Edits applied. Some cue times extend beyond this video." : "Edits applied.";
    } else {
      byId("edit-status").textContent = "Edits applied.";
    }
    renderCues(edited);
    return true;
  } catch (error) {
    byId("edit-status").textContent = "Cue list could not be applied. " + error.message;
    return false;
  }
}

byId("apply").addEventListener("click", applyEdits);
byId("download-cues").addEventListener("click", () => {
  if (applyEdits()) download("cues.js", "window.DEMO_CUES = " + JSON.stringify(cues, null, 2) + ";\n");
});

try {
  const initial = validate(window.DEMO_CUES);
  editor.value = JSON.stringify(initial, null, 2);
  renderCues(initial);
} catch {
  editor.value = "[]";
  showCue(-1);
  byId("edit-status").textContent = "Could not load valid cues.js. Enter a cue list here.";
}
if (video.readyState >= HTMLMediaElement.HAVE_METADATA) videoLoaded();
else if (video.error) video.dispatchEvent(new Event("error"));

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const micStart = byId("mic-start");
const micStop = byId("mic-stop");
const micStatus = byId("mic-status");
const finalText = byId("final");
const interimText = byId("interim");
const downloadTranscript = byId("download-transcript");
const completedSessions = [];
let recognition;
let sessionFinal = "";
let sessionInterim = "";

const displayTerms = [
  [/\b(?:terra[ -]?scope|teriscope|teroscope)\b/gi, "TerraScope"],
  [/\bembar[ck]o\b/gi, "Embarko"],
  [/\b(?:gandak|gund[au](?:ck|k))\b/gi, "Gandak"],
  [/\b(?:sone?pur|sone[ -](?:poor|pur)|son[ -]pur)\b/gi, "Sonepur"],
  [/\b(?:era[ -]?(?:5|five)|e[ .-]r[ .-]a\s+(?:5|five))\b/gi, "ERA5"],
  [/\b(?:glofas|glo[ -]fas|glow[ -](?:fass?|fast))\b/gi, "GLOFAS"],
  [/\b(?:dem|d[ .-]e[ .-]m)\b/gi, "DEM"],
];

const months = "January February March April May June July August September October November December";
const ordinalNames = ("first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth " +
  "thirteenth fourteenth fifteenth sixteenth seventeenth eighteenth nineteenth twentieth " +
  "twenty-first twenty-second twenty-third twenty-fourth twenty-fifth twenty-sixth twenty-seventh " +
  "twenty-eighth twenty-ninth thirtieth thirty-first").split(" ");
const ordinalPattern = ordinalNames.slice().reverse().join("|").replaceAll("-", "[ -]");
const dayPattern = "(?:[0-9]{1,2}(?:st|nd|rd|th)?|" + ordinalPattern + ")";
const monthPattern = "(?:" + months.replace("September", "September|Sept").replaceAll(" ", "|") + ")";
const monthFirst = new RegExp("\\b(" + monthPattern + ")\\s+(" + dayPattern + ")\\b", "gi");
const dayFirst = new RegExp("\\b(" + dayPattern + ")(?:\\s+of)?\\s+(" + monthPattern + ")\\b", "gi");

function displayDate(original, month, day) {
  const spelledDay = ordinalNames.indexOf(day.toLowerCase().replaceAll(" ", "-")) + 1;
  const value = spelledDay || Number.parseInt(day, 10);
  if (value < 1 || value > 31 || !Number.isInteger(value)) return original;
  if (spelledDay && /^(may|march)$/.test(month) && original.startsWith(month)) return original;
  const monthName = month.toLowerCase() === "sept" ? "September" : month[0].toUpperCase() + month.slice(1).toLowerCase();
  return value + " " + monthName;
}

const ones = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
const tens = "twenty thirty forty fifty sixty seventy eighty ninety".split(" ");
const numberWord = "(?:" + [...ones, ...tens, "hundred", "thousand", "million", "and", "point", "minus"].join("|") + ")";
const spokenNumber = "(?:" + numberWord + "[ -])+";
const digitNumber = "[+−-]?(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\\.[0-9]+)?";
const flowUnit = "(?:cubic[ -]met(?:er|re)s?\\s+per\\s+second|m\\s*[³3]\\s*/\\s*s)";
const flowValue = new RegExp("(?<![\\w,.+−-])(" + spokenNumber + "|" + digitNumber +
  "\\s*)(?=" + flowUnit + "\\b)", "gi");
const flowUnits = new RegExp("\\b" + flowUnit + "\\b", "gi");
const countBeforeNoun = new RegExp("\\b" + spokenNumber +
  "(?=(?:depressions?|candidates?|sites?|samples?|days?|weeks?|years?|hectares?|kilomet(?:re|er)s?|met(?:re|er)s?)\\b)", "gi");
// “First” and “second” also occur in ordinary prose. A date can still use either above.
const numberedOrdinal = new RegExp("\\b(?:" + ordinalNames.slice(3).reverse().join("|").replaceAll("-", "[ -]") + ")\\b", "gi");

function numberUnder100(words) {
  const first = ones.indexOf(words[0]);
  if (words.length === 1 && first >= 0) return first;
  const ten = tens.indexOf(words[0]);
  const unit = words.length === 2 ? ones.indexOf(words[1]) : 0;
  if (ten >= 0 && unit >= 0 && unit < 10 && words.length <= 2) return (ten + 2) * 10 + unit;
  return NaN;
}

function numberUnder1000(words) {
  if (words[1] !== "hundred") return numberUnder100(words);
  const hundred = ones.indexOf(words[0]);
  if (hundred < 1 || hundred > 9) return NaN;
  const tail = words.slice(words[2] === "and" ? 3 : 2);
  if (!tail.length && words.length > 2) return NaN;
  return hundred * 100 + (tail.length ? numberUnder100(tail) : 0);
}

function displayFlowValue(original) {
  const trimmed = original.trim();
  if (new RegExp("^" + digitNumber + "$").test(trimmed)) {
    const [whole, fraction] = trimmed.split(".");
    return whole.replace(/\B(?=(?:[0-9]{3})+(?![0-9]))/g, ",") +
      (fraction === undefined ? "" : "." + fraction) + " ";
  }
  const words = trimmed.toLowerCase().split(/[ -]+/);
  // This conjunction can join the value to earlier prose.
  const prefix = words[0] === "and" ? words.shift() + " " : "";
  const negative = words[0] === "minus" && words.shift();
  const point = words.indexOf("point");
  const whole = point < 0 ? words : words.slice(0, point);
  const fractional = point < 0 ? [] : words.slice(point + 1);
  if (point >= 0 && (!fractional.length || !fractional.every((word) => ones.indexOf(word) >= 0 && ones.indexOf(word) < 10))) return original;
  let value = 0;
  let remaining = whole;
  for (const [word, factor] of [["million", 1000000], ["thousand", 1000]]) {
    const index = remaining.indexOf(word);
    if (index < 0) continue;
    const group = numberUnder1000(remaining.slice(0, index));
    if (!Number.isFinite(group) || group === 0) return original;
    value += group * factor;
    remaining = remaining.slice(index + 1);
    if (remaining[0] === "and") {
      if (remaining.length === 1) return original;
      remaining = remaining.slice(1);
    }
  }
  value += remaining.length ? numberUnder1000(remaining) : 0;
  if (!whole.length || !Number.isFinite(value)) return original;
  const decimals = fractional.length ? "." + fractional.map((word) => ones.indexOf(word)).join("") : "";
  return prefix + (negative ? "-" : "") + value.toLocaleString("en-US") + decimals + " ";
}

function formatTranscript(text) {
  let formatted = text;
  for (const [variant, display] of displayTerms) formatted = formatted.replace(variant, display);
  return formatted.replace(monthFirst, displayDate)
    .replace(dayFirst, (original, day, month) => displayDate(original, month, day))
    .replace(flowValue, displayFlowValue)
    .replace(flowUnits, "m³/s")
    .replace(countBeforeNoun, displayFlowValue)
    .replace(numberedOrdinal, (word) => {
      const day = ordinalNames.indexOf(word.toLowerCase().replaceAll(" ", "-")) + 1;
      const suffix = ({ 21: "st", 22: "nd", 23: "rd", 31: "st" })[day] || "th";
      return day + suffix;
    });
}

function updateTranscript() {
  const final = [...completedSessions, sessionFinal].filter(Boolean).join("\n");
  finalText.textContent = final || "No final words yet.";
  interimText.textContent = sessionInterim || "No interim words.";
  downloadTranscript.disabled = !final;
}

if (!Recognition) {
  micStart.disabled = true;
  micStatus.textContent = "Live transcription is unavailable in this browser. Manual cue controls are ready.";
}

micStart.addEventListener("click", () => {
  if (!Recognition || recognition) return;
  try {
    const session = new Recognition();
    session.lang = "en-IN";
    session.interimResults = true;
    session.continuous = true;
    let failure = "";
    let stopping = false;
    session.onstart = () => {
      if (!stopping) micStatus.textContent = "Listening. Speak into your microphone.";
    };
    session.onresult = (event) => {
      const final = [];
      const interim = [];
      for (const result of Array.from(event.results)) {
        (result.isFinal ? final : interim).push(result[0].transcript.trim());
      }
      sessionFinal = formatTranscript(final.join(" "));
      sessionInterim = formatTranscript(interim.join(" "));
      updateTranscript();
    };
    session.onerror = (event) => {
      failure = "Recognition stopped (" + event.error + "). You can still pace with the cue controls.";
      micStatus.textContent = failure;
    };
    session.onend = () => {
      if (sessionFinal) completedSessions.push(sessionFinal);
      sessionFinal = "";
      sessionInterim = "";
      updateTranscript();
      recognition = undefined;
      micStart.disabled = false;
      micStop.disabled = true;
      micStatus.textContent = failure || "Microphone off. Choose Start listening to begin again.";
    };
    micStop.onclick = () => {
      stopping = true;
      micStop.disabled = true;
      micStatus.textContent = "Stopping and waiting for any final words…";
      session.stop();
    };
    session.start();
    recognition = session;
    micStart.disabled = true;
    micStop.disabled = false;
    micStatus.textContent = "Requesting microphone access…";
  } catch {
    micStatus.textContent = "Could not start live recognition. Manual cue controls are ready.";
  }
});
downloadTranscript.addEventListener("click", () => {
  const final = [...completedSessions, sessionFinal].filter(Boolean).join("\n");
  if (final) download("terrascope-rehearsal-transcript.txt", final + "\n");
});
