import { LightningElement } from 'lwc';
import archiveDashboardGoal from '@salesforce/apex/DashboardController.archiveDashboardGoal';
import activateQueuedGoal from '@salesforce/apex/DashboardController.activateQueuedGoal';

const CONFETTI_COLORS = ['#84ff33', '#2596be', '#3fb27f', '#f3ff33', '#ffffff'];

export default class DashboardShell extends LightningElement {
    activeView = 'dashboard';
    isPrivacyMode = false;

    // Celebration / Phase Transition Modal State
    isGoalModalOpen = false;
    isModalBusy = false;
    modalPayload = null;
    selectedQueuedGoalId = null;

    handleNavigate(event) {
        this.activeView = event.detail.viewId;
    }

    handlePrivacyToggle(event) {
        this.isPrivacyMode = event.detail.isChecked;
    }

    get isDashboardView() {
        return this.activeView === 'dashboard';
    }

    get activeViewLabel() {
        const viewTitles = {
            profile: 'Profile Statistics',
            goals: 'Current Goals',
            tasks: 'Upcoming Tasks',
            financial: 'Financial Intelligence',
            health: 'Health Intelligence',
            performance: 'Performance Index',
            calculator: 'Paycheck Calculator',
            resources: 'External Resources',
            projects: 'Projects',
            theme: 'Theme',
            settings: 'Settings'
        };
        return viewTitles[this.activeView] || this.activeView;
    }

    // Triggered automatically when goalProjectionWidget hits 0 days / 100% target
    handleGoalCompleted(event) {
        const detail = event.detail || {};
        this.modalPayload = {
            ...detail,
            isQuickPickerOnly: false
        };
        this.selectedQueuedGoalId = null;
        this.isGoalModalOpen = true;
    }

    // Triggered when user clicks "+ SET NEXT GOAL" on the pulsating Victory Lap card
    handleOpenSetGoal(event) {
        const detail = event.detail || {};
        const queued = Array.isArray(detail.queuedGoals) ? detail.queuedGoals : [];
        this.modalPayload = {
            goalId: null,
            goalLabel: `${detail.goalType || 'NEXT'} GOAL`,
            goalType: detail.goalType || 'HEALTH',
            mode: 'SET_NEXT',
            queuedGoals: queued,
            isQuickPickerOnly: true
        };
        this.selectedQueuedGoalId = null;
        this.isGoalModalOpen = true;
    }

    get isPhaseCompletedMode() {
        return this.modalPayload?.mode === 'PHASE_COMPLETED';
    }

    get isQuickPickerMode() {
        return Boolean(this.modalPayload?.isQuickPickerOnly);
    }

    get canArchiveGoal() {
        return Boolean(this.modalPayload?.goalId) && !this.isQuickPickerMode;
    }

    get showConfetti() {
        return this.isGoalModalOpen && this.modalPayload?.mode === 'TARGET_REACHED';
    }

    get confettiPieces() {
        return Array.from({ length: 28 }, (_, idx) => {
            const leftPct = (idx * 3.7) % 100;
            const delaySec = ((idx % 7) * 0.14).toFixed(2);
            const durationSec = (2.4 + (idx % 5) * 0.35).toFixed(2);
            const color = CONFETTI_COLORS[idx % CONFETTI_COLORS.length];
            const rotateDeg = (idx * 47) % 360;
            return {
                id: `confetti-${idx}`,
                style: `left: ${leftPct}%; background-color: ${color}; animation-delay: ${delaySec}s; animation-duration: ${durationSec}s; transform: rotate(${rotateDeg}deg);`
            };
        });
    }

    get goalModalCardClass() {
        return this.isPhaseCompletedMode
            ? 'goal-modal-card phase-complete-theme'
            : 'goal-modal-card target-reached-theme';
    }

    get modalBadgeClass() {
        return this.isPhaseCompletedMode
            ? 'modal-status-badge badge-phase'
            : 'modal-status-badge badge-target';
    }

    get modalBadgeText() {
        if (this.isQuickPickerMode) return 'NEXT TARGET';
        return this.isPhaseCompletedMode ? 'PHASE COMPLETE' : 'GOAL ACHIEVED';
    }

    get activeModalGoalLabel() {
        return this.modalPayload?.goalLabel || '';
    }

    get modalHeadline() {
        if (this.isQuickPickerMode) {
            return 'Select Your Next Goal';
        }
        if (this.isPhaseCompletedMode) {
            const phaseRaw = (this.modalPayload?.currentPhase || 'phase').replace(/-/g, ' ');
            const formattedPhase = phaseRaw.replace(/\b\w/g, ch => ch.toUpperCase());
            const days = Number(this.modalPayload?.phaseDurationDays || 0);
            if (days > 0 && days % 7 === 0) {
                const weeks = days / 7;
                return `Your ${weeks}-Week ${formattedPhase} Has Ended`;
            }
            if (days > 0) {
                return `Your ${days}-Day ${formattedPhase} Has Ended`;
            }
            return `Your ${formattedPhase} Phase Has Ended`;
        }
        return 'Congratulations — Target Reached!';
    }

