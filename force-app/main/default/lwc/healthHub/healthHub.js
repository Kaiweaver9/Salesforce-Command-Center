import { LightningElement, wire } from 'lwc';
import getDashboardMetrics from '@salesforce/apex/DashboardController.getDashboardMetrics';
import getHealthHistory from '@salesforce/apex/DashboardController.getHealthHistory';

const SVG_NS = 'http://www.w3.org/2000/svg';
const RING_CX = 100;
const RING_CY = 82;
const HERO_RING_RADIUS = 62;
const SEGMENT_GAP_DEG = 6;

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
    uid = Math.random().toString(36).substring(2, 8);

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
            this.scheduleActiveSlideRender();
        } else if (error) {
            console.error('healthHub wiredMetrics error:', error);
        }
    }

    @wire(getHealthHistory)
    wiredHistory({ error, data }) {
        if (data) {
            const todayStr = this.getLocalTodayString();
            this.healthHistory = data.filter(item => item.Entry_Date__c && item.Entry_Date__c <= todayStr);
            this.scheduleActiveSlideRender();
        } else if (error) {
            console.error('healthHub wiredHistory error:', error);
        }
    }

    renderedCallback() {
        this.renderActiveSlideGraphics();
    }

    scheduleActiveSlideRender() {
        Promise.resolve().then(() => this.renderActiveSlideGraphics());
    }

    renderActiveSlideGraphics() {
        if (this.activeSlide === 0) {
            this.renderHeroRingSvg();
        } else if (this.activeSlide === 1) {
            this.renderMacroSplitSvg();
        } else if (this.activeSlide === 2) {
            this.renderSevenDayTrendsSvg();
        } else if (this.activeSlide === 3) {
            this.renderCompSplitSvg();
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

    /* --- SHARED NATIVE SVG GRADIENT HELPERS (LWC SHADOW-DOM SAFE) --- */
    clearSvg(svgEl) {
        while (svgEl && svgEl.firstChild) {
            svgEl.removeChild(svgEl.firstChild);
        }
    }

    createLinearGradient(id, x1, y1, x2, y2, stops) {
        const grad = document.createElementNS(SVG_NS, 'linearGradient');
        grad.setAttribute('id', id);
        grad.setAttribute('gradientUnits', 'userSpaceOnUse');
        grad.setAttribute('x1', String(x1));
        grad.setAttribute('y1', String(y1));
        grad.setAttribute('x2', String(x2));
        grad.setAttribute('y2', String(y2));
        stops.forEach(s => {
            const stop = document.createElementNS(SVG_NS, 'stop');
            stop.setAttribute('offset', s.offset);
            stop.setAttribute('stop-color', s.color);
            grad.appendChild(stop);
        });
        return grad;
    }

    createSvgRect(x, y, width, height, fill, rx = 0) {
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(Math.max(0, width)));
        rect.setAttribute('height', String(Math.max(0, height)));
        if (rx > 0) rect.setAttribute('rx', String(rx));
        rect.setAttribute('fill', fill);
        return rect;
    }

    /* --- SLIDE 1: NATIVE GRADIENT HERO RING --- */
    polarToCartesian(cx, cy, r, angleDeg) {
        const rad = ((angleDeg - 90) * Math.PI) / 180.0;
        return {
            x: cx + r * Math.cos(rad),
            y: cy + r * Math.sin(rad)
        };
    }

    describeArc(cx, cy, r, startAngle, endAngle) {
        const sweep = endAngle - startAngle;
        if (sweep <= 0.5) return '';
        const clampedEnd = sweep >= 359.5 ? startAngle + 359.5 : endAngle;
        const start = this.polarToCartesian(cx, cy, r, startAngle);
        const end = this.polarToCartesian(cx, cy, r, clampedEnd);
        const largeArc = clampedEnd - startAngle <= 180 ? '0' : '1';
        return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
    }

    renderHeroRingSvg() {
        const svgEl = this.template.querySelector('svg.hero-energy-svg');
        if (!svgEl) return;
        this.clearSvg(svgEl);

        const pGradId = `ring-p-grad-${this.uid}`;
        const cGradId = `ring-c-grad-${this.uid}`;
        const fGradId = `ring-f-grad-${this.uid}`;

        const defs = document.createElementNS(SVG_NS, 'defs');
        defs.appendChild(this.createLinearGradient(pGradId, 100, 16, 164, 82, [
            { offset: '0%', color: '#3fb27f' },
            { offset: '100%', color: '#84ff33' }
        ]));
        defs.appendChild(this.createLinearGradient(cGradId, 164, 82, 42, 128, [
            { offset: '0%', color: '#2596be' },
            { offset: '100%', color: '#164a5f' }
        ]));
        defs.appendChild(this.createLinearGradient(fGradId, 42, 128, 100, 16, [
            { offset: '0%', color: '#64748b' },
            { offset: '100%', color: '#cbd5e1' }
        ]));
        svgEl.appendChild(defs);

        // Recessed Dark Track
        const track = document.createElementNS(SVG_NS, 'circle');
        track.setAttribute('cx', String(RING_CX));
        track.setAttribute('cy', String(RING_CY));
        track.setAttribute('r', String(HERO_RING_RADIUS));
        track.setAttribute('fill', 'none');
        track.setAttribute('stroke', '#0b0e11');
        track.setAttribute('stroke-width', '10');
        svgEl.appendChild(track);

        const hasData = (this.proteinGrams + this.carbsGrams + this.fatGrams) > 0;
        const pPct = hasData ? this.actualProteinPct : 30;
        const cPct = hasData ? this.actualCarbsPct : 45;
        const fPct = hasData ? this.actualFatPct : 25;

        const pSweep = Math.max(0, (pPct / 100) * 360 - SEGMENT_GAP_DEG);
        const cSweep = Math.max(0, (cPct / 100) * 360 - SEGMENT_GAP_DEG);
        const fSweep = Math.max(0, (fPct / 100) * 360 - SEGMENT_GAP_DEG);

        const pStart = SEGMENT_GAP_DEG / 2;
        const pEnd = pStart + pSweep;
        const cStart = pEnd + SEGMENT_GAP_DEG;
        const cEnd = cStart + cSweep;
        const fStart = cEnd + SEGMENT_GAP_DEG;
        const fEnd = fStart + fSweep;

        const segments = [
            { macro: 'PROTEIN', start: pStart, end: pEnd, gradId: pGradId },
            { macro: 'CARBS', start: cStart, end: cEnd, gradId: cGradId },
            { macro: 'FAT', start: fStart, end: fEnd, gradId: fGradId }
        ];

        segments.forEach(seg => {
            const pathD = this.describeArc(RING_CX, RING_CY, HERO_RING_RADIUS, seg.start, seg.end);
            if (!pathD) return;

            const isHighlighted = this.hoveredMacro === seg.macro;
            const isDimmed = this.hoveredMacro && !isHighlighted;

            const path = document.createElementNS(SVG_NS, 'path');
            path.setAttribute('d', pathD);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', `url(#${seg.gradId})`);
            path.setAttribute('stroke-width', isHighlighted ? '12.5' : '10');
            path.setAttribute('stroke-linecap', 'round');
            path.style.cursor = 'pointer';
            path.style.opacity = isDimmed ? '0.25' : '1';
            path.style.transition = 'stroke-width 0.2s ease, opacity 0.2s ease';

            path.addEventListener('mouseenter', () => {
                if (this.hoveredMacro !== seg.macro) {
                    this.hoveredMacro = seg.macro;
                    this.renderHeroRingSvg();
                }
            });
            path.addEventListener('mouseleave', () => {
                if (this.hoveredMacro !== null) {
                    this.hoveredMacro = null;
                    this.renderHeroRingSvg();
                }
            });
            path.addEventListener('click', () => {
                this.hoveredMacro = this.hoveredMacro === seg.macro ? null : seg.macro;
                this.renderHeroRingSvg();
            });

            svgEl.appendChild(path);
        });
    }

    /* --- SLIDE 2: NATIVE GRADIENT MACRO SPLIT BAR --- */
    renderMacroSplitSvg() {
        const svgEl = this.template.querySelector('svg.macro-split-svg');
        if (!svgEl) return;
        this.clearSvg(svgEl);

        const pGradId = `bar-p-grad-${this.uid}`;
        const cGradId = `bar-c-grad-${this.uid}`;
        const fGradId = `bar-f-grad-${this.uid}`;

        const hasData = (this.proteinGrams + this.carbsGrams + this.fatGrams) > 0;
        const pPct = hasData ? this.actualProteinPct : 30;
        const cPct = hasData ? this.actualCarbsPct : 45;

        const pW = Math.round((pPct / 100) * 300);
        const cX = pW;
        const cW = Math.round((cPct / 100) * 300);
        const fX = pW + cW;
        const fW = Math.max(0, 300 - fX);

        const defs = document.createElementNS(SVG_NS, 'defs');
        defs.appendChild(this.createLinearGradient(pGradId, 0, 0, Math.max(1, pW), 0, [
            { offset: '0%', color: '#3fb27f' },
            { offset: '100%', color: '#84ff33' }
        ]));
        defs.appendChild(this.createLinearGradient(cGradId, cX, 0, Math.max(cX + 1, cX + cW), 0, [
            { offset: '0%', color: '#164a5f' },
            { offset: '100%', color: '#2596be' }
        ]));
        defs.appendChild(this.createLinearGradient(fGradId, fX, 0, 300, 0, [
            { offset: '0%', color: '#64748b' },
            { offset: '100%', color: '#cbd5e1' }
        ]));
        svgEl.appendChild(defs);

        svgEl.appendChild(this.createSvgRect(0, 0, 300, 9, '#0b0e11', 4.5));
        if (pW > 0) svgEl.appendChild(this.createSvgRect(0, 0, pW, 9, `url(#${pGradId})`));
        if (cW > 0) svgEl.appendChild(this.createSvgRect(cX, 0, cW, 9, `url(#${cGradId})`));
        if (fW > 0) svgEl.appendChild(this.createSvgRect(fX, 0, fW, 9, `url(#${fGradId})`));
    }

    /* --- SLIDE 3: NATIVE GRADIENT 7-DAY STACKED BARS --- */
    renderSevenDayTrendsSvg() {
        const svgEl = this.template.querySelector('svg.trends-bars-svg');
        if (!svgEl) return;
        this.clearSvg(svgEl);

        const pGradId = `trend-p-grad-${this.uid}`;
        const cGradId = `trend-c-grad-${this.uid}`;
        const fGradId = `trend-f-grad-${this.uid}`;

        const defs = document.createElementNS(SVG_NS, 'defs');
        defs.appendChild(this.createLinearGradient(cGradId, 0, 0, 0, 50, [
            { offset: '0%', color: '#2596be' },
            { offset: '100%', color: '#164a5f' }
        ]));
        defs.appendChild(this.createLinearGradient(fGradId, 0, 35, 0, 75, [
            { offset: '0%', color: '#cbd5e1' },
            { offset: '100%', color: '#64748b' }
        ]));
        defs.appendChild(this.createLinearGradient(pGradId, 0, 60, 0, 96, [
            { offset: '0%', color: '#84ff33' },
            { offset: '100%', color: '#3fb27f' }
        ]));
        svgEl.appendChild(defs);

        const bars = this.sevenDayBars;
        if (!bars.length) return;

        const slotWidth = 280 / bars.length;
        const barWidth = 14;

        bars.forEach((bar, idx) => {
            const x = idx * slotWidth + (slotWidth - barWidth) / 2;
            const isSelected = this.selectedBarIndex === idx;
            const isDimmed = this.selectedBarIndex !== null && !isSelected;

            const group = document.createElementNS(SVG_NS, 'g');
            group.style.cursor = 'pointer';
            group.style.opacity = isDimmed ? '0.25' : '1';
            group.style.transition = 'opacity 0.15s ease';

            const cH = (bar.carbsHeight / 100) * 96;
            const fY = (bar.fatY / 100) * 96;
            const fH = (bar.fatHeight / 100) * 96;
            const pY = (bar.proteinY / 100) * 96;
            const pH = (bar.proteinHeight / 100) * 96;

            group.appendChild(this.createSvgRect(x, 0, barWidth, 96, '#0b0e11', 3));
            if (cH > 0) group.appendChild(this.createSvgRect(x, 0, barWidth, cH, `url(#${cGradId})`));
            if (fH > 0) group.appendChild(this.createSvgRect(x, fY, barWidth, fH, `url(#${fGradId})`));
            if (pH > 0) group.appendChild(this.createSvgRect(x, pY, barWidth, pH, `url(#${pGradId})`));

            if (isSelected) {
                const highlight = document.createElementNS(SVG_NS, 'rect');
                highlight.setAttribute('x', String(x - 0.5));
                highlight.setAttribute('y', '0.5');
                highlight.setAttribute('width', String(barWidth + 1));
                highlight.setAttribute('height', '95');
                highlight.setAttribute('rx', '3');
                highlight.setAttribute('fill', 'none');
                highlight.setAttribute('stroke', 'rgba(255, 255, 255, 0.55)');
                highlight.setAttribute('stroke-width', '1');
                group.appendChild(highlight);
            }

            group.addEventListener('mouseenter', () => {
                if (this.selectedBarIndex !== idx) {
                    this.selectedBarIndex = idx;
                    this.renderSevenDayTrendsSvg();
                }
            });
            group.addEventListener('click', () => {
                this.selectedBarIndex = this.selectedBarIndex === idx ? null : idx;
                this.renderSevenDayTrendsSvg();
            });

            svgEl.appendChild(group);
        });
    }

    /* --- SLIDE 4: NATIVE GRADIENT BODY COMP SPLIT BAR --- */
    renderCompSplitSvg() {
        const svgEl = this.template.querySelector('svg.comp-split-svg');
        if (!svgEl) return;
        this.clearSvg(svgEl);

        const leanGradId = `comp-lean-grad-${this.uid}`;
        const fatGradId = `comp-fat-grad-${this.uid}`;

        const leanPct = parseFloat(this.leanMassPct) || 85;
        const leanW = Math.round((leanPct / 100) * 300);
        const fatW = Math.max(0, 300 - leanW);

        const defs = document.createElementNS(SVG_NS, 'defs');
        defs.appendChild(this.createLinearGradient(leanGradId, 0, 0, Math.max(1, leanW), 0, [
            { offset: '0%', color: '#3fb27f' },
            { offset: '100%', color: '#84ff33' }
        ]));
        defs.appendChild(this.createLinearGradient(fatGradId, leanW, 0, 300, 0, [
            { offset: '0%', color: '#64748b' },
            { offset: '100%', color: '#cbd5e1' }
        ]));
        svgEl.appendChild(defs);

        svgEl.appendChild(this.createSvgRect(0, 0, 300, 9, '#0b0e11', 4.5));
        if (leanW > 0) svgEl.appendChild(this.createSvgRect(0, 0, leanW, 9, `url(#${leanGradId})`));
        if (fatW > 0) svgEl.appendChild(this.createSvgRect(leanW, 0, fatW, 9, `url(#${fatGradId})`));
    }

    /* --- HEADER & 4-SLIDE NAVIGATION --- */
    get activeSlideTitle() {
        if (this.activeSlide === 0) return 'DAILY ENERGY';
        if (this.activeSlide === 1) return 'DAILY MACROS';
        if (this.activeSlide === 2) return 'MACRO TRENDS';
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

    get isSlideFour() {
        return this.activeSlide === 3;
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

    get dot3Class() {
        return this.activeSlide === 3 ? 'dot active' : 'dot';
    }

    handlePrevSlide() {
        this.selectedBarIndex = null;
        this.hoveredMacro = null;
        this.activeSlide = (this.activeSlide + 3) % 4;
        this.scheduleActiveSlideRender();
    }

    handleNextSlide() {
        this.selectedBarIndex = null;
        this.hoveredMacro = null;
        this.activeSlide = (this.activeSlide + 1) % 4;
        this.scheduleActiveSlideRender();
    }

    handleDotClick(event) {
        this.selectedBarIndex = null;
        this.hoveredMacro = null;
        this.activeSlide = parseInt(event.currentTarget.dataset.slide, 10);
        this.scheduleActiveSlideRender();
    }

    handleNavigateHealth() {
        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { view: 'health' },
            bubbles: true,
            composed: true
        }));
    }

    /* --- SLIDE 1 & 2: MACRO TARGETS (30P / 45C / 25F) --- */
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

    get calorieDiff() {
        return this.caloriesConsumed - this.targetCalories;
    }

    get calorieDeltaLabel() {
        if (this.caloriesConsumed === 0) return `${this.targetCalories.toLocaleString()} LEFT`;
        const absDiff = Math.abs(this.calorieDiff).toLocaleString();
        return this.calorieDiff > 0 ? `+${absDiff} OVER` : `${absDiff} LEFT`;
    }

    get calorieDeltaBadgeClass() {
        if (this.caloriesConsumed === 0) return 'energy-delta-pill neutral';
        return Math.abs(this.calorieDiff) <= 150 ? 'energy-delta-pill optimal' : 'energy-delta-pill accent';
    }

    get ringCenterEyebrow() {
        if (this.hoveredMacro === 'PROTEIN') return 'PROTEIN';
        if (this.hoveredMacro === 'CARBS') return 'CARBS';
        if (this.hoveredMacro === 'FAT') return 'FAT';
        return 'CONSUMED';
    }

    get heroRingEyebrowClass() {
        if (this.hoveredMacro === 'PROTEIN') return 'hero-ring-eyebrow label-green';
        if (this.hoveredMacro === 'CARBS') return 'hero-ring-eyebrow label-blue';
        if (this.hoveredMacro === 'FAT') return 'hero-ring-eyebrow label-slate';
        return 'hero-ring-eyebrow';
    }

    get ringCenterPrimary() {
        if (this.hoveredMacro === 'PROTEIN') return `${this.proteinGrams}g`;
        if (this.hoveredMacro === 'CARBS') return `${this.carbsGrams}g`;
        if (this.hoveredMacro === 'FAT') return `${this.fatGrams}g`;
        return this.caloriesConsumed.toLocaleString();
    }

    get ringCenterSecondary() {
        if (this.hoveredMacro === 'PROTEIN') return `TARGET ${this.targetProteinGrams}G · ${this.actualProteinPct}%`;
        if (this.hoveredMacro === 'CARBS') return `TARGET ${this.targetCarbsGrams}G · ${this.actualCarbsPct}%`;
        if (this.hoveredMacro === 'FAT') return `TARGET ${this.targetFatGrams}G · ${this.actualFatPct}%`;
        return `/ ${this.targetCalories.toLocaleString()} KCAL`;
    }

    handleMacroHover(event) {
        const macro = event.currentTarget.dataset.macro;
        if (this.hoveredMacro !== macro) {
            this.hoveredMacro = macro;
            this.renderHeroRingSvg();
        }
    }

    handleMacroLeave() {
        if (this.hoveredMacro !== null) {
            this.hoveredMacro = null;
            this.renderHeroRingSvg();
        }
    }

    handleMacroTap(event) {
        const macro = event.currentTarget.dataset.macro;
        this.hoveredMacro = this.hoveredMacro === macro ? null : macro;
        this.renderHeroRingSvg();
    }

    // Slide 2: Distinct Macro Delta Getters
    formatMacroDelta(actual, target) {
        const diff = actual - target;
        return diff >= 0 ? `+${diff}g vs target` : `${diff}g vs target`;
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
        return this.proteinGrams >= this.targetProteinGrams ? 'macro-delta-pill positive' : 'macro-delta-pill neutral';
    }

    get macroCarbsDeltaClass() {
        return Math.abs(this.carbsGrams - this.targetCarbsGrams) <= 20 ? 'macro-delta-pill positive' : 'macro-delta-pill neutral';
    }

    get macroFatDeltaClass() {
        return Math.abs(this.fatGrams - this.targetFatGrams) <= 10 ? 'macro-delta-pill positive' : 'macro-delta-pill neutral';
    }

    /* --- SLIDE 3: 7-DAY MACRO SPLITS --- */
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
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        if (this.selectedBarIndex !== idx) {
            this.selectedBarIndex = idx;
            this.renderSevenDayTrendsSvg();
        }
    }

    handleBarLeave() {
        if (this.selectedBarIndex !== null) {
            this.selectedBarIndex = null;
            this.renderSevenDayTrendsSvg();
        }
    }

    handleBarTap(event) {
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        this.selectedBarIndex = this.selectedBarIndex === idx ? null : idx;
        this.renderSevenDayTrendsSvg();
    }

    /* --- SLIDE 4: BODY COMPOSITION --- */
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