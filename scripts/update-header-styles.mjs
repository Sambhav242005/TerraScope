import fs from 'node:fs';

const cssPath = 'src/style.css';
let content = fs.readFileSync(cssPath, 'utf8');

const newStyles = `/* One command row, with expanded controls flowing below it. */
.workspace-commandbar {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
  background: #fbfcf9;
  border-bottom: 1px solid #e1e7dc;
  padding: 0 16px;
  height: 40px;
  min-height: 40px;
  overflow-x: auto;
  overflow-y: visible;
  scrollbar-width: none;
  max-width: 100vw;
  box-sizing: border-box;
}
.workspace-commandbar .workspace-disclosure {
  border: 0;
  display: inline-flex;
  align-items: center;
  margin: 0;
  flex-shrink: 0;
}
.workspace-commandbar .workspace-disclosure > summary {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  color: #375647;
  cursor: pointer;
  border-radius: 4px;
  list-style: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  user-select: none;
  white-space: nowrap;
}
.workspace-commandbar .workspace-disclosure > summary::-webkit-details-marker {
  display: none;
}
.workspace-commandbar .workspace-disclosure[open] {
  flex-basis: auto;
  order: unset;
}
.workspace-commandbar .placement-bar {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  border: 0;
  background: transparent;
  flex-shrink: 0;
}
.workspace-commandbar .placement-bar .placement-label {
  display: none;
}
.workspace-commandbar .placement-btn {
  height: 28px;
  padding: 0 9px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 5px;
  border: 1px solid #d4ded0;
  background: #ffffff;
  color: #2e4d41;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}
.workspace-commandbar .placement-btn:hover {
  background: #f1f7ee;
  border-color: #b8c9b3;
}
.workspace-commandbar .placement-btn.active {
  background: #255a43;
  color: #ffffff;
  border-color: #255a43;
}
.workspace-commandbar .placement-btn.basin.active {
  background: #176f82;
  border-color: #176f82;
}
.workspace-commandbar .placement-btn.solar.active {
  background: #996e1b;
  border-color: #996e1b;
}
.workspace-commandbar .placement-btn.wind.active {
  background: #26718a;
  border-color: #26718a;
}
.workspace-commandbar .placement-btn.vegetation.active {
  background: #286b43;
  border-color: #286b43;
}
.workspace-commandbar .placement-summary {
  font-size: 10px;
  color: #72877c;
  margin-left: 6px;
  white-space: nowrap;
}
.workspace-commandbar .search-disclosure {
  position: relative;
}
.workspace-commandbar .search-disclosure .place-search {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 1000;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #d5ded0;
  border-radius: 6px;
  padding: 12px 14px;
  min-width: 320px;
}
.workspace-commandbar .proposal-controls {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.workspace-commandbar .proposal-controls button,
.workspace-commandbar .proposal-controls details > summary {
  height: 28px;
  padding: 0 10px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid #d4ded0;
  background: #ffffff;
  border-radius: 5px;
  color: #3b584a;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  white-space: nowrap;
  list-style: none;
}
.workspace-commandbar .proposal-controls details {
  position: relative;
}
.workspace-commandbar .proposal-controls .proposal-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 1000;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border: 1px solid #d5ded0;
  border-radius: 6px;
  padding: 8px;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.workspace-commandbar .proposal-controls .proposal-dropdown button {
  position: static;
  width: 100%;
  text-align: left;
  justify-content: flex-start;
  white-space: normal;
  height: auto;
  min-height: 28px;
  padding: 6px 8px;
}
.app-shell .brand-sub { display:none; }
.world-mode .world-canvas { height:calc(100dvh - 175px); min-height:540px; }

@media(min-width:761px) { .world-mode .world-canvas { max-height:650px; } }

/* Unified clean topbar */
.app-shell .topbar {
  min-height: 52px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  background: #ffffff;
  border-bottom: 1px solid #e1e7de;
  max-width: 100vw;
  box-sizing: border-box;
}
@media (min-width: 1100px) {
  .app-shell .topbar {
    height: 52px;
    flex-wrap: nowrap;
  }
}
.app-shell .topbar .brand {
  height: 48px;
  padding: 0;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.6px;
  color: #1a4d3b;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.app-shell .topbar .brand-symbol svg {
  width: 22px;
  height: 22px;
  color: #2b7055;
}
.app-shell .topbar nav {
  height: 36px;
  gap: 2px;
  background: #edf3ec;
  padding: 2px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.app-shell .topbar nav button {
  font-size: 11px;
  font-weight: 500;
  padding: 0 10px;
  height: 32px;
  border-radius: 6px;
  border: 0;
  color: #4b6659;
  display: flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.app-shell .topbar nav button[aria-current="page"] {
  background: #ffffff;
  color: #174b37;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.app-shell .topbar .casebar {
  order: unset;
  flex: 0 0 auto;
  height: auto;
  min-height: unset;
  padding: 0;
  gap: 10px;
  display: flex;
  align-items: center;
  border: 0;
  background: transparent;
  font-size: 11px;
}
.app-shell .topbar .casebar > div {
  display: flex;
  align-items: center;
  gap: 6px;
}
.app-shell .topbar .casebar .live-dot {
  width: 7px;
  height: 7px;
  background: #38a169;
}
.app-shell .topbar .casebar strong {
  font-weight: 600;
  color: #2d453b;
}
.app-shell .topbar .casebar .case-location {
  color: #798a80;
  padding-left: 6px;
  border-left: 1px solid #dbe2d9;
}
.app-shell .topbar .casebar .enso-badge {
  padding: 3px 8px;
  border-radius: 12px;
  background: #f0f4ee;
  border: 1px solid #dbe3d8;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.app-shell .topbar .casebar .enso-sub {
  color: #6a7c73;
  font-size: 10px;
}
.app-shell .topbar .casebar .mode-pill {
  padding: 2px 7px;
  font-size: 10px;
  border-radius: 4px;
  background: #f1f6ed;
  border: 1px solid #d4ded0;
  color: #3b5f46;
}
.app-shell .topbar .casebar .case-date {
  font-size: 10px;
  color: #798b82;
}
.app-shell .topbar .source-top {
  height: 32px;
  min-height: 32px;
  padding: 0 10px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid #d5dfd2;
  background: #ffffff;
  color: #3b5a4c;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  flex-shrink: 0;
}
.app-shell .topbar .source-top:hover {
  background: #f2f7ef;
}
.app-shell .topbar .guide-top-btn {
  height: 32px;
  padding: 0 10px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid #b7dcbe;
  background: #eaf6ec;
  color: #1a5638;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  flex-shrink: 0;
}
.app-shell .topbar .guide-top-btn:hover {
  background: #d8eedb;
}
.app-shell .workspace {
  height: calc(100dvh - 92px);
}

@media(max-width:760px) {
  html, body {
    overflow-x: hidden;
    width: 100%;
    max-width: 100vw;
  }
  .app-shell {
    overflow-x: hidden;
    width: 100%;
    max-width: 100vw;
  }
  .app-shell .topbar {
    height: auto;
    min-height: unset;
    padding: 8px 12px;
    flex-wrap: wrap;
    gap: 8px;
    overflow: hidden;
    width: 100%;
    max-width: 100vw;
    box-sizing: border-box;
  }
  .app-shell .topbar nav {
    order: 3;
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
    display: flex;
    justify-content: flex-start;
  }
  .app-shell .topbar nav button {
    font-size: 10px;
    padding: 0 8px;
    flex-shrink: 0;
  }
  .app-shell .topbar .casebar {
    order: 2;
    width: 100%;
    max-width: 100%;
    overflow: hidden;
    flex-wrap: wrap;
    font-size: 10px;
    gap: 6px;
  }
  .workspace-commandbar {
    width: 100%;
    max-width: 100vw;
    box-sizing: border-box;
    overflow-x: auto;
    scrollbar-width: none;
    display: flex;
    flex-wrap: nowrap;
  }
  .workspace-commandbar .proposal-controls {
    margin-left: 0;
    flex-shrink: 0;
  }
  .world-mode .world-canvas {
    height: calc(100dvh - 180px);
    min-height: 700px;
  }
}

/* User Guide modal styles */
.guide-content {
  max-width: 680px;
  max-height: 80vh;
  overflow-y: auto;
  padding: 8px 4px;
}
.guide-lead {
  font-size: 13px;
  line-height: 1.6;
  color: #436257;
  margin: 6px 0 18px;
}
.guide-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}
@media (max-width: 640px) {
  .guide-grid { grid-template-columns: 1fr; }
}
.guide-card {
  padding: 12px 14px;
  background: #f6f9f5;
  border: 1px solid #dae4d8;
  border-radius: 8px;
}
.guide-card-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}
.guide-card-icon.water { background: #e0f2f5; color: #176f82; }
.guide-card-icon.wave { background: #e3edf6; color: #22649a; }
.guide-card-icon.rain { background: #e4f3ed; color: #256a47; }
.guide-card-icon.plan { background: #fbf0dc; color: #94691e; }
.guide-card h3 {
  font-size: 12px;
  font-weight: 650;
  color: #1d3e31;
  margin: 0 0 4px;
}
.guide-card p {
  font-size: 11px;
  line-height: 1.55;
  color: #557268;
  margin: 0;
}
.guide-glossary {
  background: #ffffff;
  border: 1px solid #dbe4d8;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 18px;
}
.guide-glossary h4 {
  font-size: 12px;
  font-weight: 650;
  color: #204033;
  margin: 0 0 8px;
}
.guide-glossary ul {
  margin: 0;
  padding-left: 18px;
  font-size: 11px;
  line-height: 1.7;
  color: #4f685f;
}
.guide-dismiss-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px;
  font-size: 12px;
  font-weight: 600;
  background: #255a43;
  color: #ffffff;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}
.guide-dismiss-btn:hover {
  background: #1c4735;
}
.candidate-detail {
  margin-top: 10px;
  padding: 12px;
  background: #fff;
  border: 1px solid #d5e4e7;
  border-radius: 5px;
  max-height: 520px;
  overflow-y: auto;
}
.adopt-candidate-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  margin-top: 12px;
  padding: 9px 12px;
  font-size: 11px;
  font-weight: 600;
  color: #ffffff;
  background: #1d7b87;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
}
.adopt-candidate-btn:hover {
  background: #15626c;
}
`;

const startMarker = '/* One command row, with expanded controls flowing below it. */';
const endMarker = '.candidate-detail {';

const startIndex = content.indexOf(startMarker);
if (startIndex === -1) {
  console.error('startMarker not found');
  process.exit(1);
}

// Find candidate-detail or the end of the section
let endIndex = content.indexOf(endMarker, startIndex);
if (endIndex === -1) {
  endIndex = content.indexOf('height: calc(100dvh - 92px);', startIndex);
  if (endIndex === -1) {
    endIndex = content.indexOf('height: calc(100dvh - 284px);', startIndex);
  }
  const closingBrace = content.indexOf('}', endIndex);
  endIndex = closingBrace + 1;
}

const before = content.slice(0, startIndex);
const after = content.slice(endIndex);

const updatedContent = before + newStyles + after;
fs.writeFileSync(cssPath, updatedContent, 'utf8');
console.log('Successfully updated src/style.css with responsive rules');
