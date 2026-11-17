import { LightningElement, api, wire } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import CHARTJS from '@salesforce/resourceUrl/ChartJS';
import getDashboardMetrics from '@salesforce/apex/DashboardController.getDashboardMetrics';
import getHealthHistory from '@salesforce/apex/DashboardController.getHealthHistory';
import getFinancialHistory from '@salesforce/apex/DashboardController.getFinancialHistory';
import getMetricStats from '@salesforce/apex/DashboardController.getMetricStats';

export default class MainChartHub extends LightningElement {
    @api isPrivacyMode = false;

    chartView = 'HEALTH';
    activeMetric = 'WEIGHT';
    timeframe = '7D';

    currentPhase = 'maintenance';
    currentPhaseWeek = null;
    totalPhaseWeeks = null;
    goalTarget = 0;
    totalNetWorth = 0;

    statAvg = '—';
    statMin = '—';
    statMax = '—';
    finIncome = '—';
    finExpenses = '—';
    netIncomeAmount = '—';
    netWorthDelta = '—';
    isPositiveDelta = true;

    healthHistory = [];
    financialHistory = [];
    chartJsLoaded = false;
    chartLoadStarted = false;
    chartInstance = null;

    getLocalTodayString() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    @wire(getDashboardMetrics)
    wiredMetrics({ error, data }) {
        if (data) {
            this.currentPhase = data.currentPhase || 'maintenance';
            this.currentPhaseWeek = data.currentPhaseWeek || null;
            this.totalPhaseWeeks = data.totalPhaseWeeks || null;
            this.goalTarget = data.healthTarget || 0;
            this.totalNetWorth = data.totalNetWorth || 0;
            this.tryRenderChart();
        } else if (error) {
            console.error('wiredMetrics error:', error);
        }
    }

    @wire(getHealthHistory)
    wiredHealth({ error, data }) {
        if (data) {
            const todayStr = this.getLocalTodayString();
            this.healthHistory = data.filter(item => item.Entry_Date__c && item.Entry_Date__c <= todayStr);
            if (this.chartView === 'HEALTH') {
                this.tryRenderChart();
            }
        } else if (error) {
            console.error('wiredHealth error:', error);
        }
    }

    @wire(getFinancialHistory)
    wiredFinancial({ error, data }) {
        if (data) {
            const todayStr = this.getLocalTodayString();
            this.financialHistory = data.filter(item => item.entryDate && item.entryDate <= todayStr);
            this.calculateCurrentMonthFinancials();
            if (this.chartView === 'FINANCIAL') {
                this.tryRenderChart();
            }
        } else if (error) {
            console.error('wiredFinancial error:', error);
        }
    }

    @wire(getMetricStats, { node: '$chartView', metric: '$activeMetric', timeframe: '$timeframe' })
    wiredStats({ error, data }) {
        if (data && this.chartView === 'HEALTH') {
            this.statAvg = data.avg;
            this.statMin = data.min;
            this.statMax = data.max;
        } else if (error) {
            console.error('wiredStats error:', error);
        }
    }

    renderedCallback() {
        if (this.chartLoadStarted) {
            return;
        }
        this.chartLoadStarted = true;

        loadScript(this, CHARTJS)
            .then(() => {
                this.chartJsLoaded = true;
                this.tryRenderChart();
            })
            .catch(error => {
                console.error('ChartJS loadScript failed:', error);
            });
    }

