import { LightningElement, track } from 'lwc';
import COMMAND_CENTER_LOGO from '@salesforce/resourceUrl/CommandCenterLogo';

export default class SidebarNav extends LightningElement {
    logoUrl = COMMAND_CENTER_LOGO;

    @track currentDate = 'LOADING...';
    @track currentTime = 'LOADING...';
    @track activeIndicatorTop = 0;
    @track isHovered = false;
    @track activeNavItemId = 'dashboard';
    @track isMobileMenuOpen = false;

    connectedCallback() {
        this.calculateTimestamp();
        this.timerInterval = setInterval(() => {
            this.calculateTimestamp();
        }, 1000);
    }

    disconnectedCallback() {
        clearInterval(this.timerInterval);
    }

    calculateTimestamp() {
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        this.currentDate = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;

        let hours = now.getHours();
        let minutes = now.getMinutes();
        let seconds = now.getSeconds();
        const ampm = hours >= 12 ? 'PM' : 'AM';

        hours = hours % 12;
        hours = hours ? hours : 12;
        minutes = minutes < 10 ? '0' + minutes : minutes;
        seconds = seconds < 10 ? '0' + seconds : seconds;

        this.currentTime = `${hours}:${minutes}:${seconds} ${ampm}`;
    }

    getClass(id) {
        return this.activeNavItemId === id ? 'nav-item active-nav-green' : 'nav-item';
    }

    get profileStatsClass() { return this.getClass('profile'); }
    get currentGoalsClass() { return this.getClass('goals'); }
    get upcomingTasksClass() { return this.getClass('tasks'); }
    get dashboardClass() { return this.getClass('dashboard'); }
    get financialClass() { return this.getClass('financial'); }
    get healthClass() { return this.getClass('health'); }
    get performanceClass() { return this.getClass('performance'); }
    get calculatorClass() { return this.getClass('calculator'); }
    get resourcesClass() { return this.getClass('resources'); }
    get projectsClass() { return this.getClass('projects'); }
    get themeClass() { return this.getClass('theme'); }

    get sidebarContentClass() {
        return this.isMobileMenuOpen
            ? 'sidebar-content nav-list-container mobile-drawer-open'
            : 'sidebar-content nav-list-container';
    }

    get hamburgerLine1Class() {
        return this.isMobileMenuOpen ? 'hamburger-line line-1-open' : 'hamburger-line';
    }

    get hamburgerLine2Class() {
        return this.isMobileMenuOpen ? 'hamburger-line line-2-open' : 'hamburger-line';
    }

    get hamburgerLine3Class() {
        return this.isMobileMenuOpen ? 'hamburger-line line-3-open' : 'hamburger-line';
    }

    get indicatorStyling() {
        return {
            style: `transform: translateY(${this.activeIndicatorTop}px); opacity: ${this.isHovered ? '1' : '0'};`
        };
    }

    toggleMobileMenu() {
        this.isMobileMenuOpen = !this.isMobileMenuOpen;
    }

    handleMouseEnter(event) {
        const target = event.currentTarget;
        this.activeIndicatorTop = target.offsetTop;
        this.isHovered = true;
    }

    handleMouseLeave() {
        this.isHovered = false;
    }

    handleNavClick(event) {
        const selectedId = event.currentTarget.dataset.id;
        this.activeNavItemId = selectedId;

        if (this.isMobileMenuOpen) {
            this.isMobileMenuOpen = false;
        }

        this.dispatchEvent(new CustomEvent('navigate', {
            detail: { viewId: selectedId }
        }));
    }

    handlePrivacyToggle(event) {
        const isChecked = event.target.checked;
        this.dispatchEvent(new CustomEvent('privacytoggle', {
            detail: { isChecked }
        }));
    }
}