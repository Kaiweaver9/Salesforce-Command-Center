import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getDashboardMetrics from '@salesforce/apex/DashboardController.getDashboardMetrics';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CENTER_X = 100;
const CENTER_Y = 98;
const BASE_RADIUS = 73;
const START_ANGLE = -212;
const END_ANGLE = 32;
const TOTAL_SWEEP = END_ANGLE - START_ANGLE;

export default class GoalProjectionWidget extends LightningElement {
    @api isPrivacyMode = false;

    activeMode = 'FINANCIAL';
    wiredMetricsResult;

    // Financial state
    financialGoalId = null;
    financialLabel = 'NO ACTIVE GOAL';
    financialTarget = 0;
    financialBalance = 0;
    financialProgress = 0;
    financialDaysRemaining = '—';
    financialProjectedDate = 'NONE';

    // Health state
    healthGoalId = null;
    healthLabel = 'NO ACTIVE GOAL';
    healthTarget = 0;
    healthProgress = 0;
    healthDaysRemaining = '—';
    healthProjectedDate = 'NONE';
    healthGoalMode = 'WEIGHT_TARGET';
    currentPhase = 'maintenance';
    phaseDurationDays = null;

    queuedGoals = [];

    victoryLapData = {
        FINANCIAL: null,
        HEALTH: null
    };

    svgInitialized = false;
    gradientId = `neon-crescent-grad-${Math.random().toString(36).substring(2, 9)}`;

    connectedCallback() {
        this.loadVictoryLapState();
    }

    @api
    refresh() {
        this.loadVictoryLapState();
        if (this.wiredMetricsResult) {
            return refreshApex(this.wiredMetricsResult);
        }
        return Promise.resolve();
    }

    @wire(getDashboardMetrics)
    wiredMetrics(result) {
        this.wiredMetricsResult = result;
        const { error, data } = result;

        if (data) {
            this.loadVictoryLapState();

            // Financial metrics
            this.financialGoalId = data.financialGoalId || null;
            this.financialLabel = data.financialGoalLabel || 'NO ACTIVE GOAL';
            this.financialTarget = data.financialTarget != null ? Number(data.financialTarget) : 0;
            this.financialBalance = data.financialBalance != null ? Number(data.financialBalance) : 0;
            this.financialProgress = data.financialProgress != null ? Number(data.financialProgress) : 0;
            this.financialDaysRemaining = this.financialGoalId ? (data.financialDaysRemaining || '—') : '—';
            this.financialProjectedDate = this.financialGoalId
                ? this.formatProjectedDate(data.financialProjectedDate)
                : 'NONE';

            if (this.financialGoalId && this.victoryLapData.FINANCIAL?.goalId !== this.financialGoalId) {
                this.clearVictoryLap('FINANCIAL');
            }

            // Health metrics
            this.healthGoalId = data.healthGoalId || null;
            this.healthLabel = data.healthGoalLabel || 'NO ACTIVE GOAL';
            this.healthTarget = data.healthTarget != null ? Number(data.healthTarget) : 0;
            this.healthProgress = data.healthProgress != null ? Number(data.healthProgress) : 0;
            this.healthDaysRemaining = this.healthGoalId ? (data.healthDaysRemaining || '—') : '—';
            this.healthProjectedDate = this.healthGoalId
                ? this.formatProjectedDate(data.healthProjectedDate)
                : 'NONE';
            this.healthGoalMode = data.healthGoalMode || 'WEIGHT_TARGET';
            this.currentPhase = data.currentPhase || 'maintenance';
            this.phaseDurationDays = data.phaseDurationDays != null ? Number(data.phaseDurationDays) : null;

            if (this.healthGoalId && this.victoryLapData.HEALTH?.goalId !== this.healthGoalId) {
                this.clearVictoryLap('HEALTH');
            }

            this.queuedGoals = Array.isArray(data.queuedGoals) ? data.queuedGoals : [];

            this.renderGaugeSvg();
            this.checkCompletionTriggers();
        } else if (error) {
            console.error('GoalProjectionWidget wiredMetrics error:', error);
        }
    }

