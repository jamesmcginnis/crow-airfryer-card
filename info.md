# 🍟 Crow Airfryer Card

A liquid-glass [Home Assistant](https://www.home-assistant.io/) card for air fryers. It has four layouts (Glass Dial, Live Activity, Tile and Timer), shows progress for each phase from heating through to the cook-time countdown, can detect when cooking has finished from a power sensor, can switch a smart plug, and has optional AI features. Everything can be set up without writing any YAML.

---

> ✨ **AI features are optional.** Nothing AI-powered runs until you turn on AI features and choose a conversation agent in the editor (see [AI Features Setup](#-ai-features-setup-optional) below). Without an agent, the card works fully as a cooking monitor and none of the core features depend on it.

> ⚠️ **Only tested with the [VeSync](https://www.home-assistant.io/integrations/vesync/) integration.** Other air fryer integrations may work, but they haven't been tested.

---

## ✨ Features

### Cooking progress
- **Progress by phase.**
  - **Heating** fills the ring as the current temperature climbs towards the set temperature.
  - **Cooking** counts down the cook time.
- **Clear status** for every phase: Heating, Cooking, Paused, Done, Idle, Offline and Error. The fryer's own status wording is matched loosely, so variations such as "cookStop" and "cookComplete" still land in the right phase.
- **Finish detection.**
  - If you add a **power sensor**, the card treats cooking as finished once it has seen the fryer heating (at least 50 W) and the draw then stays below 5 W. The countdown stops even if the status sensor is slow to update.
  - Without a power sensor, if the countdown has run out but the status still says cooking, the card shows **Done** after a short grace period instead of leaving "Finishing…" up.
- **Temperature unit.** Auto uses the sensor's own unit, or you can force °C or °F.
- **Entities are detected automatically.** Sensors that look right are marked ★ in the editor.

### Smart plug control (optional)
- Tap the status capsule or icon to switch the fryer's smart plug on or off. You're always asked to confirm first, and you get a stronger warning if it's still cooking.
- Works with switches and input booleans.

### Layouts
| Layout | Shape | Best for |
|---|---|---|
| **Glass Dial** | Square, progress ring, with the name, status and Air/Set temperatures in the corners | A main kitchen card |
| **Live Activity** | One-row pill | Headers and narrow columns |
| **Tile** | Compact 2:1 widget that fills as it cooks | Sections-view grids |
| **Timer** | Square with a big countdown | Wall tablets, or seeing it from across the room |

### Appearance
- **Liquid-glass design** with a **Glass** slider that runs from clear to frosted.
- **Theme**: Auto (follows Home Assistant), Light or Dark.
- **Size**: Compact, or Regular (about 20% larger).
- **Phase colours** for Heating, Cooking, Done, Paused and, optionally, Idle (neutral grey unless you pick one). Colours are adjusted automatically so they stay readable in both light and dark themes, and each has a light and dark preview swatch.
- **Colour presets**: Ember (the default), Ocean, Berry and Graphite. Pick one with a single tap, then fine-tune any colour.
- **Animations**:
  - **Subtle** animates only what matters.
  - **Full** also makes the ring breathe while cooking, pulses the tick when it's done and blinks the time while paused.
  - **Off** turns animations off.
  - **System** is Subtle, but stays still if your device's Reduce Motion setting is on.

### Details popup
Shows the status, current and set temperature, cook and preheat time, power draw, smart plug state, when it last changed and updated, and which entity each value comes from.

### AI features (optional)
You need a Home Assistant conversation agent. When AI is on, **tap the card** for the assistant, or **long-press** it for the actions sheet:
- **Tap assistant** gives a one-line read-out of what the fryer is doing, with a sensible next step.
- **Ask AI** lets you type your own question about the fryer.
- **What happened?** shows the latest run as a timeline with notes, plus a short summary.
- **This week** shows runs, total cook time, the longest run and the busiest day over the last 7 days. If a power sensor is set, it also shows energy used this week and on the last run. A short summary is included.
- **Details** is always in the actions sheet too.

Each feature has its own toggle in the editor. The assistant only sees this fryer's entities and their history, plus any extra appliances you list in `ai_related_entities`. Nothing is sent until you open a sheet, and answers are cached.

---

## Configuration

Add the card from the card picker and the editor finds your fryer's sensors for you. Everything is set up in the built-in visual editor, so you don't need any YAML. The README has the full list of YAML options, the interactions table, and details on finish detection.

---

## 🤖 AI Features Setup (Optional)

AI features stay off until you turn them on and choose a conversation agent. **Google Gemini** is the recommended and best-tested agent:

### Step 1 — Enable the Generative Language API

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in
2. Create a new project (or select an existing one)
3. Go to **APIs & Services → Library**
4. Search for **Generative Language API** and click **Enable**

> ⚠️ This step is essential. An API key without the Generative Language API enabled will return errors immediately.

### Step 2 — Create an API Key

1. In Google Cloud Console go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → API key** and copy the key

### Step 3 — Add Google Generative AI to Home Assistant

1. In Home Assistant go to **Settings → Devices & Services → + Add Integration**
2. Search for **Google Generative AI** and select it
3. Paste your API key and click Submit
4. The recommended model settings work fine. If you pick a model yourself, choose a **current Flash model**. Google retires older models regularly; `gemini-2.0-flash` was shut down in June 2026.

### Step 4 — Configure the Card

In the card's visual editor, open **AI Features**, turn on **Enable AI features**, and choose your Google AI agent under **Conversation agent**.

### Rate limits

Free-tier limits vary by model and change over time, so check Google AI Studio for your current quota. The card only calls the agent when you open an AI sheet or ask a question, and it caches answers, so you're unlikely to reach the limit in normal use. If you do see a quota message, it resets the next day.

---

## 🧩 Supported Integrations

Built for air fryers from the [VeSync](https://www.home-assistant.io/integrations/vesync/) integration, which is built into Home Assistant. It also works with any setup that provides a cooking-status sensor, even with none of the optional entities. Power sensors and smart plugs can come from any integration.

### Recognised status words

Matched loosely, so variations still work: `heating` / `preheating` → Heating · `cooking` → Cooking · `paused` → Paused · `stop` / `complete` / `done` / `finish` / `end` → Done · `standby` / `idle` / `off` / `ready` → Idle · `error` / `fault` / `fail` → Error · `unavailable` / `unknown` → Offline
