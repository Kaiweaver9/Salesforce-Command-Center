({
    /* --- DATA ORCHESTRATION --- */
    loadDashboardData : function(component) {
        var helper = this;

        var todayNode = new Date();
        var mm = ('0' + (todayNode.getMonth() + 1)).slice(-2);
        var dd = ('0' + todayNode.getDate()).slice(-2);
        var yyyy = todayNode.getFullYear();
        component.set("v.currentDate", mm + '.' + dd + '.' + yyyy);

        var action = component.get("c.getDashboardData");
        component.set("v.isLoaded", false);
        
        action.setCallback(this, function(response) {
            if (response.getState() === "SUCCESS") {
                var data = response.getReturnValue();
                
                let labels = data.indexLabels || [];
                let finHistory = data.finIndexHistory || [];
                let healthHistory = data.healthIndexHistory || [];

                labels.reverse();
                finHistory.reverse();
                healthHistory.reverse();
                
                if (data.upiTotal !== undefined) {
                    component.set("v.upiTotal", data.upiTotal);
                }
                
                component.set("v.finLabel", data.finLabel); 
                component.set("v.goalLabel", data.goalLabel);

                let activePhaseStr = 'maintenance';
                if (data.currentPhase) {
                    activePhaseStr = data.currentPhase.toLowerCase();
                    component.set("v.currentPhase", data.currentPhase.toUpperCase());
                }

                component.set("v.finTarget", data.finTarget);
                component.set("v.goalTarget", data.goalTarget);
                component.set("v.currentBalance", data.currentBalance);
                component.set("v.netWorth", data.netWorth);
                component.set("v.currentWeight", data.currentWeight);
                component.set("v.totalTrailheadPoints", data.totalTrailheadPoints);
                component.set("v.calories", data.calories || 0);
                component.set("v.protein", data.protein || 0);
                component.set("v.carbs", data.carbs || 0);
                component.set("v.fat", data.fat || 0);
                component.set("v.rollingTDEE", data.rollingTDEE || 0);
                component.set("v.recommendedCalories", data.recommendedCalories || 0);
                component.set("v.weeklyVelocity", data.weeklyVelocity || 0.00); 
                component.set("v.clinicalStatus", data.clinicalStatus || 'STABLE');
                component.set("v.statusColor", data.statusColor || 'biomech-green');

                let fTrend = data.finTrend;
                component.set("v.finTrendIcon", fTrend === 'OPTIMAL' ? '▲' : (fTrend === 'DECAY' ? '▼' : '—'));
                component.set("v.finTrendClass", fTrend === 'OPTIMAL' ? 'biomech-green' : (fTrend === 'DECAY' ? 'breach-red' : 'neutral-gray'));

                let wTrend = data.weightTrend;
                if (activePhaseStr === 'bulking' || activePhaseStr === 'reverse') {
                    component.set("v.weightTrendIcon", wTrend === 'DECAY' ? '▲' : (wTrend === 'OPTIMAL' ? '▼' : '—'));
                    component.set("v.weightTrendClass", wTrend === 'DECAY' ? 'biomech-green' : (wTrend === 'OPTIMAL' ? 'breach-red' : 'neutral-gray'));
                } else {
                    component.set("v.weightTrendIcon", wTrend === 'OPTIMAL' ? '▼' : (wTrend === 'DECAY' ? '▲' : '—'));
                    component.set("v.weightTrendClass", wTrend === 'OPTIMAL' ? 'biomech-green' : (wTrend === 'DECAY' ? 'breach-red' : 'neutral-gray'));
                }

                var fTarget = data.finTarget || 1; 
                var finProgress = Math.max(0, Math.min(100, Math.round((data.currentBalance / fTarget) * 100)));
                component.set("v.finProgress", finProgress);

                var physStart = data.goalStart || 0; 
                var goalProgress = 0;

                if (activePhaseStr === 'bulking' || activePhaseStr === 'reverse') {
                    var physDiff = data.goalTarget - physStart;
                    var physAchieved = data.currentWeight - physStart;
                    goalProgress = (physDiff > 0) ? Math.max(0, Math.min(100, Math.round((physAchieved / physDiff) * 100))) : 0;
                } else {
                    var physDiff = physStart - data.goalTarget;
                    var physAchieved = physStart - data.currentWeight;
                    goalProgress = (physDiff > 0) ? Math.max(0, Math.min(100, Math.round((physAchieved / physDiff) * 100))) : 0;
                }
                component.set("v.goalProgress", goalProgress);

                component.set("v.daysRemainingFin", data.finDaysRemaining);
                component.set("v.daysRemainingHealth", data.weightDaysRemaining);

                let mode = component.get("v.velocityMode"); 

                let today = new Date();
                today.setHours(0, 0, 0, 0);

                if (data.finDaysRemaining && data.finDaysRemaining !== 'STALLED') {
                    let fTargetDate = new Date(today);
                    fTargetDate.setDate(today.getDate() + parseInt(data.finDaysRemaining));
                    component.set("v.targetDateFin", fTargetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase());
                } else {
                    component.set("v.targetDateFin", "PLATEAU DETECTED");
                }

                if (data.weightDaysRemaining && data.weightDaysRemaining !== 'STALLED') {
                    if (data.weightProjectedDate) {
                        let parts = data.weightProjectedDate.split('-');
                        let hTargetDate = new Date(parts[0], parts[1] - 1, parts[2]);
                        hTargetDate.setHours(0,0,0,0);
                        component.set("v.targetDateHealth", hTargetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase());
                    } else {
                        component.set("v.targetDateHealth", "CALCULATING...");
                    }
                } else {
                    component.set("v.targetDateHealth", "PLATEAU DETECTED");
                }

                let activeDays = (mode === 'FINANCIAL') ? data.finDaysRemaining : data.weightDaysRemaining;
                if (activeDays && !isNaN(activeDays) && activeDays !== 'STALLED') {
                    component.set("v.daysRemaining", Math.max(0, parseInt(activeDays)));
                    component.set("v.targetDate", (mode === 'FINANCIAL' ? component.get("v.targetDateFin") : component.get("v.targetDateHealth")));
                } else {
                    component.set("v.daysRemaining", activeDays === 'STALLED' ? "STALLED" : 0);
                    component.set("v.targetDate", activeDays === 'STALLED' ? "PLATEAU DETECTED" : "CALCULATING...");
                }

                component.set("v.isLoaded", true);
                if (component.get("v.isSyncing")) {
                    component.set("v.isSyncing", false);
                }

                window.setTimeout($A.getCallback(function() {
                    helper.refreshCharts(component);
                    helper.refreshVelocityGauge(component); 
                    helper.renderMacroSVG(component); 
                    helper.renderUPIChart(component, labels, finHistory, healthHistory); 
                }.bind(this)), 50); 
            } else {
                component.set("v.isLoaded", true);
                component.set("v.isSyncing", false);
            }
        });
        $A.enqueueAction(action);
    },

    refreshVelocityGauge : function(component) {
        const mode = component.get("v.velocityMode");
        const progress = (mode === 'FINANCIAL') ? component.get("v.finProgress") : component.get("v.goalProgress");
        this.renderVelocityGauge(component, progress);
    },

    executeSovereignCall : function(component, nodeType) {
        var helper = this;
        component.set("v.briefingLoading", true);
        component.set("v.isAiLoading", true);
        component.set("v.drawerOpen", true);
        component.set("v.aiContent", "STABILIZING CONNECTION (3s)...");

        window.setTimeout($A.getCallback(function() {
            var dataPayload = { mode: component.get("v.velocityMode"), days: component.get("v.daysRemaining") || 0, upi: component.get("v.upiTotal") || 0, weight: component.get("v.currentWeight") || 0, balance: component.get("v.currentBalance") || 0, tdee: component.get("v.rollingTDEE") || 0 };
            var action = component.get("c.getSovereignInsight");
            action.setParams({ "payload" : JSON.stringify(dataPayload), "nodeType" : nodeType });
            action.setCallback(this, function(response) {
                component.set("v.briefingLoading", false);
                component.set("v.isAiLoading", false);
                component.set("v.isSyncing", false);
                if (response.getState() === "SUCCESS") {
                    var insight = response.getReturnValue();
                    component.set("v.aiContent", insight);
                    component.set("v.intelligenceText", insight);
                } else {
                    var errors = response.getError();
                    var msg = (errors && errors[0]) ? errors[0].message : "BRIDGE_COLLAPSE";
                    component.set("v.aiContent", "SYSTEM_HALT: " + msg);
                }
            });
            $A.enqueueAction(action);
        }), 3000);
    },

    refreshCharts : function(component) {
        var helper = this;
        var view = component.get("v.chartView");
        var metric = component.get("v.activeMetric");
        var timeframe = component.get("v.timeframe");

        helper.updateStats(component);

        if (view === 'HEALTH') {
            var action = component.get("c.getWeightHistory");
            action.setCallback(this, function(r) {
                if (r.getState() === "SUCCESS") {
                    window.setTimeout($A.getCallback(function() {
                        helper.renderWeightGraph(component, r.getReturnValue(), metric, timeframe);
                    }), 50);
                }
            });
            $A.enqueueAction(action);
        } else {
            var action = component.get("c.getFinancialHistory");
            action.setCallback(this, function(r) {
                if (r.getState() === "SUCCESS") {
                    window.setTimeout($A.getCallback(function() {
                        helper.renderFinancialGraph(component, r.getReturnValue(), metric, timeframe);
                    }), 50);
                }
            });
            $A.enqueueAction(action);
        }

        var tAction = component.get("c.getTrailheadHistory");
        tAction.setCallback(this, function(r) {
            if (r.getState() === "SUCCESS" && typeof Chart !== "undefined") {
                helper.renderTrailheadGraph(component, r.getReturnValue());
            }
        });
        $A.enqueueAction(tAction);
    },

    updateStats : function(component) {
        var view = component.get("v.chartView");
        var metric = component.get("v.activeMetric");
        var timeframe = component.get("v.timeframe");

        if (view === 'FINANCIAL') {
            var action = component.get("c.getFinancialHistory");
            action.setCallback(this, function(response) {
                if (response.getState() === "SUCCESS") {
                    var rawHistory = response.getReturnValue() || [];
                    
                    var today = new Date();
                    var currentMonthNum = today.getMonth() + 1;
                    var currentYear = today.getFullYear();
                    
                    let totalIncome = 0;
                    let totalExpenses = 0;
                    
                    rawHistory.forEach(function(trans) {
                        if (trans.entryDate) {
                            var parts = trans.entryDate.split('-');
                            var transYear = parseInt(parts[0], 10);
                            var transMonth = parseInt(parts[1], 10);
                            
                            if (transYear === currentYear && transMonth === currentMonthNum) {
                                if (trans.amount > 0) {
                                    totalIncome += trans.amount;
                                } else if (trans.amount < 0) {
                                    totalExpenses += Math.abs(trans.amount);
                                }
                            }
                        }
                    });
                    
                    let netDifferential = totalIncome - totalExpenses;
                    let format = (val) => '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    
                    component.set("v.finIncome", format(totalIncome));
                    component.set("v.finExpenses", format(totalExpenses));
                    component.set("v.netIncomeAmount", (netDifferential >= 0 ? '$' : '-$') + Math.abs(netDifferential).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                    
                    component.set("v.statAvgLabel", "NET INCOME");
                    component.set("v.statAvg", (netDifferential >= 0 ? '$' : '-$') + Math.abs(netDifferential).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                    component.set("v.statMinLabel", "INCOME");
                    component.set("v.statMin", '$' + totalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 }));
                    component.set("v.statMaxLabel", "EXPENSES");
                    component.set("v.statMax", '$' + totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 }));
                }
            });
            $A.enqueueAction(action);
        } else {
            component.set("v.statAvgLabel", "AVG");
            component.set("v.statMinLabel", "MIN");
            component.set("v.statMaxLabel", "MAX");
            
            var action = component.get("c.getMetricStats");
            action.setParams({ node: view, metric: metric, timeframe: timeframe });
            action.setCallback(this, function(response) {
                if (response.getState() === "SUCCESS") {
                    var stats = response.getReturnValue();
                    component.set("v.statAvg", stats.avg);
                    component.set("v.statMin", stats.min);
                    component.set("v.statMax", stats.max);
                }
            });
            $A.enqueueAction(action);
        }
    },

    renderUPIChart : function(component, labels, finLine, healthLine) {
        var upiNode = component.find("upiChart");
        if(!upiNode) return;
        var canvas = upiNode.getElement();
        var ctx = canvas.getContext('2d');
        if (window.upiChartObj) { window.upiChartObj.destroy(); }

        var finGradient = ctx.createLinearGradient(0, 0, 0, 240); 
        finGradient.addColorStop(0, 'rgba(132, 255, 51, 0.15)');   
        finGradient.addColorStop(0.6, 'rgba(132, 255, 51, 0.02)'); 
        finGradient.addColorStop(1, 'rgba(0, 0, 0, 0.98)');        

        var healthGradient = ctx.createLinearGradient(0, 0, 0, 240);
        healthGradient.addColorStop(0, 'rgba(37, 150, 190, 0.60)');    
        healthGradient.addColorStop(0.6, 'rgba(37, 150, 190, 0.25)');  
        healthGradient.addColorStop(1, 'rgba(0, 0, 0, 1)');            

        const chartLabels = labels.length > 0 ? labels : ['0/0'];

        window.upiChartObj = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [
                    { label: 'FINANCIAL PI', borderColor: '#84ff33', data: finLine.length > 0 ? finLine : [0], borderWidth: 2, pointRadius: 0, tension: 0.35, fill: true, backgroundColor: finGradient, spanGaps: true },
                    { label: 'HEALTH PI', borderColor: '#2596be', data: healthLine.length > 0 ? healthLine : [0], borderWidth: 2, pointRadius: 0, tension: 0.35, fill: true, backgroundColor: healthGradient, spanGaps: true }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        enabled: false, 
                        external: function(context) {
                            let anchor = component.find("upiTooltipAnchor").getElement();
                            let tooltipEl = document.getElementById('chartjs-tooltip-upi');
                            
                            if (!tooltipEl) {
                                tooltipEl = document.createElement('div');
                                tooltipEl.id = 'chartjs-tooltip-upi';
                                Object.assign(tooltipEl.style, {
                                    background: 'rgba(15, 18, 22, 0.98)', borderRadius: '2px', color: 'white', position: 'absolute', 
                                    borderLeft: '1px solid #2596be', padding: '8px 10px', fontFamily: "'Montserrat', sans-serif",
                                    zIndex: '10', boxShadow: '0 4px 15px rgba(0,0,0,0.8)', pointerEvents: 'none', transition: 'opacity 0.1s ease', whiteSpace: 'nowrap'
                                });
                                anchor.appendChild(tooltipEl);
                            }

                            const tooltipModel = context.tooltip;
                            if (tooltipModel.opacity === 0) {
                                tooltipEl.style.opacity = 0;
                                return;
                            }

                            if (tooltipModel.body) {
                                const index = tooltipModel.dataPoints[0].dataIndex;
                                const dateHeader = chartLabels[index];
                                const rawFin = tooltipModel.dataPoints[0].parsed.y;
                                const rawHealth = tooltipModel.dataPoints[1] ? tooltipModel.dataPoints[1].parsed.y : 0;
                                const totalPi = (rawFin + rawHealth) / 2;
                                
                                tooltipEl.innerHTML = `
                                    <div style="color:#6e7681; font-size:8px; margin-bottom:4px; font-weight:600; text-transform:uppercase; letter-spacing:1.5px;">${dateHeader}</div>
                                    <div style="color:#e6edf3; font-size:10px; font-weight:400; margin-bottom:4px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:4px;">TOTAL PI: ${totalPi.toFixed(1)}%</div>
                                    <div style="color:#84ff33; font-size:9px; font-weight:400; margin-bottom:2px;">FINANCIAL: ${rawFin.toFixed(1)}%</div>
                                    <div style="color:#2596be; font-size:9px; font-weight:400;">HEALTH: ${rawHealth.toFixed(1)}%</div>
                                `;
                            }

                            tooltipEl.style.opacity = 1;
                            let tWidth = tooltipEl.offsetWidth || 130;
                            let cWidth = context.chart.width;
                            let canvasEl = context.chart.canvas;
                            let targetLeft = canvasEl.offsetLeft + tooltipModel.caretX - 50;
                            
                            if (targetLeft + tWidth > cWidth + canvasEl.offsetLeft) { targetLeft = canvasEl.offsetLeft + tooltipModel.caretX - tWidth - 10; }
                            if (targetLeft < canvasEl.offsetLeft) targetLeft = canvasEl.offsetLeft + 10; 
                            
                            tooltipEl.style.left = targetLeft + 'px';
                            tooltipEl.style.top = (canvasEl.offsetTop + tooltipModel.caretY - 80) + 'px'; 
                        }
                    }
                },
                scales: { x: { display: false }, y: { display: false, min: 0, suggestedMax: 200 } }
            }
        });
    },

    renderWeightGraph : function(component, history, metric, timeframe) {
        var canvasNode = component.find("weightChart");
        if(!canvasNode) return;
        var canvas = canvasNode.getElement();
        if (window.myWeightChart) { window.myWeightChart.destroy(); }

        let fieldsMap = {
            'TDEE': 'TDEE__c', 'CALORIES': 'Calories__c', 'PROTEIN': 'Protein_g__c',
            'CARBS': 'Carbs_g__c', 'FAT': 'Fat_g__c', 'BODY FAT': 'Body_Fat__c', 'WEIGHT': 'Weight_lbs__c',
            'FAT MASS': 'Fat_mass__c', 'LEAN MASS': 'Lean_body_mass__c'
        };
        let targetField = fieldsMap[metric] || 'Weight_lbs__c';

        let cleanedHistory = history.filter(h => h[targetField] != null && h[targetField] !== undefined);
        if (cleanedHistory.length === 0) return;

        let labels = [];
        let fullDateLabels = [];
        let activeDataPoints = [];
        let targetLineValue = null;
        let chartColor = '#2596be';
        let activePhaseStr = component.get("v.currentPhase") ? component.get("v.currentPhase").toLowerCase() : 'maintenance';

        if (timeframe === 'YTD') {
            let monthlyData = {};
            cleanedHistory.forEach(h => {
                let month = parseInt(h.Entry_Date__c.split('-')[1], 10);
                if (!monthlyData[month]) { monthlyData[month] = { sum: 0, count: 0 }; }
                monthlyData[month].sum += h[targetField];
                monthlyData[month].count++;
            });
            let sortedMonths = Object.keys(monthlyData).sort((a, b) => parseInt(a) - parseInt(b));
            
            labels = sortedMonths.map(m => m.toString()); 
            activeDataPoints = sortedMonths.map(m => monthlyData[m].sum / monthlyData[m].count);
            
            const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
            fullDateLabels = sortedMonths.map(m => monthNames[parseInt(m) - 1]);
            
            if (metric === 'WEIGHT' && (activePhaseStr === 'cutting' || activePhaseStr === 'bulking' || activePhaseStr === 'reverse')) {
                targetLineValue = component.get("v.goalTarget");
            }
        } else {
            let count = (timeframe === '7D' ? 7 : 30);
            cleanedHistory = cleanedHistory.slice(Math.max(cleanedHistory.length - count, 0));

            switch(metric) {
                case 'TDEE': activeDataPoints = cleanedHistory.map(h => h.TDEE__c); break;
                case 'CALORIES': activeDataPoints = cleanedHistory.map(h => h.Calories__c); break;
                case 'PROTEIN': activeDataPoints = cleanedHistory.map(h => h.Protein_g__c); break;
                case 'CARBS': activeDataPoints = cleanedHistory.map(h => h.Carbs_g__c); break;
                case 'FAT': activeDataPoints = cleanedHistory.map(h => h.Fat_g__c); break;
                case 'BODY FAT': activeDataPoints = cleanedHistory.map(h => h.Body_Fat__c); break;
                case 'FAT MASS': activeDataPoints = cleanedHistory.map(h => h.Fat_mass__c); break;
                case 'LEAN MASS': activeDataPoints = cleanedHistory.map(h => h.Lean_body_mass__c); break;
                default: 
                    activeDataPoints = cleanedHistory.map(h => h.Weight_lbs__c);
                    if (activePhaseStr === 'cutting' || activePhaseStr === 'bulking' || activePhaseStr === 'reverse') {
                        targetLineValue = component.get("v.goalTarget"); 
                    }
            }

            fullDateLabels = cleanedHistory.map(h => {
                let parts = h.Entry_Date__c.split('-');
                let d = new Date(parts[0], parts[1]-1, parts[2]);
                return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
            });
            
            let lastMonth = null;
            labels = cleanedHistory.map((h, index) => {
                let parts = h.Entry_Date__c.split('-'); 
                let d = new Date(parts[0], parts[1]-1, parts[2]); 
                let currentMonth = d.getMonth() + 1; 
                let currentDate = d.getDate();
                if (index === 0 || currentMonth !== lastMonth) {
                    lastMonth = currentMonth;
                    return currentMonth + '/' + currentDate;
                }
                return currentDate.toString();
            });
        }

        let isMassMetric = (metric === 'WEIGHT' || metric === 'FAT MASS' || metric === 'LEAN MASS');
        let yOptions = { 
            grid: { display: false }, 
            ticks: { 
                color: '#8b949e', font: { size: 9 }, maxTicksLimit: 8,
                precision: (metric === 'BODY FAT') ? 1 : 0, 
                callback: function(value) { 
                    if (metric === 'BODY FAT') return value.toFixed(1) + '%';
                    if (isMassMetric) return Math.round(value); 
                    return value;
                }
            } 
        };

        if (isMassMetric) {
            if (timeframe === '7D') {
                const minWeight = Math.min(...activeDataPoints);
                const maxWeight = Math.max(...activeDataPoints);
                yOptions.min = Math.floor(minWeight - 2);
                yOptions.max = Math.ceil(maxWeight + 2);
            } else {
                yOptions.min = (metric === 'WEIGHT') ? 175 : 0;
                yOptions.max = (metric === 'WEIGHT' && targetLineValue) ? Math.ceil(targetLineValue + 5) : Math.ceil(Math.max(...activeDataPoints) + 5); 
            }
        } else if (metric === 'CALORIES' || metric === 'TDEE') {
            const minVal = Math.min(...activeDataPoints);
            const maxVal = Math.max(...activeDataPoints);
            yOptions.min = Math.floor(minVal - 500);
            yOptions.max = Math.ceil(maxVal + 500);
            yOptions.beginAtZero = false;
        } else {
            yOptions.beginAtZero = (metric !== 'BODY FAT');
            yOptions.grace = '10%';
        }

        let datasets = [{
            label: metric, data: activeDataPoints, borderColor: chartColor, borderWidth: 2, fill: false, 
            tension: (timeframe === '7D' || timeframe === 'YTD') ? 0 : 0.4, 
            pointRadius: (timeframe === '7D' || timeframe === 'YTD') ? 5 : 0, 
            pointBackgroundColor: '#0b0e11', pointBorderWidth: 2, pointHoverBackgroundColor: '#84ff33', spanGaps: true
        }];

        if (targetLineValue) {
            datasets.push({
                label: 'Target', data: Array(labels.length).fill(targetLineValue), borderColor: '#84ff33', 
                borderWidth: 1, pointRadius: 0, hoverRadius: 0, hitRadius: 0, fill: false, borderDash: [5, 5] 
            });
        }

        window.myWeightChart = new Chart(canvas, {
            type: 'line',
            data: { labels: labels, datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                layout: { padding: { top: 35, bottom: 12, left: 5, right: 5 } },
                interaction: { mode: 'index', intersect: false },
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        enabled: false, 
                        filter: function(tooltipItem) { return tooltipItem.datasetIndex === 0; },
                        external: function(context) {
                            let chartNode = context.chart.canvas.parentNode;
                            let tooltipEl = document.getElementById('chartjs-tooltip-weight');
                            
                            if (!tooltipEl) {
                                tooltipEl = document.createElement('div');
                                tooltipEl.id = 'chartjs-tooltip-weight';
                                Object.assign(tooltipEl.style, {
                                    background: 'rgba(15, 18, 22, 0.98)', borderRadius: '2px', color: 'white', position: 'absolute',
                                    borderLeft: '1px solid ' + chartColor, padding: '8px 10px', fontFamily: "'Montserrat', sans-serif",
                                    zIndex: '10', boxShadow: '0 4px 15px rgba(0,0,0,0.8)', pointerEvents: 'none', transition: 'opacity 0.1s ease', whiteSpace: 'nowrap'
                                });
                                chartNode.appendChild(tooltipEl);
                            }

                            const tooltipModel = context.tooltip;
                            if (tooltipModel.opacity === 0) {
                                tooltipEl.style.opacity = 0;
                                return;
                            }

                            if (tooltipModel.body) {
                                const index = tooltipModel.dataPoints[0].dataIndex;
                                const dateHeader = fullDateLabels[index].toUpperCase();
                                let bodyHtml = '';
                                tooltipModel.dataPoints.forEach(dp => {
                                    if (dp.datasetIndex === 0 && dp.raw !== null) {
                                        let val = dp.raw;
                                        let unit = (isMassMetric ? ' LBS' : (metric === 'CALORIES' || metric === 'TDEE' ? ' KCAL' : (metric === 'BODY FAT' ? '%' : 'G')));
                                        val = (metric === 'BODY FAT' || isMassMetric) ? val.toFixed(1) : Math.round(val);
                                        bodyHtml += `<div style="color:#e6edf3; font-size:10px; font-weight:400;">${metric}: ${val}${unit}</div>`;
                                    }
                                });
                                tooltipEl.innerHTML = `<div style="color:#6e7681; font-size:8px; margin-bottom:4px; font-weight:600; text-transform:uppercase; letter-spacing:1.5px;">${dateHeader}</div>${bodyHtml}`;
                            }

                            tooltipEl.style.opacity = 1;
                            let tWidth = tooltipEl.offsetWidth || 130;
                            let cWidth = context.chart.width;
                            let canvasEl = context.chart.canvas;
                            let targetLeft = canvasEl.offsetLeft + tooltipModel.caretX - 50;
                            
                            if (targetLeft + tWidth > cWidth + canvasEl.offsetLeft) { targetLeft = canvasEl.offsetLeft + tooltipModel.caretX - tWidth - 10; }
                            if (targetLeft < canvasEl.offsetLeft) targetLeft = canvasEl.offsetLeft + 10; 
                            
                            tooltipEl.style.left = targetLeft + 'px';
                            tooltipEl.style.top = (canvasEl.offsetTop + tooltipModel.caretY - 45) + 'px'; 
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#8b949e', font: { size: 9 }, maxRotation: 0, minRotation: 0, autoSkip: true, maxTicksLimit: (timeframe === '7D' ? 7 : 12) } },
                    y: yOptions
                }
            }
        });
    },

    renderFinancialGraph : function(component, rawHistory, metric, timeframe) {
        var finNode = component.find("financialChart");
        if (!finNode || !rawHistory || rawHistory.length === 0) return;
        var canvas = finNode.getElement();
        var ctx = canvas.getContext('2d');

        if (window.myFinChart) { window.myFinChart.destroy(); }

        var incomeGradient = ctx.createLinearGradient(0, 0, 0, 300);
        incomeGradient.addColorStop(0, '#84ff33');
        incomeGradient.addColorStop(1, 'rgba(132, 255, 51, 0.12)');

        var expenseGradient = ctx.createLinearGradient(0, 0, 0, 300);
        expenseGradient.addColorStop(0, '#2596be');
        expenseGradient.addColorStop(1, 'rgba(37, 150, 190, 0.12)');

        let labels = [];
        let fullDateLabels = [];
        let datasets = [];

        let incomeData = [];
        let expenseData = [];

        if (timeframe === 'YTD') {
            let monthlyData = {};
            rawHistory.forEach(trans => {
                if (trans.entryDate) {
                    let month = parseInt(trans.entryDate.split('-')[1], 10);
                    if (!monthlyData[month]) { monthlyData[month] = { income: 0, expenses: 0 }; }
                    if (trans.amount > 0) {
                        monthlyData[month].income += trans.amount;
                    } else if (trans.amount < 0) {
                        monthlyData[month].expenses += Math.abs(trans.amount);
                    }
                }
            });
            let sortedMonths = Object.keys(monthlyData).sort((a, b) => parseInt(a) - parseInt(b));
            const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
            
            sortedMonths.forEach(m => {
                labels.push(m.toString());
                fullDateLabels.push(monthNames[parseInt(m) - 1]);
                incomeData.push(monthlyData[m].income);
                expenseData.push(monthlyData[m].expenses);
            });
        } else {
            const aggregatedMap = rawHistory.reduce((map, trans) => {
                if (!map[trans.entryDate]) { map[trans.entryDate] = { income: 0, expenses: 0 }; }
                if (trans.amount > 0) {
                    map[trans.entryDate].income += trans.amount;
                } else if (trans.amount < 0) {
                    map[trans.entryDate].expenses += Math.abs(trans.amount);
                }
                return map;
            }, {});

            const sortedDates = Object.keys(aggregatedMap).sort();
            if (sortedDates.length > 0) {
                let latestDateStr = sortedDates[sortedDates.length - 1];
                let partsLatest = latestDateStr.split('-');
                let endDate = new Date(partsLatest[0], partsLatest[1]-1, partsLatest[2]);
                endDate.setHours(0,0,0,0);

                let startDate = new Date(endDate);
                if (timeframe === '7D') { startDate.setDate(endDate.getDate() - 6); } 
                else { startDate.setDate(endDate.getDate() - 29); }

                const actualDaysToRender = Math.ceil(Math.abs(endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                let lastMonth = null;

                for (let i = 0; i < actualDaysToRender; i++) {
                    let loopDate = new Date(startDate);
                    loopDate.setDate(startDate.getDate() + i);
                    let dateKey = loopDate.getFullYear() + '-' + String(loopDate.getMonth() + 1).padStart(2, '0') + '-' + String(loopDate.getDate()).padStart(2, '0');
                    
                    let dayData = aggregatedMap[dateKey] || { income: 0, expenses: 0 };
                    incomeData.push(dayData.income);
                    expenseData.push(dayData.expenses);
                    
                    let currentMonth = loopDate.getMonth() + 1;
                    let currentDate = loopDate.getDate();
                    fullDateLabels.push(loopDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }));
                    
                    if (i === 0 || currentMonth !== lastMonth) { 
                        lastMonth = currentMonth; 
                        labels.push(currentMonth + '/' + currentDate); 
                    } else { 
                        labels.push(currentDate.toString()); 
                    }
                }
            }
        }

        datasets.push({ 
            label: 'INCOME', 
            data: incomeData, 
            backgroundColor: incomeGradient, 
            hoverBackgroundColor: '#84ff33', 
            barPercentage: 0.85, 
            categoryPercentage: 0.40,
            borderRadius: 3,
            borderSkipped: 'bottom'
        });
        datasets.push({ 
            label: 'EXPENSES', 
            data: expenseData, 
            backgroundColor: expenseGradient, 
            hoverBackgroundColor: '#2596be', 
            barPercentage: 0.85, 
            categoryPercentage: 0.40,
            borderRadius: 3,
            borderSkipped: 'bottom'
        });

        window.myFinChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                layout: { padding: { top: 35, bottom: 12, left: 5, right: 5 } },
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        enabled: false, 
                        external: function(context) {
                            let chartNode = context.chart.canvas.parentNode;
                            let tooltipEl = document.getElementById('chartjs-tooltip-fin');
                            
                            if (!tooltipEl) {
                                tooltipEl = document.createElement('div');
                                tooltipEl.id = 'chartjs-tooltip-fin';
                                Object.assign(tooltipEl.style, {
                                    background: 'rgba(15, 18, 22, 0.98)', borderRadius: '2px', color: 'white', position: 'absolute',
                                    borderLeft: '1px solid #84ff33', padding: '8px 10px', fontFamily: "'Montserrat', sans-serif",
                                    zIndex: '10', boxShadow: '0 4px 15px rgba(0,0,0,0.8)', pointerEvents: 'none', transition: 'opacity 0.1s ease', whiteSpace: 'nowrap'
                                });
                                chartNode.appendChild(tooltipEl);
                            }

                            const tooltipModel = context.tooltip;
                            if (tooltipModel.opacity === 0) {
                                tooltipEl.style.opacity = 0;
                                return;
                            }

                            if (tooltipModel.body) {
                                const index = tooltipModel.dataPoints[0].dataIndex;
                                const dateHeader = fullDateLabels[index].toUpperCase();
                                let bodyHtml = '';
                                tooltipModel.dataPoints.forEach(dp => {
                                    let formattedVal = parseFloat(dp.raw).toLocaleString(undefined, { minimumFractionDigits: 2 });
                                    let labelColor = dp.datasetIndex === 0 ? '#84ff33' : '#2596be';
                                    bodyHtml += `<div style="color:${labelColor}; font-size:10px; font-weight:400;">${dp.dataset.label}: $${formattedVal}</div>`;
                                });
                                tooltipEl.innerHTML = `<div style="color:#6e7681; font-size:8px; margin-bottom:4px; font-weight:600; text-transform:uppercase; letter-spacing:1.5px;">${dateHeader}</div>${bodyHtml}`;
                            }

                            tooltipEl.style.opacity = 1;
                            let tWidth = tooltipEl.offsetWidth || 130;
                            let cWidth = context.chart.width;
                            let canvasEl = context.chart.canvas;
                            let targetLeft = canvasEl.offsetLeft + tooltipModel.caretX - 50;
                            
                            if (targetLeft + tWidth > cWidth + canvasEl.offsetLeft) { targetLeft = canvasEl.offsetLeft + tooltipModel.caretX - tWidth - 10; }
                            if (targetLeft < canvasEl.offsetLeft) targetLeft = canvasEl.offsetLeft + 10; 
                            
                            tooltipEl.style.left = targetLeft + 'px';
                            tooltipEl.style.top = (canvasEl.offsetTop + tooltipModel.caretY - 50) + 'px'; 
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#8b949e', font: { size: 9 }, autoSkip: true, maxTicksLimit: 12 } },
                    y: { grid: { display: false }, beginAtZero: true, ticks: { color: '#8b949e', font: { size: 9 } } }
                }
            }
        });
    },

    renderTrailheadGraph : function(component, history) {
        var trailNode = component.find("trailheadChart");
        if(!trailNode) return;
        var canvas = trailNode.getElement();
        var ctx = canvas.getContext('2d');
        var reversedHistory = [...history].reverse();
        var barGradient = ctx.createLinearGradient(0, 150, 0, 0);
        barGradient.addColorStop(0, '#2596be'); barGradient.addColorStop(1, '#84ff33');     
        if (window.myTrailheadChart) { window.myTrailheadChart.destroy(); }
        window.myTrailheadChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: reversedHistory.map(h => {
                    let parts = h.entryDate.split('-');
                    let d = new Date(parts[0], parts[1]-1, parts[2]);
                    return (d.getMonth() + 1) + '/' + d.getDate();
                }),
                datasets: [{ data: reversedHistory.map(h => h.points), backgroundColor: barGradient, borderRadius: 4 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { display: false } },
                scales: { y: { display: false }, x: { grid: { display: false }, ticks: { color: '#8b949e', font: { size: 9 }, maxRotation: 0, minRotation: 0, autoSkip: true, maxTicksLimit: 7 } } }
            }
        });
    },

    renderVelocityGauge : function(component, progress) {
        var velNode = component.find("velocityChart");
        if(!velNode) return;
        var canvas = velNode.getElement();
        var ctx = canvas.getContext('2d');
        var gradient = ctx.createLinearGradient(0, 0, 0, 140);
        gradient.addColorStop(0, '#2596be'); gradient.addColorStop(1, '#84ff33'); 
        if (window.vChart) { window.vChart.destroy(); }
        window.vChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [Math.max(0, Math.min(100, progress)), 100 - Math.max(0, Math.min(100, progress))], 
                    backgroundColor: [gradient, 'rgba(28, 33, 40, 0.7)'], borderWidth: 0, circumference: 270, rotation: 225
                }]
            },
            options: { cutout: '88%', responsive: true, maintainAspectRatio: false, plugins: { tooltip: { enabled: false }, legend: { display: false } } }
        });
    },

    renderMacroSVG : function(component) {
        const stageNode = component.find("svgStage");
        if (!stageNode) return;
        const stage = stageNode.getElement();
        const p = parseFloat(component.get("v.protein")) || 0;
        const f = parseFloat(component.get("v.fat")) || 0;
        const c = parseFloat(component.get("v.carbs")) || 0;
        const labels = ['PROTEIN', 'CARBS', 'FAT'];
        const values = [p, c, f];
        const maxVal = Math.max(p, c, f, 1);
        let pRadius = 70 + ((p / maxVal) * 30); 
        let cRadius = 64 + ((c / maxVal) * 24); 
        let fRadius = 60 + ((f / maxVal) * 18); 
        const radii = [ pRadius, cRadius, fRadius ];
        let svgContent = `<svg viewBox="0 0 200 200" style="width: 100%; height: 100%; overflow: visible;"><defs><linearGradient id="macroGrad0" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0b1a2f"/> <stop offset="60%" stop-color="#2596be"/> <stop offset="100%" stop-color="#3fb27f"/> </linearGradient><linearGradient id="macroGrad1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1c2128"/> <stop offset="100%" stop-color="#4e5a65"/></linearGradient><linearGradient id="macroGrad2" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#142e0a"/> <stop offset="60%" stop-color="#84ff33"/> <stop offset="100%" stop-color="#2596be"/></linearGradient></defs>`;
        const centerX = 100, centerY = 100;
        const renderOrder = [2, 1, 0]; 
        const angleMap = { 0: { start: -120, end: 0 }, 1: { start: 0, end: 120 }, 2: { start: 120, end: 240 } };
        renderOrder.forEach(i => {
            const config = angleMap[i]; const r = radii[i]; 
            const x1 = centerX + r * Math.cos(Math.PI * config.start / 180);
            const y1 = centerY + r * Math.sin(Math.PI * config.start / 180);
            const x2 = centerX + r * Math.cos(Math.PI * config.end / 180);
            const y2 = centerY + r * Math.sin(Math.PI * config.end / 180);
            svgContent += `<path d="M ${centerX} ${centerY} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z" fill="url(#macroGrad${i})" stroke="none"/>`;
            const midAngle = config.start + 60;
            const lx1 = centerX + (r - 10) * Math.cos(Math.PI * midAngle / 180);
            const ly1 = centerY + (r - 10) * Math.sin(Math.PI * midAngle / 180);
            const lx2 = centerX + (r + 15) * Math.cos(Math.PI * midAngle / 180);
            const ly2 = centerY + (r + 15) * Math.sin(Math.PI * midAngle / 180);
            const lx3 = lx2 + (lx2 > centerX ? 12 : -12);
            const labelColor = (i === 1 ? '#8b949e' : (i === 0 ? '#2596be' : '#84ff33'));
            svgContent += `<polyline points="${lx1},${ly1} ${lx2},${ly2} ${lx3},${ly2}" fill="none" stroke="#8b949e" stroke-width="1.2" opacity="0.6"/><text x="${lx3 + (lx2 > centerX ? 4 : -4)}" y="${ly2 + 4}" fill="#ffffff" font-size="11" font-family="monospace" font-weight="900" text-anchor="${lx2 > centerX ? 'start' : 'end'}">${labels[i]} <tspan fill="${labelColor}">${values[i]}G</tspan></text>`;
        });
        svgContent += `</svg>`;
        stage.innerHTML = svgContent;
    }
})