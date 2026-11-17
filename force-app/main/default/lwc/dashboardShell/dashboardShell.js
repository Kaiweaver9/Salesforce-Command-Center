import { LightningElement } from 'lwc';

export default class DashboardShell extends LightningElement {
    activeView = 'dashboard';
    isPrivacyMode = false;

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
}