({
    /* --- SYSTEM INITIALIZATION --- */
    doInit : function(component, event, helper) {
        // Initialize state defaults
        component.set("v.upiTotal", 0);
        if (!component.get("v.velocityMode")) {
            component.set("v.velocityMode", "FINANCIAL");
        }
        if (!component.get("v.timeframe")) {
            component.set("v.timeframe", "7D");
        }
        if (!component.get("v.chartView")) {
            component.set("v.chartView", "HEALTH");
        }
        if (!component.get("v.activeMetric")) {
            component.set("v.activeMetric", "WEIGHT");
        }

        // Live Engine: Continuous Timestamp Evaluation
        var calculateTimestamp = function() {
            var now = new Date();
            var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            
            // Format Date: "Sunday, May 31, 2026"
            var formattedDate = days[now.getDay()] + ", " + months[now.getMonth()] + " " + now.getDate() + ", " + now.getFullYear();
            
            // Format Time: "9:48:59 AM"
            var hours = now.getHours();
            var minutes = now.getMinutes();
            var seconds = now.getSeconds();
            var ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; 
            minutes = minutes < 10 ? '0' + minutes : minutes;
            seconds = seconds < 10 ? '0' + seconds : seconds;
            var formattedTime = hours + ':' + minutes + ':' + seconds + ' ' + ampm;
            
            if (component.isValid()) {
                component.set("v.currentDate", formattedDate);
                component.set("v.currentTime", formattedTime);
            }
        };

        // Execute immediately on system initialization
        calculateTimestamp();

        // 1000ms High-Resolution Clock Loop
        window.setInterval($A.getCallback(function() {
            calculateTimestamp();
        }), 1000);

        // Primary Data Pull
        helper.loadDashboardData(component);

        // --- SYSTEM HEARTBEAT: AUTOMATIC MIDNIGHT ROLLOVER ---
        window.setInterval($A.getCallback(function() {
            if (component.isValid() && !component.get("v.isSyncing") && !component.get("v.isAiLoading")) {
                helper.loadDashboardData(component);
            }
        }), 3600000); 
    },

    /* --- PERSPECTIVE HUB: CHART TOGGLES --- */
    handleChartToggle : function(component, event, helper) {
        var selectedView = event.getParam("value");
        component.set("v.chartView", selectedView);
        
        if (selectedView === 'HEALTH') {
            component.set("v.activeMetric", "WEIGHT");
        } else {
            component.set("v.activeMetric", "CASH FLOW");
        }
        
        helper.refreshCharts(component);
    },

    handleMetricChange : function(component, event, helper) {
        var selectedMetric = event.getParam("value");
        component.set("v.activeMetric", selectedMetric);
        helper.refreshCharts(component);
    },

    /* --- SIDEBAR NAVIGATION --- */
    switchToFinancial : function(component, event, helper) {
        component.set("v.chartView", "FINANCIAL");
        component.set("v.activeMetric", "CASH_FLOW");
        helper.refreshCharts(component);
    },

    switchToHealth : function(component, event, helper) {
        component.set("v.chartView", "HEALTH");
        component.set("v.activeMetric", "WEIGHT");
        helper.refreshCharts(component);
    },

    /* --- TIMEFRAME FILTERS --- */
    filter7D : function(component, event, helper) {
        component.set("v.timeframe", "7D");
        helper.refreshCharts(component);
    },

    filter30D : function(component, event, helper) {
        component.set("v.timeframe", "30D");
        helper.refreshCharts(component);
    },

    filterYTD : function(component, event, helper) {
        component.set("v.timeframe", "YTD");
        helper.refreshCharts(component);
    },

    /* --- VELOCITY MODE TOGGLE --- */
    toggleVelocityMode : function(component, event, helper) {
        let currentMode = component.get("v.velocityMode");
        let newMode = (currentMode === 'FINANCIAL') ? 'HEALTH' : 'FINANCIAL';
        component.set("v.velocityMode", newMode);
        
        if (helper.updateVelocityDisplay) {
            helper.updateVelocityDisplay(component);
        }

        helper.refreshVelocityGauge(component);
        helper.refreshCharts(component);
    },

    /* --- DATA INGESTION: TRAILHEAD --- */
    handleAddPoints : function(component, event, helper) {
        var points = component.get("v.trailheadPointsEntry");
        if (points && points > 0) {
            var action = component.get("c.saveTrailheadEntry");
            
            // REFACTOR: Extract local date components directly to bypass false UTC midnight rollovers
            var localDate = new Date();
            var year = localDate.getFullYear();
            var month = ('0' + (localDate.getMonth() + 1)).slice(-2);
            var day = ('0' + localDate.getDate()).slice(-2);
            var manualDate = year + '-' + month + '-' + day; 
            
            action.setParams({ "points" : parseInt(points), "entryDate" : manualDate });
            action.setCallback(this, function(response) {
                if (response.getState() === "SUCCESS") {
                    component.set("v.trailheadPointsEntry", 0);
                    helper.loadDashboardData(component);
                }
            });
            $A.enqueueAction(action);
        }
    },

    handleUndoEntry : function(component, event, helper) {
        if (confirm("Execute Veto: Delete the most recent Trailhead entry?")) {
            var action = component.get("c.undoLastEntry");
            action.setCallback(this, function(response) {
                if (response.getState() === "SUCCESS") {
                    helper.loadDashboardData(component);
                }
            });
            $A.enqueueAction(action);
        }
    },

    /* --- SOVEREIGN AI: SINGLE-FILE PROTOCOL --- */
    handleManualSync : function(component, event, helper) {
        if (component.get("v.isAiLoading")) return;
        
        component.set("v.isAiLoading", true);
        component.set("v.activeDrawer", "OVERVIEW");
        component.set("v.aiContent", "EXECUTING MANUAL SYSTEM SYNC...");

        window.setTimeout($A.getCallback(function() {
            helper.executeSovereignCall(component, 'SystemSync');
            
            window.setTimeout($A.getCallback(function() {
                component.set("v.isAiLoading", false);
            }), 5000);
        }), 1000);
    },

    /* --- TRIGGER LOGIC: MANUAL ONLY --- */
    toggleOverview : function(component, event, helper) {
        let currentDrawer = component.get("v.activeDrawer");
        component.set("v.activeDrawer", currentDrawer === 'OVERVIEW' ? 'NONE' : 'OVERVIEW');
    },

    handleAIPopup : function(component, event, helper) {
        if (component.get("v.isAiLoading")) return;

        var nodeType = event.getSource().get("v.value"); 
        component.set("v.isAiLoading", true);
        component.set("v.activeDrawer", "OVERVIEW"); 
        component.set("v.aiContent", "ISOLATING " + nodeType.toUpperCase() + " DATA...");
        
        helper.executeSovereignCall(component, nodeType);

        window.setTimeout($A.getCallback(function() {
            component.set("v.isAiLoading", false);
        }), 5000);
    }
})