({
    /* --- EXECUTIVE VETO: CLOSE DRAWER --- */
    toggleDrawer : function(component, event, helper) {
        // Manually overrides the isOpen attribute to collapse the drawer
        component.set("v.isOpen", false);
    }
})