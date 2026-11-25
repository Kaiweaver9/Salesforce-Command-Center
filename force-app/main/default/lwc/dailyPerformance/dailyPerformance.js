import { LightningElement, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getTaskDashboardData from '@salesforce/apex/TaskDashboardController.getTaskDashboardData';
import toggleTaskCompletion from '@salesforce/apex/TaskDashboardController.toggleTaskCompletion';
import updateTaskAssignment from '@salesforce/apex/TaskDashboardController.updateTaskAssignment';

const CATEGORY_COLORS = {
    Financial: '#84ff33',
    Career: '#a855f7',
    Health: '#2596be',
    General: '#d0d7de'
};

export default class DailyPerformance extends LightningElement {
    @track activeSlide = 0;
    @track dayOffset = 0; // 0 = Today (green highlight); any +/- offset cycles infinitely
    @track isDataLoading = true;
    @track errorMessage;
    @track allTasks = [];
    @track activeGoals = [];
    @track todayIsoString;

    // Auto-expanding Apex query bounds as you cycle forward/backward
    @track windowMinOffset = -14;
    @track windowMaxOffset = 30;

    // Inline editor state
    @track editingTaskId = null;
    @track editingTaskSubject = '';
    @track selectedEditCategory = 'General';
    @track selectedEditGoalId = '';
    @track isSaving = false;

    // Tooltip state for Slide 2
    @track hoveredPointIndex = null;

    wiredTaskResult;

    get baseTodayDate() {
        if (this.todayIsoString) {
            const parts = this.todayIsoString.split('-');
            if (parts.length === 3) {
                return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            }
        }
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    get startDateParam() {
        const d = new Date(this.baseTodayDate);
        d.setDate(d.getDate() + this.windowMinOffset);
        return this.formatIsoDate(d);
    }

    get endDateParam() {
        const d = new Date(this.baseTodayDate);
        d.setDate(d.getDate() + this.windowMaxOffset);
        return this.formatIsoDate(d);
    }

    @wire(getTaskDashboardData, { startDate: '$startDateParam', endDate: '$endDateParam' })
    wiredTasks(result) {
        this.wiredTaskResult = result;
        const { data, error } = result;
        this.isDataLoading = false;

        if (data) {
            this.allTasks = data.tasks || [];
            this.activeGoals = data.goals || [];
            this.todayIsoString = data.today || this.formatIsoDate(new Date());
            this.errorMessage = undefined;
        } else if (error) {
            this.errorMessage = 'Unable to load daily execution data.';
            console.error('TaskDashboardController error:', error);
        }
    }

    // Slide & Date Navigation Getters
    get isSlideOne() {
        return this.activeSlide === 0;
    }

    get todayPillClass() {
        return this.dayOffset === 0 ? 'today-pill today-pill-active' : 'today-pill';
    }

    get selectedDateObj() {
        const d = new Date(this.baseTodayDate);
        d.setDate(d.getDate() + this.dayOffset);
        return d;
    }

    get selectedIsoDate() {
        return this.formatIsoDate(this.selectedDateObj);
    }

    get selectedDateFormattedLabel() {
        return this.selectedDateObj
            .toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            })
            .toUpperCase();
    }

    get emptyStateTitle() {
        return this.dayOffset === 0
            ? 'No tasks scheduled for today'
            : 'No tasks scheduled for this date';
    }

    // Slide 1: Tasks for Selected Date
    get displayedTasks() {
        const targetDate = this.selectedIsoDate;
        return this.allTasks
            .filter((task) => task.activityDate === targetDate)
            .map((task) => {
                const category = CATEGORY_COLORS[task.category] ? task.category : 'General';
                const colorHex = CATEGORY_COLORS[category];
                return {
                    ...task,
                    categoryLabel: category.toUpperCase(),
                    accentStyle: `background-color: ${colorHex};`,
                    badgeStyle: `color: ${colorHex}; border-color: ${colorHex}40; background-color: ${colorHex}14;`,
                    rowClass: task.isCompleted ? 'task-row task-row-completed' : 'task-row',
                    checkboxClass: task.isCompleted ? 'task-checkbox checked' : 'task-checkbox',
                    subjectClass: task.isCompleted ? 'task-subject completed-text' : 'task-subject'
                };
            });
    }

    get hasDisplayedTasks() {
        return this.displayedTasks.length > 0;
    }

    get totalCount() {
        return this.displayedTasks.length;
    }

    get completedCount() {
        return this.displayedTasks.filter((t) => t.isCompleted).length;
    }

    // Inline Goal & Color Editor Getters
    get isEditingTask() {
        return Boolean(this.editingTaskId);
    }

    get saveButtonLabel() {
        return this.isSaving ? 'Saving...' : 'Save';
    }

    get categoryOptions() {
        return Object.keys(CATEGORY_COLORS).map((key) => {
            const hex = CATEGORY_COLORS[key];
            const isSelected = this.selectedEditCategory === key;
            return {
                value: key,
                label: key,
                dotStyle: `background-color: ${hex};`,
                buttonClass: isSelected ? 'swatch-btn selected-swatch' : 'swatch-btn'
            };
        });
    }

    get goalSelectOptions() {
        return this.activeGoals.map((goal) => ({
            id: goal.id,
            name: goal.name,
            isSelected: goal.id === this.selectedEditGoalId
        }));
    }

    // Slide 2: 7-Day Dual-Line Trend Data
    get trendPoints() {
        const days = [];
        const baseDate = this.baseTodayDate;
        const chartWidth = 288;
        const startX = 16;
        const stepX = chartWidth / 6;

        for (let i = 6; i >= 0; i--) {
            const d = new Date(baseDate);
            d.setDate(baseDate.getDate() - i);
            const iso = this.formatIsoDate(d);
            const dayTasks = this.allTasks.filter((t) => t.activityDate === iso);
            const goalTasks = dayTasks.filter((t) => Boolean(t.goalId));

            const dailyDone = dayTasks.filter((t) => t.isCompleted).length;
            const dailyPct = dayTasks.length > 0 ? Math.round((dailyDone / dayTasks.length) * 100) : 0;

            const goalDone = goalTasks.filter((t) => t.isCompleted).length;
            const goalPct = goalTasks.length > 0 ? Math.round((goalDone / goalTasks.length) * 100) : dailyPct;

            const idx = 6 - i;
            const x = Math.round(startX + idx * stepX);
            const dailyY = Math.round(130 - (dailyPct / 100) * 110);
            const goalY = Math.round(130 - (goalPct / 100) * 110);

            days.push({
                index: idx,
                dateKey: iso,
                dayShort: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
                fullLabel: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                x,
                hitX: Math.max(0, x - stepX / 2),
                hitWidth: stepX,
                dailyY,
                goalY,
                dailyPct,
                goalPct,
                goalSummary: goalTasks.length > 0 ? `${goalDone}/${goalTasks.length} (${goalPct}%)` : 'No goal tasks',
                dailySummary: dayTasks.length > 0 ? `${dailyDone}/${dayTasks.length} (${dailyPct}%)` : '0 tasks'
            });
        }
        return days;
    }

    get goalPolylinePoints() {
        return this.trendPoints.map((p) => `${p.x},${p.goalY}`).join(' ');
    }

    get dailyPolylinePoints() {
        return this.trendPoints.map((p) => `${p.x},${p.dailyY}`).join(' ');
    }

    get latestGoalRate() {
        const pts = this.trendPoints;
        return pts.length ? pts[pts.length - 1].goalPct : 0;
    }

    get latestDailyRate() {
        const pts = this.trendPoints;
        return pts.length ? pts[pts.length - 1].dailyPct : 0;
    }

    get activeTooltip() {
        if (this.hoveredPointIndex === null) {
            return null;
        }
        const pt = this.trendPoints[this.hoveredPointIndex];
        if (!pt) {
            return null;
        }
        const leftPct = Math.min(62, Math.max(4, Math.round((pt.x / 320) * 100) - 18));
        return {
            label: pt.fullLabel,
            goalSummary: pt.goalSummary,
            dailySummary: pt.dailySummary,
            style: `left: ${leftPct}%;`
        };
    }

    // Event Handlers
    handleToggleSlide() {
        this.activeSlide = this.activeSlide === 0 ? 1 : 0;
        this.hoveredPointIndex = null;
        this.editingTaskId = null;
    }

    handleStepDay(event) {
        const step = Number(event.currentTarget.dataset.step);
        this.dayOffset += step;
        this.activeSlide = 0; // Ensure task list is visible when stepping dates

        if (this.dayOffset <= this.windowMinOffset + 2) {
            this.windowMinOffset = this.dayOffset - 14;
        } else if (this.dayOffset >= this.windowMaxOffset - 2) {
            this.windowMaxOffset = this.dayOffset + 30;
        }
    }

    handleResetToToday() {
        this.dayOffset = 0;
        this.activeSlide = 0;
    }

    handleOpenFullCalendar() {
        this.dispatchEvent(
            new CustomEvent('navigate', {
                detail: {
                    viewId: 'tasks',
                    date: this.selectedIsoDate
                },
                bubbles: true,
                composed: true
            })
        );
    }

    async handleToggleTask(event) {
        const taskId = event.currentTarget.dataset.id;
        const targetTask = this.allTasks.find((t) => t.id === taskId);
        if (!targetTask) {
            return;
        }
        const nextCompleted = !targetTask.isCompleted;

        this.allTasks = this.allTasks.map((t) =>
            t.id === taskId
                ? { ...t, isCompleted: nextCompleted, status: nextCompleted ? 'Completed' : 'Not Started' }
                : t
        );

        try {
            await toggleTaskCompletion({ taskId, isCompleted: nextCompleted });
            await refreshApex(this.wiredTaskResult);
        } catch (error) {
            console.error('Failed to update task status:', error);
            await refreshApex(this.wiredTaskResult);
        }
    }

    handleOpenEditor(event) {
        const taskId = event.currentTarget.dataset.id;
        const task = this.allTasks.find((t) => t.id === taskId);
        if (!task) {
            return;
        }
        this.editingTaskId = task.id;
        this.editingTaskSubject = task.subject;
        this.selectedEditCategory = CATEGORY_COLORS[task.category] ? task.category : 'General';
        this.selectedEditGoalId = task.goalId || '';
    }

    handleCloseEditor() {
        this.editingTaskId = null;
        this.editingTaskSubject = '';
    }

    handleSelectEditCategory(event) {
        this.selectedEditCategory = event.currentTarget.dataset.category;
    }

    handleSelectEditGoal(event) {
        this.selectedEditGoalId = event.target.value;
    }

    async handleSaveAssignment() {
        if (!this.editingTaskId) {
            return;
        }
        this.isSaving = true;
        try {
            await updateTaskAssignment({
                taskId: this.editingTaskId,
                goalId: this.selectedEditGoalId || null,
                category: this.selectedEditCategory
            });
            this.handleCloseEditor();
            await refreshApex(this.wiredTaskResult);
        } catch (error) {
            console.error('Failed to save task assignment:', error);
        } finally {
            this.isSaving = false;
        }
    }

    handlePointHover(event) {
        this.hoveredPointIndex = Number(event.currentTarget.dataset.index);
    }

    handleChartLeave() {
        this.hoveredPointIndex = null;
    }

    formatIsoDate(dateObj) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}