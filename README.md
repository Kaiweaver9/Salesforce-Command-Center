# LWC Command Center | Salesforce Health & Performance Dashboard

![Salesforce LWC Health & Performance Dashboard](./LWC%20Dashboard%20Blurred.png)

## Overview
A custom Salesforce application built on Developer Edition that centralizes real-time health, financial, and skill-building metrics into a unified dashboard. The project combines dynamic Lightning Web Components (LWCs), Apex backend controllers, and automated data pipelines to track daily performance.

---

## Key Modules & Interface

### 1. Top Ticker Bar
* **Live Metrics**: Displays current bank balance, net worth, current weight, and daily target calories.
* **Trajectory Indicators**: Shows real-time direction to see if daily metrics are working toward or drifting away from long-term targets.

### 2. Main Analytics & Interactive Charting
* **Time Horizons**: Toggle views across 7-day, 30-day, and Year-To-Date (YTD) windows.
* **Metric Selector**: Interactive dropdowns to isolate and review specific trends over time (Weight, Body Fat %, TDEE, Calories, Macronutrients as well as Financial targets).

### 3. Health Intelligence Node
* **Automated Data Ingestion**: Pulls daily biometric inputs via external API pipelines (Google Health Connect / Apps Script to Salesforce Custom Objects).
* **TDEE & Macro Engine**: Calculates rolling TDEE averages and daily target calories to drive precise weekly weight velocity.

### 4. Goals & Performance Index
* **Goal Swapping**: Arrow tab navigation to cycle through active health and financial goals.
* **Unified Performance Score**: A single daily execution percentage combining health, daily effort, and financial performance.
* **Trailhead Tracking**: Tracks Salesforce Trailhead velocity, points, and milestone progress.

---

## Tech Stack & Data Architecture

* **Frontend**: Custom Lightning Web Components (LWC), Chart.js integration, CSS layout.
* **Backend**: Apex Controllers, custom SOQL queries, REST API endpoints.
* **Data Model**: 11 Custom Objects, validation rules, formula fields, and roll-up summary fields.
* **Automation & Tools**: Google Apps Script ETL pipelines, Salesforce DX CLI, VS Code, Git/GitHub.

---

## Local Setup & Deployment

1. **Clone the repository**:
   ```bash
   git clone [https://github.com/Kaiweaver9/Salesforce-command-center.git](https://github.com/Kaiweaver9/Salesforce-command-center.git)
