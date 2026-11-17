import { LightningElement, api, wire } from 'lwc';
import getDashboardMetrics from '@salesforce/apex/DashboardController.getDashboardMetrics';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CENTER_X = 100;
const CENTER_Y = 98;
const BASE_RADIUS = 73;
const START_ANGLE = -212;
const END_ANGLE = 32;
const TOTAL_SWEEP = END_ANGLE - START_ANGLE; // 244 degrees

export default class GoalProjectionWidget extends LightningElement {
    @api isPrivacyMode = false;

    activeMode = 'FINANCIAL';

    financialLabel = 'FINANCIAL GOAL';
    financialProgress = 0;
    financialDaysRemaining = '—';
    financialProjectedDate = 'CALCULATING...';

    healthLabel = 'WEIGHT GOAL';
    healthProgress = 0;
    healthDaysRemaining = '—';
    healthProjectedDate = 'CALCULATING...';

    svgInitialized = false;
    gradientId = `neon-crescent-grad-${Math.random().toString(36).substring(2, 9)}`;

    @wire(getDashboardMetrics)
    wiredMetrics({ error, data }) {
        if (data) {
            this.financialLabel = data.financialGoalLabel || 'FINANCIAL GOAL';
            this.financialProgress = data.financialProgress != null ? Number(data.financialProgress) : 0;
            this.financialDaysRemaining = data.financialDaysRemaining || '—';
            this.financialProjectedDate = this.formatProjectedDate(data.financialProjectedDate);

            this.healthLabel = data.healthGoalLabel || 'WEIGHT GOAL';
            this.healthProgress = data.healthProgress != null ? Number(data.healthProgress) : 0;
            this.healthDaysRemaining = data.healthDaysRemaining || '—';
            this.healthProjectedDate = this.formatProjectedDate(data.healthProjectedDate);

            this.renderGaugeSvg();
        } else if (error) {
            console.error('GoalProjectionWidget wiredMetrics error:', error);
        }
    }

    renderedCallback() {
        if (!this.svgInitialized) {
            this.svgInitialized = true;
            this.renderGaugeSvg();
        }
    }

    formatProjectedDate(rawDate) {
        if (!rawDate || rawDate === 'STALLED' || rawDate === '730+ DAYS' || rawDate === 'CALCULATING...') {
            return rawDate || 'CALCULATING...';
        }
        const parts = String(rawDate).split('-');
        if (parts.length !== 3) return rawDate;
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
    }

    polarToCartesian(cx, cy, r, angleInDegrees) {
        const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
        return {
            x: cx + r * Math.cos(angleInRadians),
            y: cy + r * Math.sin(angleInRadians)
        };
    }

    /**
     * Generates one continuous, ultra-smooth closed SVG path from t = 0 up to maxT (0.0 -> 1.0)
     * with zero slice seams.
     */
    buildSmoothCrescentPath(maxT) {
        const clampedMax = Math.max(0, Math.min(1, maxT));
        if (clampedMax <= 0.005) {
            return '';
        }

        const steps = Math.max(24, Math.round(120 * clampedMax));
        const outerPts = [];
        const innerPts = [];

        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * clampedMax;
            const angle = START_ANGLE + t * TOTAL_SWEEP;

            const profile = Math.sin(t * Math.PI);
            const thickness = 2.0 + 6.5 * Math.pow(profile, 0.85);

            const rOuter = BASE_RADIUS + thickness * 0.58;
            const rInner = BASE_RADIUS - thickness * 0.42;

            outerPts.push(this.polarToCartesian(CENTER_X, CENTER_Y, rOuter, angle));
            innerPts.push(this.polarToCartesian(CENTER_X, CENTER_Y, rInner, angle));
        }

