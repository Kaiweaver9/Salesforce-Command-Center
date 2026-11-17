import { LightningElement, wire } from 'lwc';
import getDashboardMetrics from '@salesforce/apex/DashboardController.getDashboardMetrics';
import getHealthHistory from '@salesforce/apex/DashboardController.getHealthHistory';

const RING_RADIUS = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default class HealthHub extends LightningElement {
    activeSlide = 0;

    // Dashboard Metrics
    currentBodyWeight = 0;
    caloriesConsumed = 0;
    targetCalories = 2500;
    proteinGrams = 0;
    carbsGrams = 0;
    fatGrams = 0;
    rollingTdee = 0;
    weeklyVelocity = 0;
    currentPhase = 'maintenance';
    clinicalStatus = 'OPTIMAL';
    statusColor = 'optimal';

    // Interactive States
    hoveredMacro = null;
    selectedBarIndex = null;

    // Historical Health Logs
    healthHistory = [];

    getLocalTodayString() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    @wire(getDashboardMetrics)
    wiredMetrics({ error, data }) {
        if (data) {
            this.currentBodyWeight = data.currentBodyWeight != null ? Number(data.currentBodyWeight) : 0;
            this.caloriesConsumed = Math.round(data.caloriesConsumed || 0);
            this.targetCalories = Math.round(data.targetCalories || data.recommendedCalories || 2500);
            this.proteinGrams = Math.round(data.proteinGrams || 0);
            this.carbsGrams = Math.round(data.carbsGrams || 0);
            this.fatGrams = Math.round(data.fatGrams || 0);
            this.rollingTdee = Math.round(data.rollingTdee || 0);
            this.weeklyVelocity = data.weeklyVelocity != null ? Number(data.weeklyVelocity) : 0;
            this.currentPhase = (data.currentPhase || 'maintenance').toLowerCase();
            this.clinicalStatus = (data.clinicalStatus || this.deriveFallbackStatus()).toUpperCase();
            this.statusColor = (data.statusColor || this.clinicalStatus.toLowerCase()).toLowerCase();
        } else if (error) {
            console.error('healthHub wiredMetrics error:', error);
        }
    }

    @wire(getHealthHistory)
    wiredHistory({ error, data }) {
        if (data) {
            const todayStr = this.getLocalTodayString();
            this.healthHistory = data.filter(item => item.Entry_Date__c && item.Entry_Date__c <= todayStr);
        } else if (error) {
            console.error('healthHub wiredHistory error:', error);
        }
    }

    deriveFallbackStatus() {
        const p = this.currentPhase;
        const v = this.weeklyVelocity;
        if (p === 'cutting' || p === 'mini-cut' || p === 'minicut') {
            if (v < -2.2) return 'DANGER';
            if (v < -1.6) return 'CAUTION';
            if (v > -0.25) return 'STALLED';
            return 'OPTIMAL';
        }
        if (p === 'bulking') {
            if (v > 1.25) return 'CAUTION';
            if (v < 0.1) return 'STALLED';
            return 'OPTIMAL';
        }
        if (p === 'reverse') return 'RECOVERY';
        return Math.abs(v) <= 0.6 ? 'OPTIMAL' : 'CAUTION';
    }

    /* --- HEADER & NAVIGATION --- */
    get activeSlideTitle() {
        if (this.activeSlide === 0) return 'DAILY MACROS';
        if (this.activeSlide === 1) return 'MACRO TRENDS';
        return 'BODY COMP';
    }

    get statusBadgeClass() {
        return `status-badge status-${this.statusColor}`;
    }

    get isSlideOne() {
        return this.activeSlide === 0;
    }

    get isSlideTwo() {
        return this.activeSlide === 1;
    }

    get isSlideThree() {
        return this.activeSlide === 2;
    }

    get dot0Class() {
        return this.activeSlide === 0 ? 'dot active' : 'dot';
    }

    get dot1Class() {
        return this.activeSlide === 1 ? 'dot active' : 'dot';
    }

    get dot2Class() {
        return this.activeSlide === 2 ? 'dot active' : 'dot';
    }

    handlePrevSlide() {
        this.selectedBarIndex = null;
        this.hoveredMacro = null;
        this.activeSlide = (this.activeSlide + 2) % 3;
    }

    handleNextSlide() {
        this.selectedBarIndex = null;
        this.hoveredMacro = null;
        this.activeSlide = (this.activeSlide + 1) % 3;
    }

    handleDotClick(event) {
        this.selectedBarIndex = null;
        this.hoveredMacro = null;
        this.activeSlide = parseInt(event.currentTarget.dataset.slide, 10);
    }

    handleNavigateHealth() {
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { view: 'health' },
            bubbles: true,
            composed: true
        }));
    }

    /* --- SLIDE 1: MACRO TARGETS (30P / 45C / 25F) & SVG SPLIT BAR --- */
    get targetProteinGrams() {
        return Math.round((this.targetCalories * 0.30) / 4);
    }

    get targetCarbsGrams() {
        return Math.round((this.targetCalories * 0.45) / 4);
    }

    get targetFatGrams() {
        return Math.round((this.targetCalories * 0.25) / 9);
    }

    get totalMacroCalories() {
        const cal = (this.proteinGrams * 4) + (this.carbsGrams * 4) + (this.fatGrams * 9);
        return cal > 0 ? cal : 1;
    }

    get actualProteinPct() {
        if (this.proteinGrams === 0 && this.carbsGrams === 0 && this.fatGrams === 0) return 0;
        return Math.round(((this.proteinGrams * 4) / this.totalMacroCalories) * 100);
    }

    get actualCarbsPct() {
        if (this.proteinGrams === 0 && this.carbsGrams === 0 && this.fatGrams === 0) return 0;
        return Math.round(((this.carbsGrams * 4) / this.totalMacroCalories) * 100);
    }

    get actualFatPct() {
        if (this.proteinGrams === 0 && this.carbsGrams === 0 && this.fatGrams === 0) return 0;
        return Math.max(0, 100 - this.actualProteinPct - this.actualCarbsPct);
    }

    get svgProteinWidth() {
        const pct = (this.proteinGrams === 0 && this.carbsGrams === 0 && this.fatGrams === 0) ? 30 : this.actualProteinPct;
        return Math.round((pct / 100) * 300);
    }

    get svgCarbsX() {
        return this.svgProteinWidth;
    }

    get svgCarbsWidth() {
        const pct = (this.proteinGrams === 0 && this.carbsGrams === 0 && this.fatGrams === 0) ? 45 : this.actualCarbsPct;
        return Math.round((pct / 100) * 300);
    }

    get svgFatX() {
        return this.svgProteinWidth + this.svgCarbsWidth;
    }

    get svgFatWidth() {
        return Math.max(0, 300 - this.svgFatX);
    }

    formatMacroDelta(actual, target) {
        const diff = actual - target;
        return diff >= 0 ? `+${diff}g` : `${diff}g`;
    }

    get macroProteinDeltaLabel() {
        return this.formatMacroDelta(this.proteinGrams, this.targetProteinGrams);
    }

    get macroCarbsDeltaLabel() {
        return this.formatMacroDelta(this.carbsGrams, this.targetCarbsGrams);
    }

    get macroFatDeltaLabel() {
        return this.formatMacroDelta(this.fatGrams, this.targetFatGrams);
    }

    get macroProteinDeltaClass() {
        return this.proteinGrams >= this.targetProteinGrams ? 'delta-pill positive' : 'delta-pill neutral';
    }

    get macroCarbsDeltaClass() {
        return Math.abs(this.carbsGrams - this.targetCarbsGrams) <= 20 ? 'delta-pill positive' : 'delta-pill neutral';
    }

    get macroFatDeltaClass() {
        return Math.abs(this.fatGrams - this.targetFatGrams) <= 10 ? 'delta-pill positive' : 'delta-pill neutral';
    }

    // SVG Ring Segments
    get proteinArcLength() {
        const pct = (this.proteinGrams === 0 && this.carbsGrams === 0 && this.fatGrams === 0) ? 0.30 : (this.actualProteinPct / 100);
        return Math.max(0, pct * RING_CIRCUMFERENCE - 3);
    }

    get carbsArcLength() {
        const pct = (this.proteinGrams === 0 && this.carbsGrams === 0 && this.fatGrams === 0) ? 0.45 : (this.actualCarbsPct / 100);
        return Math.max(0, pct * RING_CIRCUMFERENCE - 3);
    }

    get fatArcLength() {
        const pct = (this.proteinGrams === 0 && this.carbsGrams === 0 && this.fatGrams === 0) ? 0.25 : (this.actualFatPct / 100);
        return Math.max(0, pct * RING_CIRCUMFERENCE - 3);
    }

    get proteinDashArray() {
        return `${this.proteinArcLength} ${RING_CIRCUMFERENCE}`;
    }

    get proteinDashOffset() {
        return 0;
    }

    get carbsDashArray() {
        return `${this.carbsArcLength} ${RING_CIRCUMFERENCE}`;
    }

    get carbsDashOffset() {
        return -(this.proteinArcLength + 3);
    }

    get fatDashArray() {
        return `${this.fatArcLength} ${RING_CIRCUMFERENCE}`;
    }

    get fatDashOffset() {
        return -(this.proteinArcLength + this.carbsArcLength + 6);
    }

    get proteinArcClass() {
        return `ring-segment protein-stroke ${this.hoveredMacro === 'PROTEIN' ? 'is-highlighted' : ''}`;
    }

    get carbsArcClass() {
        return `ring-segment carbs-stroke ${this.hoveredMacro === 'CARBS' ? 'is-highlighted' : ''}`;
    }

    get fatArcClass() {
        return `ring-segment fat-stroke ${this.hoveredMacro === 'FAT' ? 'is-highlighted' : ''}`;
    }

    get ringCenterPrimary() {
        if (this.hoveredMacro === 'PROTEIN') return `${this.proteinGrams}g`;
        if (this.hoveredMacro === 'CARBS') return `${this.carbsGrams}g`;
        if (this.hoveredMacro === 'FAT') return `${this.fatGrams}g`;
        return this.caloriesConsumed.toLocaleString();
    }

    get ringCenterSecondary() {
        if (this.hoveredMacro === 'PROTEIN') return `OF ${this.targetProteinGrams}G · ${this.actualProteinPct}%`;
        if (this.hoveredMacro === 'CARBS') return `OF ${this.targetCarbsGrams}G · ${this.actualCarbsPct}%`;
        if (this.hoveredMacro === 'FAT') return `OF ${this.targetFatGrams}G · ${this.actualFatPct}%`;
        return `/ ${this.targetCalories.toLocaleString()} KCAL`;
    }

    handleMacroHover(event) {
        this.hoveredMacro = event.currentTarget.dataset.macro;
    }

    handleMacroLeave() {
        this.hoveredMacro = null;
    }

    handleMacroTap(event) {
        const macro = event.currentTarget.dataset.macro;
        this.hoveredMacro = this.hoveredMacro === macro ? null : macro;
    }

    /* --- SLIDE 2: 7-DAY MACRO SPLITS --- */
    get recentSevenMacroDays() {
        const valid = this.healthHistory.filter(h => (h.Protein_g__c || 0) + (h.Carbs_g__c || 0) + (h.Fat_g__c || 0) > 0);
        return valid.slice(Math.max(valid.length - 7, 0));
    }

    get sevenDayBars() {
        return this.recentSevenMacroDays.map((day, idx) => {
            const p = Number(day.Protein_g__c || 0);
            const c = Number(day.Carbs_g__c || 0);
            const f = Number(day.Fat_g__c || 0);
            const totalCal = Math.max(1, (p * 4) + (c * 4) + (f * 9));

            const pPct = Math.round(((p * 4) / totalCal) * 100);
            const cPct = Math.round(((c * 4) / totalCal) * 100);
            const fPct = Math.max(0, 100 - pPct - cPct);

            const carbsHeight = cPct;
            const fatY = cPct;
            const fatHeight = fPct;
            const proteinY = cPct + fPct;
            const proteinHeight = Math.max(0, 100 - proteinY);

            const parts = day.Entry_Date__c.split('-');
            const dt = new Date(parts[0], parts[1] - 1, parts[2]);
            const dayNum = String(dt.getDate());
            const fullDate = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();

            const isSelected = this.selectedBarIndex === idx;
            const isDimmed = this.selectedBarIndex !== null && !isSelected;

            return {
                index: idx,
                dateKey: day.Entry_Date__c,
                dayLabel: dayNum,
                fullDateLabel: fullDate,
                proteinGrams: Math.round(p),
                carbsGrams: Math.round(c),
                fatGrams: Math.round(f),
                proteinPct: pPct,
                carbsPct: cPct,
                fatPct: fPct,
                carbsHeight,
                fatY,
                fatHeight,
                proteinY,
                proteinHeight,
                wrapperClass: `bar-item ${isSelected ? 'is-selected' : ''} ${isDimmed ? 'is-dimmed' : ''}`,
                dayLabelClass: isSelected ? 'bar-day-label active-day' : 'bar-day-label'
            };
        });
    }

    get activeSelectedDay() {
        if (this.selectedBarIndex === null) return null;
        return this.sevenDayBars[this.selectedBarIndex] || null;
    }

    get sevenDayMacroAverages() {
        const bars = this.sevenDayBars;
        if (!bars.length) {
            return { pPct: 0, cPct: 0, fPct: 0, pGrams: 0, cGrams: 0, fGrams: 0 };
        }
        const sum = bars.reduce((acc, b) => {
            acc.pPct += b.proteinPct;
            acc.cPct += b.carbsPct;
            acc.fPct += b.fatPct;
            acc.pGrams += b.proteinGrams;
            acc.cGrams += b.carbsGrams;
            acc.fGrams += b.fatGrams;
            return acc;
        }, { pPct: 0, cPct: 0, fPct: 0, pGrams: 0, cGrams: 0, fGrams: 0 });

        const count = bars.length;
        return {
            pPct: Math.round(sum.pPct / count),
            cPct: Math.round(sum.cPct / count),
            fPct: Math.round(sum.fPct / count),
            pGrams: Math.round(sum.pGrams / count),
            cGrams: Math.round(sum.cGrams / count),
            fGrams: Math.round(sum.fGrams / count)
        };
    }

    get trendsHeaderLabel() {
        return this.activeSelectedDay ? this.activeSelectedDay.fullDateLabel : '7-DAY ROLLING AVERAGE';
    }

    get displayTrendProteinPct() {
        return this.activeSelectedDay ? this.activeSelectedDay.proteinPct : this.sevenDayMacroAverages.pPct;
    }

    get displayTrendCarbsPct() {
        return this.activeSelectedDay ? this.activeSelectedDay.carbsPct : this.sevenDayMacroAverages.cPct;
    }

    get displayTrendFatPct() {
        return this.activeSelectedDay ? this.activeSelectedDay.fatPct : this.sevenDayMacroAverages.fPct;
    }

    get displayTrendProteinGrams() {
        return this.activeSelectedDay
            ? `${this.activeSelectedDay.proteinGrams}g / ${this.targetProteinGrams}g`
            : `${this.sevenDayMacroAverages.pGrams}g avg`;
    }

    get displayTrendCarbsGrams() {
        return this.activeSelectedDay
            ? `${this.activeSelectedDay.carbsGrams}g / ${this.targetCarbsGrams}g`
            : `${this.sevenDayMacroAverages.cGrams}g avg`;
    }

    get displayTrendFatGrams() {
        return this.activeSelectedDay
            ? `${this.activeSelectedDay.fatGrams}g / ${this.targetFatGrams}g`
            : `${this.sevenDayMacroAverages.fGrams}g avg`;
    }

    handleBarHover(event) {
        this.selectedBarIndex = parseInt(event.currentTarget.dataset.index, 10);
    }

    handleBarLeave() {
        this.selectedBarIndex = null;
    }

    handleBarTap(event) {
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        this.selectedBarIndex = this.selectedBarIndex === idx ? null : idx;
    }

    /* --- SLIDE 3: BODY COMPOSITION --- */
    get compLogs() {
        return this.healthHistory.filter(h => h.Weight_lbs__c != null && (h.Body_Fat__c != null || h.Lean_Body_Mass__c != null));
    }

    get latestCompLog() {
        const logs = this.compLogs;
        return logs.length ? logs[logs.length - 1] : null;
    }

    get previousCompLog() {
        const logs = this.compLogs;
        return logs.length >= 2 ? logs[logs.length - 2] : null;
    }

    extractLeanLbs(log) {
        if (!log) return 0;
        if (log.Lean_Body_Mass__c != null) return Number(log.Lean_Body_Mass__c);
        const w = Number(log.Weight_lbs__c || 0);
        const bf = Number(log.Body_Fat__c || 0);
        return w * (1 - bf / 100);
    }

    extractFatLbs(log) {
        if (!log) return 0;
        if (log.Fat_Mass__c != null) return Number(log.Fat_Mass__c);
        const w = Number(log.Weight_lbs__c || 0);
        const bf = Number(log.Body_Fat__c || 0);
        return w * (bf / 100);
    }

    get formattedCurrentWeight() {
        const log = this.latestCompLog;
        const w = log && log.Weight_lbs__c != null ? Number(log.Weight_lbs__c) : this.currentBodyWeight;
        return w ? w.toFixed(1) : '0.0';
    }

    get bodyFatPct() {
        const log = this.latestCompLog;
        return log && log.Body_Fat__c != null ? Number(log.Body_Fat__c).toFixed(1) : '0.0';
    }

    get leanMassPct() {
        const bf = parseFloat(this.bodyFatPct);
        return bf > 0 ? (100 - bf).toFixed(1) : '0.0';
    }

    get leanMassLbs() {
        return this.extractLeanLbs(this.latestCompLog).toFixed(1);
    }

    get fatMassLbs() {
        return this.extractFatLbs(this.latestCompLog).toFixed(1);
    }

    get svgLeanWidth() {
        const pct = parseFloat(this.leanMassPct) || 85;
        return Math.round((pct / 100) * 300);
    }

    get svgFatMassWidth() {
        return Math.max(0, 300 - this.svgLeanWidth);
    }

    get dailyLeanDiff() {
        if (!this.latestCompLog || !this.previousCompLog) return 0;
        return Number((this.extractLeanLbs(this.latestCompLog) - this.extractLeanLbs(this.previousCompLog)).toFixed(1));
    }

    get dailyFatDiff() {
        if (!this.latestCompLog || !this.previousCompLog) return 0;
        return Number((this.extractFatLbs(this.latestCompLog) - this.extractFatLbs(this.previousCompLog)).toFixed(1));
    }

    get tissueLeanDeltaLabel() {
        const d = this.dailyLeanDiff;
        if (d > 0) return `▲ +${d.toFixed(1)}`;
        if (d < 0) return `▼ ${d.toFixed(1)}`;
        return '— 0.0';
    }

    get tissueFatDeltaLabel() {
        const d = this.dailyFatDiff;
        if (d > 0) return `▲ +${d.toFixed(1)}`;
        if (d < 0) return `▼ ${d.toFixed(1)}`;
        return '— 0.0';
    }

    get tissueLeanDeltaClass() {
        if (this.dailyLeanDiff > 0) return 'tissue-delta delta-green';
        if (this.dailyLeanDiff < 0) return 'tissue-delta delta-red';
        return 'tissue-delta delta-muted';
    }

    get tissueFatDeltaClass() {
        if (this.dailyFatDiff < 0) return 'tissue-delta delta-green';
        if (this.dailyFatDiff > 0) return 'tissue-delta delta-red';
        return 'tissue-delta delta-muted';
    }

    get compositionCallout() {
        if (this.dailyLeanDiff > 0 && this.dailyFatDiff <= 0) return 'GAINING MUSCLE';
        if (this.dailyLeanDiff >= 0 && this.dailyFatDiff < 0) return 'LOSING FAT';
        if (this.dailyLeanDiff < 0) return 'LOSING MUSCLE';
        if (this.dailyFatDiff > 0) return 'GAINING FAT';
        return 'STABLE';
    }

    get compositionArrow() {
        if (this.dailyLeanDiff > 0 && this.dailyFatDiff <= 0) return '↗';
        if (this.dailyLeanDiff >= 0 && this.dailyFatDiff < 0) return '↘';
        if (this.dailyLeanDiff < 0) return '↘';
        if (this.dailyFatDiff > 0) return '↗';
        return '';
    }

    /* --- PERSISTENT BOTTOM TELEMETRY --- */
    get formattedTdee() {
        return this.rollingTdee ? this.rollingTdee.toLocaleString() : '—';
    }

    get formattedTargetCalories() {
        return this.targetCalories ? this.targetCalories.toLocaleString() : '—';
    }

    get formattedWeeklyAvg() {
        const sign = this.weeklyVelocity > 0 ? '+' : '';
        return `${sign}${this.weeklyVelocity.toFixed(2)} LBS`;
    }

    get velocityValueClass() {
        if (this.weeklyVelocity > 0) return 'tele-val vel-positive';
        if (this.weeklyVelocity < 0) return 'tele-val vel-negative';
        return 'tele-val';
    }
}