    loadVictoryLapState() {
        try {
            const finRaw = window.localStorage.getItem('victoryLap_FINANCIAL');
            const healthRaw = window.localStorage.getItem('victoryLap_HEALTH');
            this.victoryLapData = {
                FINANCIAL: finRaw ? JSON.parse(finRaw) : null,
                HEALTH: healthRaw ? JSON.parse(healthRaw) : null
            };
        } catch (e) {
            this.victoryLapData = { FINANCIAL: null, HEALTH: null };
        }
    }

    clearVictoryLap(goalType) {
        try {
            window.localStorage.removeItem(`victoryLap_${goalType}`);
        } catch (e) {
            // Ignore storage restrictions
        }
        this.victoryLapData = {
            ...this.victoryLapData,
            [goalType]: null
        };
    }

    getTodayKey() {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    isDismissedToday(goalId) {
        if (!goalId) return true;
        try {
            return window.localStorage.getItem(`dismissedGoal_${goalId}_${this.getTodayKey()}`) === 'true';
        } catch (e) {
            return false;
        }
    }

    checkCompletionTriggers() {
        const todayKey = this.getTodayKey();

        // 1. Check Financial Goal Completion
        const isFinancialComplete =
            this.financialGoalId &&
            (String(this.financialDaysRemaining) === '0' ||
                (this.financialTarget > 0 && this.financialBalance >= this.financialTarget));

        if (isFinancialComplete && !this.isDismissedToday(this.financialGoalId)) {
            this.activeMode = 'FINANCIAL';
            this.renderGaugeSvg();
            this.dispatchGoalCompleted({
                goalId: this.financialGoalId,
                goalLabel: this.financialLabel,
                goalType: 'FINANCIAL',
                mode: 'TARGET_REACHED',
                currentPhase: null,
                phaseDurationDays: null,
                targetValue: this.financialTarget,
                todayKey,
                queuedGoals: this.queuedGoals.filter(g => (g.goalType || '').toUpperCase() === 'FINANCIAL')
            });
            return;
        }

        // 2. Check Health Goal / Timed Phase Completion
        const isHealthComplete =
            this.healthGoalId &&
            (String(this.healthDaysRemaining) === '0' ||
                (this.healthGoalMode === 'WEIGHT_TARGET' && this.healthProgress >= 100));

        if (isHealthComplete && !this.isDismissedToday(this.healthGoalId)) {
            this.activeMode = 'HEALTH';
            this.renderGaugeSvg();
            const overlayMode = this.healthGoalMode === 'TIMED_PHASE' ? 'PHASE_COMPLETED' : 'TARGET_REACHED';
            this.dispatchGoalCompleted({
                goalId: this.healthGoalId,
                goalLabel: this.healthLabel,
                goalType: 'HEALTH',
                mode: overlayMode,
                currentPhase: this.currentPhase,
                phaseDurationDays: this.phaseDurationDays,
                targetValue: this.healthTarget,
                todayKey,
                queuedGoals: this.queuedGoals.filter(g => (g.goalType || '').toUpperCase() === 'HEALTH')
            });
        }
    }

    dispatchGoalCompleted(detail) {
        this.dispatchEvent(
            new CustomEvent('goalcompleted', {
                detail,
                bubbles: true,
                composed: true
            })
        );
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

    renderGaugeSvg() {
        const svgEl = this.template.querySelector('svg.sculpted-gauge-svg');
        if (!svgEl) return;

        while (svgEl.firstChild) {
            svgEl.removeChild(svgEl.firstChild);
        }

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

        const trackPath = document.createElementNS(SVG_NS, 'path');
        trackPath.setAttribute('d', this.buildSmoothCrescentPath(1.0));
        trackPath.setAttribute('fill', 'rgba(255, 255, 255, 0.06)');
        trackPath.setAttribute('stroke', 'rgba(255, 255, 255, 0.08)');
        trackPath.setAttribute('stroke-width', '0.6');
        svgEl.appendChild(trackPath);

        const progressFraction = this.activeProgress / 100;
        if (progressFraction > 0.005) {
            const fillPath = document.createElementNS(SVG_NS, 'path');
            fillPath.setAttribute('d', this.buildSmoothCrescentPath(progressFraction));
            fillPath.setAttribute('fill', `url(#${this.gradientId})`);
            svgEl.appendChild(fillPath);
        }
    }

    get activeGoalId() {
        return this.activeMode === 'FINANCIAL' ? this.financialGoalId : this.healthGoalId;
    }

    get activeVictorySnapshot() {
        return this.victoryLapData[this.activeMode] || null;
    }

    get isVictoryLapActive() {
        return !this.activeGoalId && Boolean(this.activeVictorySnapshot);
    }

    get isUnsetGoalState() {
        return !this.activeGoalId && !this.isVictoryLapActive;
    }

    get isActiveGoalAtZero() {
        if (!this.activeGoalId) return false;
        const days = String(this.activeMode === 'FINANCIAL' ? this.financialDaysRemaining : this.healthDaysRemaining);
        return days === '0' || (this.activeMode === 'HEALTH' && this.healthGoalMode === 'WEIGHT_TARGET' && this.healthProgress >= 100);
    }

    get showSetGoalAction() {
        return this.isVictoryLapActive || this.isUnsetGoalState || this.isActiveGoalAtZero;
    }

    get setGoalButtonLabel() {
        return this.isUnsetGoalState ? '+ SET GOAL' : '+ SET NEXT GOAL';
    }

    get cardClass() {
        return this.isVictoryLapActive ? 'projection-card victory-lap' : 'projection-card';
    }

    get activeProgress() {
        if (this.isVictoryLapActive) return 100;
        if (this.isUnsetGoalState) return 0;
        const raw = this.activeMode === 'FINANCIAL' ? this.financialProgress : this.healthProgress;
        return Math.max(0, Math.min(100, raw));
    }

    get activeGoalLabel() {
        if (this.isVictoryLapActive && this.activeVictorySnapshot?.goalLabel) {
            return this.activeVictorySnapshot.goalLabel;
        }
        return this.activeMode === 'FINANCIAL' ? this.financialLabel : this.healthLabel;
    }

    get badgeClass() {
        return this.isVictoryLapActive ? 'progress-badge victory-badge' : 'progress-badge';
    }

    get displayBadgeText() {
        if (this.isVictoryLapActive) {
            return this.activeVictorySnapshot?.mode === 'PHASE_COMPLETED' ? 'PHASE ENDED' : 'COMPLETE';
        }
        if (this.isUnsetGoalState) {
            return 'IDLE';
        }
        if (this.isPrivacyMode && this.activeMode === 'FINANCIAL') {
            return '••%';
        }
        return `${this.activeProgress}%`;
    }

    get displayDaysRemaining() {
        if (this.isVictoryLapActive) return '0';
        if (this.isUnsetGoalState) return '—';
        if (this.isPrivacyMode && this.activeMode === 'FINANCIAL') {
            return '•••';
        }
        return this.activeMode === 'FINANCIAL' ? this.financialDaysRemaining : this.healthDaysRemaining;
    }

    get daysSublabel() {
        return this.isUnsetGoalState ? 'NO ACTIVE TARGET' : 'DAYS REMAINING';
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

    handleSetNextGoal() {
        const goalType = this.activeMode;
        const queuedForType = this.queuedGoals.filter(
            g => (g.goalType || '').toUpperCase() === goalType
        );
        if (this.activeGoalId) {
            try {
                window.localStorage.removeItem(`dismissedGoal_${this.activeGoalId}_${this.getTodayKey()}`);
            } catch (e) {
                // Ignore storage restrictions
            }
        }
        this.clearVictoryLap(goalType);
        this.dispatchEvent(
            new CustomEvent('opensetgoal', {
                detail: {
                    goalType,
                    queuedGoals: queuedForType
                },
                bubbles: true,
                composed: true
            })
        );
    }
}