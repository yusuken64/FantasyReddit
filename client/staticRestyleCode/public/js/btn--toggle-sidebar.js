const sidebarToggleButton = document.getElementById('btn--toggle-sidebar');
const sidebar = document.getElementById('sidebar');

// Debounce
const animating = false;

sidebarToggleButton.addEventListener('click', (event) => {
    if (!animating) {
        animating = true;
        
        const isSidebarToggled = sidebarToggleButton.getAttribute('aria-expanded');
    
        // User tampered with the aria-expanded value.
        if (isSidebarToggled != 'true' && isSidebarToggled != 'false') {
            throw new Error(`Invalid aria-expanded value provided: '${isSidebarToggled}'.`)
        }
        
        const negatedIsSidebarToggled = isSidebarToggled == 'false' ? 'true' : 'false';
        
        if (negatedIsSidebarToggled) {
            mobileSidebar.showPopover(); // popover, as I like this behavior compared to trapping focus.
        }
        
        // Trigger close animation to occur (currently not implemented yet)
        sidebarToggleButton.setAttribute(
            'aria-expanded',
            negatedIsSidebarToggled
        );
        
        // Wait for current animation to finish
        sidebarToggleButton.addEventListener('animationend', () => {
            animating = false;
            
            mobileSidebar.hidePopover();
        });
    }
});