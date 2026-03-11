# REIT Lens: Alethia Design System

The "Alethia" aesthetic is a synthesis of editorial prestige and technical precision. It is designed to feel like a "crafted" institutional terminal.

## 1. Color Palette

### Core Neutrals
*   **Obsidian (`#010409`):** The primary canvas. Deep, non-pure black to reduce eye strain.
*   **Slate-900/800:** Used for secondary containers and card backgrounds.
*   **Rain (`#5F9AAE`):** The structural "muted" color. Used for borders, labels, and secondary text.

### Brand Accents
*   **Light Blue (`#48A3CC`):** Primary action color. Used for buttons, active tabs, and highlights.
*   **Gold (`#D4AF37`):** The "Prestige" accent. Used for valuation metrics, NAV, and "Institutional" badges.
*   **Pumpkin (`#FF9D3C`):** The "Growth" accent. Used for positive deltas, acquisition volume, and alerts.

---

## 2. Typography

### Editorial (Serif)
*   **Font:** `Playfair Display`
*   **Usage:** Page titles, high-level summary headers, and "Analyst Memo" titles.
*   **Vibe:** Authoritative, classic, trustworthy.

### Functional (Sans-Serif)
*   **Font:** `Plus Jakarta Sans`
*   **Usage:** General UI, navigation, form labels, and body text.
*   **Vibe:** Modern, clean, highly legible.

### Technical (Monospace)
*   **Font:** `JetBrains Mono`
*   **Usage:** All quantitative data, ticker symbols, percentages, and formulas.
*   **Vibe:** Precise, raw, data-driven.

---

## 3. Component Patterns

### The "Aegis" Card
*   **Background:** `linear-gradient(135deg, rgba(2, 45, 91, 0.5) 0%, rgba(1, 4, 9, 0.8) 100%)`
*   **Border:** `1px solid rgba(95, 154, 174, 0.2)`
*   **Backdrop:** `blur(24px)`
*   **Hover:** Border-color shifts to `Light Blue`, subtle outer glow.

### "Gold Braiding" Rules
*   **What it is:** A decorative corner accent used to signal "Institutional Quality" or "Premium Data."
*   **Implementation:** Use `::before` and `::after` pseudo-elements on cards.
*   **Top-Left:** 2px solid `Pumpkin`.
*   **Bottom-Right:** 2px solid `Light Blue`.
*   **Usage:** Only on primary summary cards or the "Analyst Memo" section.

---

## 4. Visual Hierarchy
1.  **Level 1 (The Hero):** Large Serif headers with high contrast.
2.  **Level 2 (The Metric):** Large Monospace numbers with specific color coding (Gold for Value, Pumpkin for Growth).
3.  **Level 3 (The Label):** Small, uppercase, tracking-wide Sans-Serif labels in `Rain`.
4.  **Level 4 (The Detail):** Muted italics for "Variant Perception" notes or data sources.
