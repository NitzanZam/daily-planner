import React, { useState } from "react";
import DayPlanner from "./DayPlanner.jsx";
import ParentSettings from "./ParentSettings.jsx";
import PinGate from "./PinGate.jsx";
import { loadSettings, saveSettings } from "./settings.js";

/* ============================================================
   ניתוב בין שני המסכים. ברירת המחדל היא תמיד מסך הילד —
   הגדרות ההורה נמצאות מאחורי קוד.
   ============================================================ */

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [parentOpen, setParentOpen] = useState(false);
  // "unlock" = כניסה להגדרות, "change" = קביעת קוד חדש מתוך ההגדרות
  const [gate, setGate] = useState(null);

  const persist = (next) => setSettings(saveSettings(next));

  const openParent = () => {
    if (settings.pin) setGate("unlock");
    else setGate("change"); // אין קוד עדיין — קובעים אותו בכניסה הראשונה
  };

  const setPin = (pin) => {
    persist({ ...settings, pin });
    setGate(null);
    setParentOpen(true);
  };

  return (
    <>
      <DayPlanner settings={settings} onOpenParent={openParent} />

      {parentOpen && (
        <ParentSettings
          settings={settings}
          onSave={persist}
          onClose={() => setParentOpen(false)}
          onChangePin={() => setGate("change")}
        />
      )}

      {gate && (
        <PinGate
          pin={gate === "change" ? null : settings.pin}
          onUnlock={() => { setGate(null); setParentOpen(true); }}
          onSetPin={setPin}
          onCancel={() => setGate(null)}
        />
      )}
    </>
  );
}