    disconnectedCallback() {
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }
        this.hideCustomTooltip();
    }

    tryRenderChart() {
        if (!this.chartJsLoaded) {
            return;
        }
        Promise.resolve().then(() => {
            this.renderActiveChart();
        });
    }

    get isHealthView() {
        return this.chartView === 'HEALTH';
    }

    get isNetWorthMetric() {
        return this.chartView === 'FINANCIAL' && this.activeMetric === 'NET WORTH';
    }

    get showDailyFilters() {
        return !(this.chartView === 'FINANCIAL' && this.activeMetric === 'CASH FLOW');
    }

    get btn7DClass() {
        return this.timeframe === '7D' ? 'filter-pill active' : 'filter-pill';
    }

    get btn30DClass() {
        return this.timeframe === '30D' ? 'filter-pill active' : 'filter-pill';
    }

    get btnYTDClass() {
        return this.timeframe === 'YTD' ? 'filter-pill active' : 'filter-pill';
    }

    get currentPhaseUpper() {
        return (this.currentPhase || 'MAINTENANCE').toUpperCase();
    }

    get isCuttingPhase() {
        const p = this.currentPhaseUpper;
        return p === 'CUTTING' || p === 'MINI-CUT' || p === 'MINICUT';
    }

    get phaseWeekLabel() {
        if (!this.currentPhaseWeek) {
            return '';
        }
        return this.totalPhaseWeeks
            ? `• WEEK ${this.currentPhaseWeek} OF ${this.totalPhaseWeeks}`
            : `• WEEK ${this.currentPhaseWeek}`;
    }

    get phaseTextClass() {
        return this.currentPhaseUpper === 'MAINTENANCE' ? 'phase-muted' : 'phase-active';
    }

    get phaseArrowIcon() {
        const p = this.currentPhaseUpper;
        if (this.isCuttingPhase) return '▼';
        if (p === 'BULKING') return '▲';
        if (p === 'REVERSE') return '►';
        return '━';
    }

    get phaseArrowClass() {
        const p = this.currentPhaseUpper;
        if (this.isCuttingPhase) return 'arrow-red';
        if (p === 'BULKING') return 'arrow-green';
        if (p === 'REVERSE') return 'arrow-blue';
        return 'arrow-muted';
    }

    get currentMonthLabel() {
        const now = new Date();
        return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    }

    get formattedNetWorth() {
        const prefix = this.totalNetWorth < 0 ? '-$' : '$';
        return prefix + Math.abs(this.totalNetWorth).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    get displayNetWorthDelta() {
        return this.isPrivacyMode ? '••••' : this.netWorthDelta;
    }

    get netWorthDeltaClass() {
        return this.isPositiveDelta ? 'hud-main-value arrow-green' : 'hud-main-value arrow-red';
    }

    get displayFinIncome() {
        return this.isPrivacyMode ? '••••' : this.finIncome;
    }

    get displayFinExpenses() {
        return this.isPrivacyMode ? '••••' : this.finExpenses;
    }

    handleChartToggle(event) {
        const selectedView = event.detail.value;
        this.chartView = selectedView;
        if (selectedView === 'HEALTH') {
            this.activeMetric = 'WEIGHT';
            this.timeframe = '7D';
        } else {
            this.activeMetric = 'CASH FLOW';
            this.timeframe = 'YTD';
        }
        this.hideCustomTooltip();
        this.tryRenderChart();
    }

    handleMetricChange(event) {
        this.activeMetric = event.detail.value;
        if (this.chartView === 'FINANCIAL' && this.activeMetric === 'CASH FLOW') {
            this.timeframe = 'YTD';
        }
        this.hideCustomTooltip();
        this.tryRenderChart();
    }

    handleTimeframeChange(event) {
        this.timeframe = event.currentTarget.dataset.timeframe;
        this.hideCustomTooltip();
        this.tryRenderChart();
    }

    calculateCurrentMonthFinancials() {
        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        let totalIncome = 0;
        let totalExpenses = 0;

        this.financialHistory.forEach(trans => {
            if (trans.entryDate && trans.type !== 'Snapshot') {
                const parts = trans.entryDate.split('-');
                const yr = parseInt(parts[0], 10);
                const mo = parseInt(parts[1], 10);
                if (yr === currentYear && mo === currentMonth) {
                    if (trans.amount > 0) totalIncome += trans.amount;
                    else if (trans.amount < 0) totalExpenses += Math.abs(trans.amount);
                }
            }
        });

        const net = totalIncome - totalExpenses;
        const fmt = val => '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        this.finIncome = fmt(totalIncome);
        this.finExpenses = fmt(totalExpenses);
        this.netIncomeAmount = (net >= 0 ? '$' : '-$') + Math.abs(net).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    /* --- UNIFIED CUSTOM GLASSMORPHIC TOOLTIP --- */
    getOrCreateTooltipEl(borderColor) {
        const container = this.template.querySelector('.canvas-container');
        if (!container) return null;

        let tooltipEl = container.querySelector('.lwc-custom-chart-tooltip');
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.className = 'lwc-custom-chart-tooltip';
            Object.assign(tooltipEl.style, {
                position: 'absolute',
                background: 'rgba(11, 14, 17, 0.96)',
                borderRadius: '6px',
                color: '#ffffff',
                padding: '9px 12px',
                fontFamily: "'Segoe UI', Roboto, sans-serif",
                zIndex: '20',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.85)',
                pointerEvents: 'none',
                transition: 'opacity 0.12s ease',
                whiteSpace: 'nowrap',
                opacity: '0'
            });
            container.appendChild(tooltipEl);
        }
        tooltipEl.style.border = `1px solid ${borderColor}`;
        return tooltipEl;
    }

    hideCustomTooltip() {
        const container = this.template.querySelector('.canvas-container');
        if (!container) return;
        const tooltipEl = container.querySelector('.lwc-custom-chart-tooltip');
        if (tooltipEl) {
            tooltipEl.style.opacity = '0';
        }
    }

    renderCustomTooltip(context, borderColor, fullDateLabels, rowFormatter) {
        const tooltipModel = context.tooltip;
        const tooltipEl = this.getOrCreateTooltipEl(borderColor);
        if (!tooltipEl) return;

        if (!tooltipModel || tooltipModel.opacity === 0 || !tooltipModel.dataPoints || tooltipModel.dataPoints.length === 0) {
            tooltipEl.style.opacity = '0';
            return;
        }

        const index = tooltipModel.dataPoints[0].dataIndex;
        const headerText = (fullDateLabels[index] || '').toUpperCase();
        const rowsHtml = rowFormatter(tooltipModel.dataPoints);

        tooltipEl.innerHTML = `
            <div style="color:#8b949e; font-size:8px; font-weight:600; letter-spacing:1.5px; margin-bottom:4px;">${headerText}</div>
            ${rowsHtml}
        `;
        tooltipEl.style.opacity = '1';

        const canvasEl = context.chart.canvas;
        const tWidth = tooltipEl.offsetWidth || 130;
        const tHeight = tooltipEl.offsetHeight || 46;
        let left = canvasEl.offsetLeft + tooltipModel.caretX + 12;
        if (left + tWidth > canvasEl.offsetLeft + canvasEl.offsetWidth - 8) {
            left = canvasEl.offsetLeft + tooltipModel.caretX - tWidth - 12;
        }
        if (left < canvasEl.offsetLeft + 6) {
            left = canvasEl.offsetLeft + 6;
        }

        let top = canvasEl.offsetTop + tooltipModel.caretY - (tHeight / 2);
        if (top < 42) top = 42;
        if (top + tHeight > canvasEl.offsetTop + canvasEl.offsetHeight - 6) {
            top = canvasEl.offsetTop + canvasEl.offsetHeight - tHeight - 6;
        }

        tooltipEl.style.left = `${left}px`;
        tooltipEl.style.top = `${top}px`;
    }

    renderActiveChart() {
        const ChartConstructor = window.Chart;
        if (!ChartConstructor) return;

        const canvas = this.template.querySelector('canvas.main-canvas');
        if (!canvas) return;

        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }

        if (this.chartView === 'HEALTH') {
            this.renderHealthGraph(canvas, ChartConstructor);
        } else if (this.activeMetric === 'NET WORTH') {
            this.renderNetWorthGraph(canvas, ChartConstructor);
        } else {
            this.renderCashFlowGraph(canvas, ChartConstructor);
        }
    }

    renderHealthGraph(canvas, ChartConstructor) {
        const fieldsMap = {
            'TDEE': 'TDEE__c',
            'CALORIES': 'Calories__c',
            'PROTEIN': 'Protein_g__c',
            'CARBS': 'Carbs_g__c',
            'FAT': 'Fat_g__c',
            'BODY FAT': 'Body_Fat__c',
            'WEIGHT': 'Weight_lbs__c'
        };

        const targetField = fieldsMap[this.activeMetric] || 'Weight_lbs__c';
        let cleaned = this.healthHistory.filter(h => h[targetField] != null);
        if (cleaned.length === 0) return;

        let labels = [];
        let fullDateLabels = [];
        let dataPoints = [];
        let targetLineValue = null;
        const chartColor = '#2596be';
        const phaseLower = (this.currentPhase || '').toLowerCase();

        if (this.timeframe === 'YTD') {
            const monthly = {};
            cleaned.forEach(h => {
                const m = parseInt(h.Entry_Date__c.split('-')[1], 10);
                if (!monthly[m]) monthly[m] = { sum: 0, count: 0 };
                monthly[m].sum += h[targetField];
                monthly[m].count++;
            });
            const sorted = Object.keys(monthly).sort((a, b) => a - b);
            const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
            const shortMonths = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
            labels = sorted.map(m => shortMonths[parseInt(m, 10) - 1]);
            fullDateLabels = sorted.map(m => months[parseInt(m, 10) - 1]);
            dataPoints = sorted.map(m => monthly[m].sum / monthly[m].count);
        } else {
            const count = this.timeframe === '7D' ? 7 : 30;
            cleaned = cleaned.slice(Math.max(cleaned.length - count, 0));
            dataPoints = cleaned.map(h => h[targetField]);
            fullDateLabels = cleaned.map(h => {
                const p = h.Entry_Date__c.split('-');
                return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
            });
            let lastMonth = null;
            labels = cleaned.map((h, idx) => {
                const p = h.Entry_Date__c.split('-');
                const d = new Date(p[0], p[1] - 1, p[2]);
                const mo = d.getMonth() + 1;
                const dy = d.getDate();
                if (idx === 0 || mo !== lastMonth) {
                    lastMonth = mo;
                    return `${mo}/${dy}`;
                }
                return dy.toString();
            });
        }

        if (this.activeMetric === 'WEIGHT' && ['cutting', 'mini-cut', 'minicut', 'bulking', 'reverse'].includes(phaseLower) && this.goalTarget > 0) {
            targetLineValue = this.goalTarget;
        }

        const isWeight = this.activeMetric === 'WEIGHT';
        const isDiscreteView = (this.timeframe === '7D' || this.timeframe === 'YTD');

        const yOptions = {
            grid: { display: false, drawBorder: false },
            ticks: {
                color: '#8b949e',
                font: { size: 9 },
                padding: 8,
                maxTicksLimit: 6,
                precision: this.activeMetric === 'BODY FAT' ? 1 : 0
            }
        };

        if (isWeight) {
            const minW = Math.min(...dataPoints);
            const maxW = Math.max(...dataPoints);
            yOptions.min = Math.floor(minW - 2);
            yOptions.max = Math.ceil((targetLineValue ? Math.max(maxW, targetLineValue) : maxW) + 2);
        } else {
            yOptions.grace = '12%';
        }

        const datasets = [{
            label: this.activeMetric,
            data: dataPoints,
            borderColor: chartColor,
            borderWidth: 2,
            fill: false,
            tension: isDiscreteView ? 0 : 0.38,
            pointRadius: isDiscreteView ? 4.5 : 0,
            pointHoverRadius: 6,
            pointBackgroundColor: '#0b0e11',
            pointBorderColor: chartColor,
            pointBorderWidth: 2,
            pointHoverBackgroundColor: '#84ff33',
            pointHoverBorderColor: '#0b0e11',
            pointHoverBorderWidth: 2,
            spanGaps: true
        }];

        const glowingGoalPlugin = {
            id: 'glowingGoalLine',
            afterDatasetsDraw(chart) {
                if (!targetLineValue) return;
                const yScale = chart.scales.y || chart.scales['y-axis-0'];
                const xScale = chart.scales.x || chart.scales['x-axis-0'];
                if (!yScale || !xScale) return;

                const yPos = yScale.getPixelForValue(targetLineValue);
                const left = xScale.left;
                const right = xScale.right;
                const ctx = chart.ctx;

                ctx.save();
                ctx.beginPath();
                ctx.moveTo(left, yPos);
                ctx.lineTo(right, yPos);
                ctx.lineWidth = 1.25;
                ctx.strokeStyle = 'rgba(132, 255, 51, 0.85)';
                ctx.shadowColor = 'rgba(132, 255, 51, 0.9)';
                ctx.shadowBlur = 10;
                ctx.stroke();

                const tagText = `GOAL · ${targetLineValue}`;
                ctx.shadowBlur = 0;
                ctx.font = "700 8px 'Segoe UI', Roboto, sans-serif";
                const textWidth = ctx.measureText(tagText).width;
                const pillPadX = 6;
                const pillW = textWidth + (pillPadX * 2);
                const pillH = 14;
                const pillX = right - pillW;
                const pillY = yPos - pillH - 4;

                ctx.fillStyle = 'rgba(11, 14, 17, 0.92)';
                ctx.strokeStyle = 'rgba(132, 255, 51, 0.55)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(pillX, pillY, pillW, pillH, 3) : ctx.rect(pillX, pillY, pillW, pillH);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#84ff33';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(tagText, pillX + pillPadX, pillY + (pillH / 2) + 0.5);
                ctx.restore();
            }
        };

        const activeMetricLabel = this.activeMetric;

        this.chartInstance = new ChartConstructor(canvas, {
            type: 'line',
            data: { labels, datasets },
            plugins: [glowingGoalPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 44, bottom: 6, left: 2, right: 8 } },
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: context => {
                            this.renderCustomTooltip(context, 'rgba(37, 150, 190, 0.7)', fullDateLabels, points => {
                                const dp = points[0];
                                const rawVal = dp.raw !== undefined ? dp.raw : dp.parsed.y;
                                const unit = isWeight ? ' LBS' : (['CALORIES', 'TDEE'].includes(activeMetricLabel) ? ' KCAL' : (activeMetricLabel === 'BODY FAT' ? '%' : 'G'));
                                const val = (isWeight || activeMetricLabel === 'BODY FAT') ? Number(rawVal).toFixed(1) : Math.round(rawVal);
                                return `<div style="color:#ffffff; font-size:11px; font-weight:600;">${activeMetricLabel}: <span style="color:#2596be;">${val}${unit}</span></div>`;
                            });
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: {
                            color: '#8b949e',
                            font: { size: 9 },
                            padding: 6,
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: this.timeframe === '7D' ? 7 : 12
                        }
                    },
                    y: yOptions
                }
            }
        });
    }

    renderCashFlowGraph(canvas, ChartConstructor) {
        if (!this.financialHistory || this.financialHistory.length === 0) return;

        const ctx = canvas.getContext('2d');
        const incomeGradient = ctx.createLinearGradient(0, 0, 0, 280);
        incomeGradient.addColorStop(0, '#84ff33');
        incomeGradient.addColorStop(1, 'rgba(132, 255, 51, 0.12)');

        const expenseGradient = ctx.createLinearGradient(0, 0, 0, 280);
        expenseGradient.addColorStop(0, '#2596be');
        expenseGradient.addColorStop(1, 'rgba(37, 150, 190, 0.12)');

        const labels = [];
        const fullDateLabels = [];
        const incomeData = [];
        const expenseData = [];

        const monthly = {};
        this.financialHistory.forEach(t => {
            if (t.entryDate && t.type !== 'Snapshot') {
                const m = parseInt(t.entryDate.split('-')[1], 10);
                if (!monthly[m]) monthly[m] = { income: 0, expenses: 0 };
                if (t.amount > 0) monthly[m].income += t.amount;
                else if (t.amount < 0) monthly[m].expenses += Math.abs(t.amount);
            }
        });

        const sorted = Object.keys(monthly).sort((a, b) => a - b);
        const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
        const shortMonths = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

        sorted.forEach(m => {
            const idx = parseInt(m, 10) - 1;
            labels.push(shortMonths[idx]);
            fullDateLabels.push(months[idx]);
            incomeData.push(monthly[m].income);
            expenseData.push(monthly[m].expenses);
        });

        this.chartInstance = new ChartConstructor(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'INCOME', data: incomeData, backgroundColor: incomeGradient, hoverBackgroundColor: '#84ff33', borderRadius: 4, barPercentage: 0.7, categoryPercentage: 0.45 },
                    { label: 'EXPENSES', data: expenseData, backgroundColor: expenseGradient, hoverBackgroundColor: '#2596be', borderRadius: 4, barPercentage: 0.7, categoryPercentage: 0.45 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 44, bottom: 6, left: 2, right: 8 } },
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: context => {
                            this.renderCustomTooltip(context, 'rgba(132, 255, 51, 0.65)', fullDateLabels, points => {
                                return points.map(dp => {
                                    const rawVal = dp.raw !== undefined ? dp.raw : dp.parsed.y;
                                    const label = dp.datasetIndex === 0 ? 'INCOME' : 'EXPENSES';
                                    const color = dp.datasetIndex === 0 ? '#84ff33' : '#2596be';
                                    const valStr = this.isPrivacyMode
                                        ? '••••'
                                        : '$' + Number(rawVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                    return `<div style="color:${color}; font-size:10px; font-weight:600; margin-top:2px;">${label}: ${valStr}</div>`;
                                }).join('');
                            });
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false, drawBorder: false }, ticks: { color: '#8b949e', font: { size: 9 }, padding: 6 } },
                    y: { grid: { display: false, drawBorder: false }, beginAtZero: true, ticks: { color: '#8b949e', font: { size: 9 }, padding: 8 } }
                }
            }
        });
    }

    renderNetWorthGraph(canvas, ChartConstructor) {
        const ctx = canvas.getContext('2d');
        const areaGradient = ctx.createLinearGradient(0, 0, 0, 260);
        areaGradient.addColorStop(0, 'rgba(132, 255, 51, 0.22)');
        areaGradient.addColorStop(1, 'rgba(37, 150, 190, 0.0)');

        const snapshots = this.financialHistory.filter(t => t.type === 'Snapshot');
        let series = [];

        if (snapshots.length > 0) {
            series = snapshots.map(s => ({ date: s.entryDate, value: s.amount }));
        } else {
            const dailyNet = {};
            this.financialHistory.forEach(t => {
                if (t.entryDate) {
                    dailyNet[t.entryDate] = (dailyNet[t.entryDate] || 0) + (t.amount || 0);
                }
            });
            const sortedDates = Object.keys(dailyNet).sort();
            const totalLedgerSum = sortedDates.reduce((acc, d) => acc + dailyNet[d], 0);
            let runningValue = this.totalNetWorth - totalLedgerSum;

            sortedDates.forEach(d => {
                runningValue += dailyNet[d];
                series.push({ date: d, value: runningValue });
            });
        }

        if (series.length === 0) return;

        let labels = [];
        let fullDateLabels = [];
        let dataPoints = [];

        if (this.timeframe === 'YTD') {
            const monthlyEnd = {};
            series.forEach(pt => {
                const m = parseInt(pt.date.split('-')[1], 10);
                monthlyEnd[m] = pt.value;
            });
            const sorted = Object.keys(monthlyEnd).sort((a, b) => a - b);
            const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
            const shortMonths = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
            sorted.forEach(m => {
                const idx = parseInt(m, 10) - 1;
                labels.push(shortMonths[idx]);
                fullDateLabels.push(months[idx]);
                dataPoints.push(monthlyEnd[m]);
            });
        } else {
            const count = this.timeframe === '7D' ? 7 : 30;
            const sliced = series.slice(Math.max(series.length - count, 0));
            let lastMonth = null;
            sliced.forEach((pt, idx) => {
                const p = pt.date.split('-');
                const d = new Date(p[0], p[1] - 1, p[2]);
                const mo = d.getMonth() + 1;
                const dy = d.getDate();
                labels.push(idx === 0 || mo !== lastMonth ? `${mo}/${dy}` : dy.toString());
                lastMonth = mo;
                fullDateLabels.push(d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }));
                dataPoints.push(pt.value);
            });
        }

        if (dataPoints.length >= 2) {
            const delta = dataPoints[dataPoints.length - 1] - dataPoints[0];
            this.isPositiveDelta = delta >= 0;
            const sign = delta >= 0 ? '+$' : '-$';
            this.netWorthDelta = sign + Math.abs(delta).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        } else {
            this.isPositiveDelta = true;
            this.netWorthDelta = '$0.00';
        }

        const isDiscreteView = (this.timeframe === '7D' || this.timeframe === 'YTD');

        this.chartInstance = new ChartConstructor(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'NET WORTH',
                    data: dataPoints,
                    borderColor: '#84ff33',
                    borderWidth: 2,
                    fill: true,
                    backgroundColor: areaGradient,
                    tension: 0.3,
                    pointRadius: isDiscreteView ? 4.5 : 0,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#0b0e11',
                    pointBorderColor: '#84ff33',
                    pointBorderWidth: 2,
                    pointHoverBackgroundColor: '#2596be',
                    pointHoverBorderColor: '#0b0e11',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 44, bottom: 6, left: 2, right: 8 } },
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: context => {
                            this.renderCustomTooltip(context, 'rgba(132, 255, 51, 0.65)', fullDateLabels, points => {
                                const dp = points[0];
                                const rawVal = Number(dp.raw !== undefined ? dp.raw : dp.parsed.y);
                                if (this.isPrivacyMode) {
                                    return `<div style="color:#ffffff; font-size:11px; font-weight:600;">NET WORTH: <span style="color:#84ff33;">••••</span></div>`;
                                }
                                const prefix = rawVal < 0 ? '-$' : '$';
                                const formatted = `${prefix}${Math.abs(rawVal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                return `<div style="color:#ffffff; font-size:11px; font-weight:600;">NET WORTH: <span style="color:#84ff33;">${formatted}</span></div>`;
                            });
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false, drawBorder: false }, ticks: { color: '#8b949e', font: { size: 9 }, padding: 6, autoSkip: true, maxTicksLimit: 12 } },
                    y: { grid: { display: false, drawBorder: false }, ticks: { color: '#8b949e', font: { size: 9 }, padding: 8 } }
                }
            }
        });
    }
}