    get modalSubtext() {
        if (this.isQuickPickerMode) {
            return 'Choose a pre-queued goal below or open Current Goals to configure a new target.';
        }
        if (this.isPhaseCompletedMode) {
            return 'Your scheduled phase window has reached zero days remaining.';
        }
        const label = this.modalPayload?.goalLabel || 'your goal';
        return `You hit 100% completion on ${label}.`;
    }

    get queuedGoalItems() {
        const list = this.modalPayload?.queuedGoals || [];
        return list.map(item => {
            const isSelected = item.id === this.selectedQueuedGoalId;
            const metaParts = [];
            if (item.currentPhase) metaParts.push(item.currentPhase.toUpperCase());
            if (item.phaseDurationDays) metaParts.push(`${item.phaseDurationDays}D`);
            if (item.goalTarget) {
                metaParts.push(
                    (item.goalType || '').toUpperCase() === 'FINANCIAL'
                        ? `$${Number(item.goalTarget).toLocaleString()}`
                        : `${item.goalTarget} LBS`
                );
            }
            return {
                id: item.id,
                name: item.name,
                metaLabel: metaParts.join(' • ') || 'QUEUED',
                itemClass: isSelected ? 'queued-item selected' : 'queued-item'
            };
        });
    }

    get hasQueuedGoals() {
        return this.queuedGoalItems.length > 0;
    }

    get primaryButtonLabel() {
        if (this.isModalBusy) return 'Updating...';
        if (this.selectedQueuedGoalId) {
            return 'Select Goal';
        }
        return 'Create New Goal';
    }

    handleSelectQueuedGoal(event) {
        const clickedId = event.currentTarget.dataset.id;
        this.selectedQueuedGoalId = this.selectedQueuedGoalId === clickedId ? null : clickedId;
    }

    async handlePrimarySetNewGoal() {
        if (!this.modalPayload) return;
        this.isModalBusy = true;

        try {
            const completedGoalId = this.modalPayload.goalId || null;
            const nextGoalId = this.selectedQueuedGoalId || null;
            const goalType = (this.modalPayload.goalType || 'HEALTH').toUpperCase();

            if (nextGoalId) {
                await activateQueuedGoal({ completedGoalId, nextGoalId });
                this.clearVictoryLapStorage(goalType);
                this.isGoalModalOpen = false;
                this.modalPayload = null;
                await this.refreshProjectionWidget();
            } else {
                if (completedGoalId) {
                    await archiveDashboardGoal({ goalId: completedGoalId });
                }
                this.clearVictoryLapStorage(goalType);
                this.isGoalModalOpen = false;
                this.modalPayload = null;
                this.activeView = 'goals';
            }
        } catch (err) {
            console.error('Error setting next goal:', err);
        } finally {
            this.isModalBusy = false;
        }
    }

    async handleNotRightNow() {
        if (!this.modalPayload?.goalId) {
            this.isGoalModalOpen = false;
            return;
        }
        this.isModalBusy = true;

        try {
            const goalType = (this.modalPayload.goalType || 'HEALTH').toUpperCase();
            await archiveDashboardGoal({ goalId: this.modalPayload.goalId });

            try {
                window.localStorage.setItem(
                    `victoryLap_${goalType}`,
                    JSON.stringify({
                        goalId: this.modalPayload.goalId,
                        goalLabel: this.modalPayload.goalLabel,
                        goalType,
                        mode: this.modalPayload.mode
                    })
                );
            } catch (e) {
                // Ignore storage limits
            }

            this.isGoalModalOpen = false;
            this.modalPayload = null;
            await this.refreshProjectionWidget();
        } catch (err) {
            console.error('Error archiving goal:', err);
        } finally {
            this.isModalBusy = false;
        }
    }

    handleDismissModal() {
        if (this.modalPayload?.goalId && this.modalPayload?.todayKey) {
            try {
                window.localStorage.setItem(
                    `dismissedGoal_${this.modalPayload.goalId}_${this.modalPayload.todayKey}`,
                    'true'
                );
            } catch (e) {
                // Ignore storage limits
            }
        }
        this.isGoalModalOpen = false;
        this.modalPayload = null;
    }

    clearVictoryLapStorage(goalType) {
        try {
            window.localStorage.removeItem(`victoryLap_${goalType}`);
        } catch (e) {
            // Ignore storage limits
        }
    }

    async refreshProjectionWidget() {
        const widget = this.template.querySelector('c-goal-projection-widget');
        if (widget && typeof widget.refresh === 'function') {
            await widget.refresh();
        }
    }
}