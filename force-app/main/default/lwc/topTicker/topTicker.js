import { LightningElement, api, wire } from 'lwc';
import getDashboardMetrics from '@salesforce/apex/DashboardController.getDashboardMetrics';

export default class TopTicker extends LightningElement {
    @api isPrivacyMode = false;

    financialBalance = 0.00;
    totalNetWorth = 0.00;
    financialGoalLabel = 'FINANCIAL GOAL';
    financialTarget = 0;
    financialProgress = 0;
    financialTrend = 'PLATEAU';

    currentBodyWeight = 0.0;
    targetCalories = 0;
    healthGoalLabel = 'WEIGHT GOAL';
    healthTarget = 0;
    healthProgress = 0;
    weightTrend = 'PLATEAU';
    currentPhase = 'maintenance';

    @wire(getDashboardMetrics)
    wiredMetrics({ error, data }) {
        if (data) {
            this.financialBalance = data.financialBalance ?? 0.00;
            this.totalNetWorth = data.totalNetWorth ?? 0.00;
            this.financialGoalLabel = data.financialGoalLabel || 'FINANCIAL GOAL';
            this.financialTarget = data.financialTarget ?? 0;
            this.financialProgress = data.financialProgress ?? 0;
            this.financialTrend = data.financialTrend || 'PLATEAU';

            this.currentBodyWeight = data.currentBodyWeight ?? 0.0;
            this.targetCalories = data.targetCalories ?? 0;
            this.healthGoalLabel = data.healthGoalLabel || 'WEIGHT GOAL';
            this.healthTarget = data.healthTarget ?? 0;
            this.healthProgress = data.healthProgress ?? 0;
            this.weightTrend = data.weightTrend || 'PLATEAU';
            this.currentPhase = data.currentPhase || 'maintenance';
        } else if (error) {
            console.error('Error fetching top ticker metrics:', error);
        }
    }

    // Financial Trend Chevron & Color
    get financialTrendIcon() {
        if (this.financialTrend === 'OPTIMAL') return '▲';
        if (this.financialTrend === 'DECAY') return '▼';
        return '—';
    }

    get financialTrendClass() {
        if (this.financialTrend === 'OPTIMAL') return 'chevron trend-optimal';
        if (this.financialTrend === 'DECAY') return 'chevron trend-decay';
        return 'chevron trend-neutral';
    }

    // Health Trend Chevron & Color (Phase-Aware)
    get healthTrendIcon() {
        const isGainingPhase = this.currentPhase === 'bulking' || this.currentPhase === 'reverse';
        if (isGainingPhase) {
            if (this.weightTrend === 'DECAY') return '▲';
            if (this.weightTrend === 'OPTIMAL') return '▼';
            return '—';
        }
        if (this.weightTrend === 'OPTIMAL') return '▼';
        if (this.weightTrend === 'DECAY') return '▲';
        return '—';
    }

    get healthTrendClass() {
        if (this.currentPhase === 'maintenance') return 'chevron trend-neutral';
        const isGainingPhase = this.currentPhase === 'bulking' || this.currentPhase === 'reverse';
        if (isGainingPhase) {
            if (this.weightTrend === 'DECAY') return 'chevron trend-optimal';
            if (this.weightTrend === 'OPTIMAL') return 'chevron trend-decay';
            return 'chevron trend-neutral';
        }
        if (this.weightTrend === 'OPTIMAL') return 'chevron trend-optimal';
        if (this.weightTrend === 'DECAY') return 'chevron trend-decay';
        return 'chevron trend-neutral';
    }

    // Progress Badge Styling
    getPillClass(progress) {
        if (progress >= 80) return 'trend-pill pill-active';
        if (progress >= 50) return 'trend-pill pill-momentum';
        return 'trend-pill pill-neutral';
    }

    get financialProgressPillClass() {
        return this.getPillClass(this.financialProgress);
    }

    get healthProgressPillClass() {
        return this.getPillClass(this.healthProgress);
    }
}