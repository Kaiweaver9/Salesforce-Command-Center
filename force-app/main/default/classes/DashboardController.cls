public with sharing class DashboardController {

    public class FinancialHistoryItem {
        @AuraEnabled public String entryDate;
        @AuraEnabled public Decimal amount;
        @AuraEnabled public String type;

        public FinancialHistoryItem(String entryDate, Decimal amount, String type) {
            this.entryDate = entryDate;
            this.amount = amount;
            this.type = type;
        }
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getDashboardMetrics() {
        Map<String, Object> metrics = new Map<String, Object>();

        try {
            Date todayDate = Date.today();
            Date startOfMonth = todayDate.toStartOfMonth();

            // 1. Performance Index Score
            List<Performance_Index__c> latestIndex = [
                SELECT Total_Index__c
                FROM Performance_Index__c
                ORDER BY Performance_Date__c DESC, CreatedDate DESC
                LIMIT 1
            ];
            metrics.put('dailyPerformanceScore', !latestIndex.isEmpty() && latestIndex[0].Total_Index__c != null
                ? latestIndex[0].Total_Index__c.setScale(0)
                : 0);

            // 2. Current Cash Balance & Month-to-Date Trend
            AggregateResult[] balanceResults = [
                SELECT SUM(Transaction_Amount__c) total
                FROM Financial_Data__c
                WHERE Transaction_Date__c <= TODAY
            ];
            Decimal financialBalance = (Decimal)balanceResults[0].get('total') != null
                ? (Decimal)balanceResults[0].get('total')
                : 0.00;
            metrics.put('financialBalance', financialBalance);

            AggregateResult[] startOfMonthResults = [
                SELECT SUM(Transaction_Amount__c) total
                FROM Financial_Data__c
                WHERE Transaction_Date__c < :startOfMonth
            ];
            Decimal startOfMonthBalance = (Decimal)startOfMonthResults[0].get('total') != null
                ? (Decimal)startOfMonthResults[0].get('total')
                : 0.00;

            String financialTrend = financialBalance == startOfMonthBalance
                ? 'PLATEAU'
                : (financialBalance > startOfMonthBalance ? 'OPTIMAL' : 'DECAY');
            metrics.put('financialTrend', financialTrend);

            // 3. Total Net Worth Across All Financial Accounts
            AggregateResult[] netWorthResults = [
                SELECT SUM(Current_Value__c) total
                FROM Financial_Account__c
            ];
            Decimal totalNetWorth = (Decimal)netWorthResults[0].get('total') != null
                ? (Decimal)netWorthResults[0].get('total')
                : 0.00;
            metrics.put('totalNetWorth', totalNetWorth);

            // 4. Active Financial & Health Goals
            List<Goal_Setting__c> activeGoals = [
                SELECT Id, Name, Goal_Type__c, Goal_Target__c, Goal_Start__c,
                       Goal_Start_Date__c, Target_Reached_Date__c, Current_Phase__c,
                       Caloric_Deficit_Percentage__c, Phase_Duration_Days__c, Target_End_Date__c
                FROM Goal_Setting__c
                WHERE Display_on_Command_Center__c = true
            ];

            Id financialGoalId = null;
            Decimal financialTarget = 0.00;
            Decimal healthTarget = 0.0;
            Decimal healthStart = 0.0;
            String currentPhase = 'maintenance';
            Goal_Setting__c activeHealthGoal = null;

            for (Goal_Setting__c goal : activeGoals) {
                if (goal.Goal_Type__c == 'Financial') {
                    financialGoalId = goal.Id;
                    financialTarget = goal.Goal_Target__c != null ? goal.Goal_Target__c : 7000.00;
                    metrics.put('financialGoalLabel', goal.Name.toUpperCase());
                    metrics.put('financialTarget', financialTarget);
                } else if (goal.Goal_Type__c == 'Health') {
                    activeHealthGoal = goal;
                    healthTarget = goal.Goal_Target__c != null ? goal.Goal_Target__c : 0.0;
                    healthStart = goal.Goal_Start__c != null ? goal.Goal_Start__c : 0.0;
                    currentPhase = goal.Current_Phase__c != null ? goal.Current_Phase__c.toLowerCase() : 'maintenance';

                    metrics.put('healthGoalLabel', goal.Name.toUpperCase());
                    metrics.put('healthTarget', healthTarget);
                    metrics.put('healthStart', healthStart);
                    metrics.put('currentPhase', currentPhase);
                }
            }

            // Phase Week Tracking (1-indexed week + total weeks only when Phase_Duration_Days__c is explicitly set)
            Integer currentPhaseWeek = null;
            Integer totalPhaseWeeks = null;
            Boolean hasExplicitDuration = (activeHealthGoal != null
                && activeHealthGoal.Phase_Duration_Days__c != null
                && activeHealthGoal.Phase_Duration_Days__c > 0);

            if (activeHealthGoal != null) {
                Date phaseAnchorDate = (currentPhase == 'reverse' && activeHealthGoal.Target_Reached_Date__c != null)
                    ? activeHealthGoal.Target_Reached_Date__c
                    : activeHealthGoal.Goal_Start_Date__c;

                Integer durationDays = hasExplicitDuration
                    ? Integer.valueOf(activeHealthGoal.Phase_Duration_Days__c)
                    : (currentPhase == 'reverse' ? 21 : null);

                if (durationDays != null) {
                    totalPhaseWeeks = Math.max(1, (Integer)Math.ceil(durationDays / 7.0));
                }

                if (phaseAnchorDate != null) {
                    Integer daysElapsed = Math.max(0, phaseAnchorDate.daysBetween(todayDate));
                    Integer computedWeek = (Integer)Math.floor(daysElapsed / 7.0) + 1;
                    currentPhaseWeek = totalPhaseWeeks != null ? Math.min(totalPhaseWeeks, computedWeek) : computedWeek;
                }
            }
            metrics.put('currentPhaseWeek', currentPhaseWeek);
            metrics.put('totalPhaseWeeks', totalPhaseWeeks);

            // Financial Goal Progress Percentage
            Integer financialProgress = 0;
            if (financialTarget > 0) {
                financialProgress = Math.max(0, Math.min(100, Math.round((financialBalance / financialTarget) * 100)));
            }
            metrics.put('financialProgress', financialProgress);

            // 5. Biometrics, TDEE, Target Calories & Clinical Status
            Date lookbackThreshold = todayDate.addDays(-21);
            List<Health_Data__c> healthLogs = [
                SELECT Weight_lbs__c, Calories__c, Entry_Date__c, Protein_g__c,
                       Carbs_g__c, Fat_g__c, TDEE__c, Body_Fat__c
                FROM Health_Data__c
                WHERE Calories__c != null
                  AND Weight_lbs__c != null
                  AND Entry_Date__c >= :lookbackThreshold
                  AND Entry_Date__c <= TODAY
                ORDER BY Entry_Date__c DESC
                LIMIT 15
            ];

            Decimal currentBodyWeight = 0.0;
            Integer targetCalories = 0;
            String weightTrend = 'PLATEAU';
            Decimal dailySlope = 0.0;
            String clinicalStatus = 'OPTIMAL';
            String statusColor = 'optimal';

            if (!healthLogs.isEmpty()) {
                Health_Data__c latestLog = healthLogs[0];
                currentBodyWeight = latestLog.Weight_lbs__c;
                metrics.put('currentBodyWeight', currentBodyWeight);
                metrics.put('caloriesConsumed', latestLog.Calories__c);
                metrics.put('proteinGrams', latestLog.Protein_g__c != null ? latestLog.Protein_g__c : 0);
                metrics.put('carbsGrams', latestLog.Carbs_g__c != null ? latestLog.Carbs_g__c : 0);
                metrics.put('fatGrams', latestLog.Fat_g__c != null ? latestLog.Fat_g__c : 0);

                if (healthLogs.size() >= 2) {
                    Health_Data__c previousLog = healthLogs[1];
                    weightTrend = latestLog.Weight_lbs__c == previousLog.Weight_lbs__c
                        ? 'PLATEAU'
                        : (latestLog.Weight_lbs__c > previousLog.Weight_lbs__c ? 'DECAY' : 'OPTIMAL');
                }

                Integer rollingTdee = latestLog.TDEE__c != null ? Math.round(latestLog.TDEE__c) : 2500;
                metrics.put('rollingTdee', rollingTdee);

                dailySlope = calculateWeightSlope(healthLogs);
                Decimal weeklyVelocity = (dailySlope * 7.0).setScale(2);
                metrics.put('weeklyVelocity', weeklyVelocity);

                if (currentPhase == 'cutting' || currentPhase == 'mini-cut' || currentPhase == 'minicut') {
                    Decimal deficitPct = (activeHealthGoal != null && activeHealthGoal.Caloric_Deficit_Percentage__c != null)
                        ? activeHealthGoal.Caloric_Deficit_Percentage__c
                        : 20.0;
                    Decimal multiplier = Math.max(0.50, 1.0 - (deficitPct / 100.0));
                    targetCalories = Math.round(rollingTdee * multiplier);

                    if (weeklyVelocity < -2.2) {
                        clinicalStatus = 'DANGER';
                        statusColor = 'danger';
                    } else if (weeklyVelocity < -1.6) {
                        clinicalStatus = 'CAUTION';
                        statusColor = 'caution';
                    } else if (weeklyVelocity > -0.25) {
                        clinicalStatus = 'STALLED';
                        statusColor = 'stalled';
                    } else {
                        clinicalStatus = 'OPTIMAL';
                        statusColor = 'optimal';
                    }
                } else if (currentPhase == 'reverse' && activeHealthGoal != null) {
                    clinicalStatus = 'RECOVERY';
                    statusColor = 'recovery';

                    Date anchorDate = activeHealthGoal.Target_Reached_Date__c != null
                        ? activeHealthGoal.Target_Reached_Date__c
                        : activeHealthGoal.Goal_Start_Date__c;
                    Integer daysElapsed = anchorDate != null ? Math.max(0, anchorDate.daysBetween(todayDate)) : 0;
                    Integer durationDays = hasExplicitDuration
                        ? Integer.valueOf(activeHealthGoal.Phase_Duration_Days__c)
                        : 21;

                    Decimal calorieFloor = rollingTdee * 0.85;
                    Decimal calorieSpread = rollingTdee - calorieFloor;

                    if (daysElapsed >= durationDays) {
                        targetCalories = rollingTdee;
                    } else {
                        Integer totalWeeks = Math.max(1, (Integer)Math.ceil(durationDays / 7.0));
                        Integer currentWeek = Math.min(totalWeeks, (Integer)Math.floor(daysElapsed / 7.0));
                        Decimal weeklyStep = calorieSpread / totalWeeks;
                        targetCalories = Math.round(calorieFloor + (currentWeek * weeklyStep));
                    }
                } else if (currentPhase == 'bulking' || currentPhase == 'maintenance') {
                    Decimal targetVelocity = (currentPhase == 'bulking') ? 0.2 : 0.0;
                    Decimal velocityError = weeklyVelocity - targetVelocity;
                    Decimal lambda = (currentPhase == 'bulking' && velocityError < 0) ? 1.0 : calculateLambda(healthLogs);
                    Decimal steeringAdjustment = (velocityError * 500) * lambda;
                    Decimal baseCalories = (currentPhase == 'bulking') ? rollingTdee + 100 : rollingTdee;
                    targetCalories = Math.round(baseCalories - steeringAdjustment);

                    if (currentPhase == 'bulking') {
                        if (weeklyVelocity > 1.25) {
                            clinicalStatus = 'CAUTION';
                            statusColor = 'caution';
                        } else if (weeklyVelocity < 0.1) {
                            clinicalStatus = 'STALLED';
                            statusColor = 'stalled';
                        } else {
                            clinicalStatus = 'OPTIMAL';
                            statusColor = 'optimal';
                        }
                    } else {
                        clinicalStatus = Math.abs(weeklyVelocity) <= 0.6 ? 'OPTIMAL' : 'CAUTION';
                        statusColor = Math.abs(weeklyVelocity) <= 0.6 ? 'optimal' : 'caution';
                    }
                } else {
                    targetCalories = rollingTdee;
                }
            }

            metrics.put('targetCalories', targetCalories);
            metrics.put('weightTrend', weightTrend);
            metrics.put('clinicalStatus', clinicalStatus);
            metrics.put('statusColor', statusColor);

            // 6. Health Goal Progress & Target Date Projection (Time-Bound ONLY when Phase_Duration_Days__c > 0)
            Date resolvedEndDate = null;
            if (hasExplicitDuration && currentPhase != 'bulking') {
                if (activeHealthGoal.Target_End_Date__c != null) {
                    resolvedEndDate = activeHealthGoal.Target_End_Date__c;
                } else if (activeHealthGoal.Goal_Start_Date__c != null) {
                    resolvedEndDate = activeHealthGoal.Goal_Start_Date__c.addDays(Integer.valueOf(activeHealthGoal.Phase_Duration_Days__c));
                }
            }

            Integer healthProgress = 0;
            if (resolvedEndDate != null && activeHealthGoal.Goal_Start_Date__c != null) {
                Integer totalSpan = Math.max(1, activeHealthGoal.Goal_Start_Date__c.daysBetween(resolvedEndDate));
                Integer elapsed = Math.max(0, activeHealthGoal.Goal_Start_Date__c.daysBetween(todayDate));
                healthProgress = Math.max(0, Math.min(100, Math.round(((Decimal)elapsed / totalSpan) * 100)));

                Integer remainingDays = Math.max(0, todayDate.daysBetween(resolvedEndDate));
                metrics.put('healthDaysRemaining', String.valueOf(remainingDays));
                metrics.put('healthProjectedDate', String.valueOf(resolvedEndDate));
            } else {
                // Dynamic Weight-Target Progress & Velocity Slope Projection (e.g., Phase III Bulk -> 225 lbs)
                if (currentBodyWeight > 0 && healthTarget > 0) {
                    if (currentPhase == 'bulking' || currentPhase == 'reverse') {
                        Decimal totalDiff = healthTarget - healthStart;
                        Decimal achievedDiff = currentBodyWeight - healthStart;
                        healthProgress = totalDiff > 0 ? Math.max(0, Math.min(100, Math.round((achievedDiff / totalDiff) * 100))) : 0;
                    } else {
                        Decimal totalDiff = healthStart - healthTarget;
                        Decimal achievedDiff = healthStart - currentBodyWeight;
                        healthProgress = totalDiff > 0 ? Math.max(0, Math.min(100, Math.round((achievedDiff / totalDiff) * 100))) : 0;
                    }
                }

                if (!healthLogs.isEmpty() && healthTarget > 0 && currentBodyWeight != healthTarget && dailySlope != 0) {
                    Boolean isValidDirection = (((currentPhase == 'cutting' || currentPhase == 'mini-cut' || currentPhase == 'minicut') && dailySlope < 0) ||
                                                ((currentPhase == 'bulking' || currentPhase == 'reverse') && dailySlope > 0));
                    if (isValidDirection) {
                        Integer daysToGoal = (Integer)((currentBodyWeight - healthTarget).abs() / dailySlope.abs());
                        Date projectedHealthDate = healthLogs[0].Entry_Date__c.addDays(daysToGoal);
                        Integer remainingHealthDays = Math.max(0, todayDate.daysBetween(projectedHealthDate));
                        metrics.put('healthDaysRemaining', String.valueOf(remainingHealthDays));
                        metrics.put('healthProjectedDate', String.valueOf(projectedHealthDate));
                    } else {
                        metrics.put('healthDaysRemaining', 'STALLED');
                        metrics.put('healthProjectedDate', 'STALLED');
                    }
                } else {
                    metrics.put('healthDaysRemaining', 'STALLED');
                    metrics.put('healthProjectedDate', 'STALLED');
                }
            }
            metrics.put('healthProgress', healthProgress);

            // 7. Financial Goal Cash-Flow Projection Simulation
            List<Budget_Category__c> budgets = [
                SELECT Monthly_Allocation__c, Actual_Spent__c, Day_of_Month__c, Frequency__c
                FROM Budget_Category__c
                WHERE Monthly_Allocation__c > 0
            ];
            List<Pay_Period__c> payPeriods = [
                SELECT Net_Extraction__c, Pay_Date__c
                FROM Pay_Period__c
                WHERE associated_goal__c = :financialGoalId
                  AND Status__c = 'Projected'
                  AND Pay_Date__c >= TODAY
                ORDER BY Pay_Date__c ASC
            ];

            Decimal simulatedBalance = financialBalance;
            Integer forecastDays = 0;
            Date simDate = todayDate;

            while (simulatedBalance < financialTarget && forecastDays < 730) {
                forecastDays++;
                simDate = simDate.addDays(1);
                for (Integer i = payPeriods.size() - 1; i >= 0; i--) {
                    if (payPeriods[i].Pay_Date__c == simDate) {
                        simulatedBalance += payPeriods[i].Net_Extraction__c;
                        payPeriods.remove(i);
                    }
                }
                for (Budget_Category__c bc : budgets) {
                    Integer billDay = (bc.Day_of_Month__c != null) ? Integer.valueOf(bc.Day_of_Month__c) : null;
                    if (bc.Frequency__c == 'Every month' && billDay != null) {
                        if (simDate.month() == todayDate.month() && simDate.year() == todayDate.year()) {
                            Decimal remaining = bc.Monthly_Allocation__c - (bc.Actual_Spent__c != null ? bc.Actual_Spent__c : 0);
                            if (simDate.day() == billDay && remaining > 0) {
                                simulatedBalance -= remaining;
                            }
                        } else if (simDate.day() == billDay) {
                            simulatedBalance -= bc.Monthly_Allocation__c;
                        }
                    } else {
                        simulatedBalance -= (bc.Monthly_Allocation__c / 30.44);
                    }
                }
            }
            metrics.put('financialDaysRemaining', forecastDays >= 730 ? '730+' : String.valueOf(forecastDays));
            metrics.put('financialProjectedDate', forecastDays >= 730 ? '730+ DAYS' : String.valueOf(todayDate.addDays(forecastDays)));

        } catch (Exception ex) {
            throw new AuraHandledException('Error loading dashboard metrics: ' + ex.getMessage());
        }

        return metrics;
    }

    @AuraEnabled(cacheable=true)
    public static List<Health_Data__c> getHealthHistory() {
        return [
            SELECT Entry_Date__c, Weight_lbs__c, Calories__c, Protein_g__c,
                   Carbs_g__c, Fat_g__c, TDEE__c, Body_Fat__c,
                   Fat_Mass__c, Lean_Body_Mass__c
            FROM Health_Data__c
            WHERE Entry_Date__c != null
              AND Entry_Date__c <= TODAY
            ORDER BY Entry_Date__c ASC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<FinancialHistoryItem> getFinancialHistory() {
        List<FinancialHistoryItem> history = new List<FinancialHistoryItem>();
        List<Financial_Data__c> transactions = [
            SELECT Transaction_Amount__c, Transaction_Date__c, Transaction_Type__c
            FROM Financial_Data__c
            WHERE Transaction_Date__c != null
              AND Transaction_Date__c <= TODAY
            ORDER BY Transaction_Date__c ASC
        ];
        for (Financial_Data__c trans : transactions) {
            history.add(new FinancialHistoryItem(
                String.valueOf(trans.Transaction_Date__c),
                trans.Transaction_Amount__c,
                trans.Transaction_Type__c
            ));
        }
        return history;
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, String> getMetricStats(String node, String metric, String timeframe) {
        Map<String, String> stats = new Map<String, String>();
        stats.put('avg', 'N/A');
        stats.put('min', 'N/A');
        stats.put('max', 'N/A');

        Date startDate = Date.today();
        if (timeframe == '7D') {
            startDate = startDate.addDays(-7);
        } else if (timeframe == '30D') {
            startDate = startDate.addDays(-30);
        } else {
            startDate = Date.newInstance(startDate.year(), 1, 1);
        }

        Map<String, String> fieldMap = new Map<String, String>();
        fieldMap.put('WEIGHT', 'Weight_lbs__c');
        fieldMap.put('TDEE', 'TDEE__c');
        fieldMap.put('CALORIES', 'Calories__c');
        fieldMap.put('PROTEIN', 'Protein_g__c');
        fieldMap.put('CARBS', 'Carbs_g__c');
        fieldMap.put('FAT', 'Fat_g__c');
        fieldMap.put('BODY FAT', 'Body_Fat__c');
        fieldMap.put('CASH FLOW', 'Transaction_Amount__c');

        String field = fieldMap.get(metric);
        if (String.isBlank(field)) {
            return stats;
        }

        String obj = (node == 'HEALTH') ? 'Health_Data__c' : 'Financial_Data__c';
        String dateField = (node == 'HEALTH') ? 'Entry_Date__c' : 'Transaction_Date__c';

        String query = 'SELECT AVG(' + field + ') avgVal, MIN(' + field + ') minVal, MAX(' + field + ') maxVal ' +
                       'FROM ' + obj + ' WHERE ' + dateField + ' >= :startDate AND ' + dateField + ' <= TODAY AND ' + field + ' != null';

        List<AggregateResult> records = Database.query(query);
        if (records.isEmpty() || records[0].get('avgVal') == null) {
            return stats;
        }

        Decimal avgVal = (Decimal)records[0].get('avgVal');
        Decimal minVal = (Decimal)records[0].get('minVal');
        Decimal maxVal = (Decimal)records[0].get('maxVal');

        Integer precision = (metric == 'CALORIES' || metric == 'TDEE') ? 0 : 1;
        String unit = (metric == 'WEIGHT') ? ' lbs'
                    : (metric == 'CALORIES' || metric == 'TDEE' ? ' kcal'
                    : (metric == 'BODY FAT' ? '%' : 'g'));

        if (node == 'FINANCIAL') {
            stats.put('avg', '$' + avgVal.setScale(2).format());
            stats.put('min', '$' + minVal.setScale(2).format());
            stats.put('max', '$' + maxVal.setScale(2).format());
        } else {
            stats.put('avg', avgVal.setScale(precision).format() + unit);
            stats.put('min', minVal.setScale(precision).format() + unit);
            stats.put('max', maxVal.setScale(precision).format() + unit);
        }

        return stats;
    }

    private static Decimal calculateWeightSlope(List<Health_Data__c> descendingLogs) {
        if (descendingLogs == null || descendingLogs.size() < 2) {
            return 0.0;
        }
        if (descendingLogs.size() == 2) {
            Integer days = descendingLogs[1].Entry_Date__c.daysBetween(descendingLogs[0].Entry_Date__c);
            Decimal span = (days <= 0) ? 1.0 : Decimal.valueOf(days);
            return (descendingLogs[0].Weight_lbs__c - descendingLogs[1].Weight_lbs__c) / span;
        }

        List<Health_Data__c> chronoLogs = new List<Health_Data__c>();
        for (Integer i = descendingLogs.size() - 1; i >= 0; i--) {
            chronoLogs.add(descendingLogs[i]);
        }

        Integer count = chronoLogs.size();
        Decimal sumX = 0;
        Decimal sumY = 0;
        Decimal sumXY = 0;
        Decimal sumX2 = 0;
        Date firstDate = chronoLogs[0].Entry_Date__c;

        for (Health_Data__c log : chronoLogs) {
            Decimal x = firstDate.daysBetween(log.Entry_Date__c);
            Decimal y = log.Weight_lbs__c;
            sumX += x;
            sumY += y;
            sumXY += (x * y);
            sumX2 += (x * x);
        }

        Decimal divisor = (count * sumX2) - (sumX * sumX);
        return divisor == 0 ? 0.0 : ((count * sumXY) - (sumX * sumY)) / divisor;
    }

    private static Decimal calculateLambda(List<Health_Data__c> logs) {
        if (logs.size() < 3 || logs[0].Body_Fat__c == null || logs[logs.size() - 1].Body_Fat__c == null) {
            return 1.0;
        }
        Decimal fatDelta = (logs[0].Weight_lbs__c * (logs[0].Body_Fat__c / 100.0))
                         - (logs[logs.size() - 1].Weight_lbs__c * (logs[logs.size() - 1].Body_Fat__c / 100.0));
        Decimal weightDelta = logs[0].Weight_lbs__c - logs[logs.size() - 1].Weight_lbs__c;

        if (weightDelta == 0) {
            return 0.5;
        }
        Decimal compositionRatio = (weightDelta > 0) ? (fatDelta / weightDelta) : (weightDelta / fatDelta);
        return Math.max(0.1, Math.min(1.0, compositionRatio.setScale(2)));
    }
}