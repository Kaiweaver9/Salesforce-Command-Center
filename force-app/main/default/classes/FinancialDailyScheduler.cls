public with sharing class FinancialDailyScheduler implements Schedulable {

    public void execute(SchedulableContext context) {
        // 1. Accrue Daily Interest on Active Student Loan Accounts
        List<Financial_Account__c> loanAccounts = [
            SELECT Id, Name, Current_Value__c, Interest_Rate__c, Principal_Balance__c
            FROM Financial_Account__c
            WHERE Name IN ('Student Loans Group: AA', 'Student Loans Group: AB')
              AND Interest_Rate__c != null
              AND Principal_Balance__c != null
        ];

        List<Financial_Account__c> accountsToUpdate = new List<Financial_Account__c>();
        for (Financial_Account__c loan : loanAccounts) {
            Decimal annualRateDecimal = loan.Interest_Rate__c / 100.0;
            Decimal dailyInterest = (Math.abs(loan.Principal_Balance__c) * annualRateDecimal) / 365.25;
            loan.Current_Value__c -= dailyInterest.setScale(2, System.RoundingMode.HALF_UP);
            accountsToUpdate.add(loan);
        }

        if (!accountsToUpdate.isEmpty()) {
            update accountsToUpdate;
        }

        // 2. Capture End-of-Day Total Net Worth Snapshot
        List<Financial_Account__c> allAccounts = [
            SELECT Id, Current_Value__c
            FROM Financial_Account__c
            WHERE Current_Value__c != null
            ORDER BY CreatedDate ASC
        ];

        if (!allAccounts.isEmpty()) {
            Decimal totalNetWorth = 0.00;
            for (Financial_Account__c account : allAccounts) {
                totalNetWorth += account.Current_Value__c;
            }

            Date todayDate = Date.today();
            List<Financial_Data__c> existingSnapshots = [
                SELECT Id, Amount__c
                FROM Financial_Data__c
                WHERE Transaction_Type__c = 'Snapshot'
                  AND Transaction_Date__c = :todayDate
                LIMIT 1
            ];

            if (!existingSnapshots.isEmpty()) {
                existingSnapshots[0].Amount__c = totalNetWorth.setScale(2);
                update existingSnapshots[0];
            } else {
                insert new Financial_Data__c(
                    Financial_Account_Link__c = allAccounts[0].Id,
                    Transaction_Type__c = 'Snapshot',
                    Transaction_Date__c = todayDate,
                    Amount__c = totalNetWorth.setScale(2)
                );
            }
        }
    }
}