        let d = `M ${outerPts[0].x.toFixed(2)} ${outerPts[0].y.toFixed(2)}`;
        for (let i = 1; i < outerPts.length; i++) {
            d += ` L ${outerPts[i].x.toFixed(2)} ${outerPts[i].y.toFixed(2)}`;
        }
        for (let i = innerPts.length - 1; i >= 0; i--) {
            d += ` L ${innerPts[i].x.toFixed(2)} ${innerPts[i].y.toFixed(2)}`;
        }
        d += ' Z';
        return d;
    }

    /**
     * Builds the SVG DOM natively inside lwc:dom="manual" so LWC's template compiler
     * never alters or breaks the <linearGradient id> reference.
     */
    renderGaugeSvg() {
        const svgEl = this.template.querySelector('svg.sculpted-gauge-svg');
        if (!svgEl) return;

        while (svgEl.firstChild) {
            svgEl.removeChild(svgEl.firstChild);
        }

        // 1. Define true continuous SVG LinearGradient
        const defs = document.createElementNS(SVG_NS, 'defs');
        const grad = document.createElementNS(SVG_NS, 'linearGradient');
        grad.setAttribute('id', this.gradientId);
        grad.setAttribute('gradientUnits', 'userSpaceOnUse');
        grad.setAttribute('x1', '26');
        grad.setAttribute('y1', '135');
        grad.setAttribute('x2', '174');
        grad.setAttribute('y2', '45');

        const stops = [
            { offset: '0%', color: '#2596be' },
            { offset: '50%', color: '#3fb27f' },
            { offset: '100%', color: '#84ff33' }
        ];
        stops.forEach(s => {
            const stopEl = document.createElementNS(SVG_NS, 'stop');
            stopEl.setAttribute('offset', s.offset);
            stopEl.setAttribute('stop-color', s.color);
            grad.appendChild(stopEl);
        });
        defs.appendChild(grad);
        svgEl.appendChild(defs);

        // 2. Full-Arc Dark Background Track
        const trackPath = document.createElementNS(SVG_NS, 'path');
        trackPath.setAttribute('d', this.buildSmoothCrescentPath(1.0));
        trackPath.setAttribute('fill', 'rgba(255, 255, 255, 0.06)');
        trackPath.setAttribute('stroke', 'rgba(255, 255, 255, 0.08)');
        trackPath.setAttribute('stroke-width', '0.6');
        svgEl.appendChild(trackPath);

        // 3. Single Seamless Gradient Progress Crescent
        const progressFraction = this.activeProgress / 100;
        if (progressFraction > 0.005) {
            const fillPath = document.createElementNS(SVG_NS, 'path');
            fillPath.setAttribute('d', this.buildSmoothCrescentPath(progressFraction));
            fillPath.setAttribute('fill', `url(#${this.gradientId})`);
            svgEl.appendChild(fillPath);
        }
    }

    get activeProgress() {
        const raw = this.activeMode === 'FINANCIAL' ? this.financialProgress : this.healthProgress;
        return Math.max(0, Math.min(100, raw));
    }

    get activeGoalLabel() {
        return this.activeMode === 'FINANCIAL' ? this.financialLabel : this.healthLabel;
    }

    get displayProgress() {
        return this.isPrivacyMode && this.activeMode === 'FINANCIAL' ? '••' : this.activeProgress;
    }

    get displayDaysRemaining() {
        if (this.isPrivacyMode && this.activeMode === 'FINANCIAL') return '•••';
        return this.activeMode === 'FINANCIAL' ? this.financialDaysRemaining : this.healthDaysRemaining;
    }

    get daysRemainingClass() {
        const val = String(this.displayDaysRemaining);
        return val === 'STALLED' ? 'days-number stalled-text' : 'days-number';
    }

    get displayProjectedDate() {
        if (this.isPrivacyMode && this.activeMode === 'FINANCIAL') return 'HIDDEN';
        return this.activeMode === 'FINANCIAL' ? this.financialProjectedDate : this.healthProjectedDate;
    }

    get finDotClass() {
        return this.activeMode === 'FINANCIAL' ? 'dot active-dot' : 'dot';
    }

    get healthDotClass() {
        return this.activeMode === 'HEALTH' ? 'dot active-dot' : 'dot';
    }

    handleToggleMode() {
        this.activeMode = this.activeMode === 'FINANCIAL' ? 'HEALTH' : 'FINANCIAL';
        this.renderGaugeSvg();
    }

    handleSelectDot(event) {
        const selected = event.currentTarget.dataset.mode;
        if (selected) {
            this.activeMode = selected;
            this.renderGaugeSvg();
        }
    }
}