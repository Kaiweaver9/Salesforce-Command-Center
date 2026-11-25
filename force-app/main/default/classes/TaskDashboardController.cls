public with sharing class TaskDashboardController {

    public class TaskItemWrapper {
        @AuraEnabled public Id id;
        @AuraEnabled public String subject;
        @AuraEnabled public Date activityDate;
        @AuraEnabled public String status;
        @AuraEnabled public Boolean isCompleted;
        @AuraEnabled public String category;
        @AuraEnabled public Id goalId;
        @AuraEnabled public String goalName;
        @AuraEnabled public String description;
        @AuraEnabled public String externalSyncId;
    }

    public class GoalOptionWrapper {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String goalType;
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getTaskDashboardData(Date startDate, Date endDate) {
        Date rangeStart = startDate != null ? startDate : Date.today().addDays(-14);
        Date rangeEnd = endDate != null ? endDate : Date.today().addDays(35);

        List<Task> tasks = [
            SELECT Id, Subject, ActivityDate, Status, IsClosed,
                   Category__c, Goal__c, Goal__r.Name,
                   Description, External_Sync_Id__c
            FROM Task
            WHERE ActivityDate >= :rangeStart
              AND ActivityDate <= :rangeEnd
            ORDER BY ActivityDate ASC, CreatedDate ASC
            LIMIT 500
        ];

        List<TaskItemWrapper> taskItems = new List<TaskItemWrapper>();
        for (Task t : tasks) {
            TaskItemWrapper item = new TaskItemWrapper();
            item.id = t.Id;
            item.subject = t.Subject;
            item.activityDate = t.ActivityDate;
            item.status = t.Status;
            item.isCompleted = t.IsClosed || t.Status == 'Completed';
            item.category = String.isNotBlank(t.Category__c) ? t.Category__c : 'General';
            item.goalId = t.Goal__c;
            item.goalName = t.Goal__c != null ? t.Goal__r.Name : null;
            item.description = t.Description;
            item.externalSyncId = t.External_Sync_Id__c;
            taskItems.add(item);
        }

        List<Goal_Setting__c> goals = [
            SELECT Id, Name, Goal_Type__c
            FROM Goal_Setting__c
            WHERE Target_Reached_Date__c = null
            ORDER BY Display_on_Command_Center__c DESC, Name ASC
            LIMIT 100
        ];

        List<GoalOptionWrapper> goalOptions = new List<GoalOptionWrapper>();
        for (Goal_Setting__c g : goals) {
            GoalOptionWrapper opt = new GoalOptionWrapper();
            opt.id = g.Id;
            opt.name = g.Name;
            opt.goalType = g.Goal_Type__c;
            goalOptions.add(opt);
        }

        return new Map<String, Object>{
            'tasks' => taskItems,
            'goals' => goalOptions,
            'today' => Date.today()
        };
    }

    @AuraEnabled
    public static void toggleTaskCompletion(Id taskId, Boolean isCompleted) {
        if (taskId == null) {
            throw new AuraHandledException('Task ID is required.');
        }
        Task recordToUpdate = new Task(
            Id = taskId,
            Status = isCompleted ? 'Completed' : 'Not Started'
        );
        update recordToUpdate;
    }

    @AuraEnabled
    public static void updateTaskAssignment(Id taskId, Id goalId, String category) {
        if (taskId == null) {
            throw new AuraHandledException('Task ID is required.');
        }
        Task recordToUpdate = new Task(Id = taskId);
        recordToUpdate.Goal__c = goalId;
        if (String.isNotBlank(category)) {
            recordToUpdate.Category__c = category;
        }
        update recordToUpdate;
    }
}