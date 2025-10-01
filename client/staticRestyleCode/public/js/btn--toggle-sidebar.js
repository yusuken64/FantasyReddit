const sidebarToggleButton = document.getElementById('btn--toggle-sidebar');
const sidebar = document.getElementById('sidebar');

const animating = false;

sidebarToggleButton.addEventListener('click', () => {
    if (!animating) {
        const isSidebarToggled = sidebarToggleButton.getAttribute('aria-expanded');
    
        // User tampered with the aria-expanded value.
        if (isSidebarToggled != 'true' && isSidebarToggled != 'false') {
            throw new Error(`Invalid aria-expanded value provided: '${isSidebarToggled}'.`)
        }
    
        const ariaExpandedBoolNegated = isSidebarToggled == 'false' ? 'true' : 'false';
        
        // Trigger close animation to occur
    
        sidebarToggleButton.setAttribute(
            'aria-expanded',
            ariaExpandedBoolNegated
        );
        
        // Wait for current animation to finish
        sidebarToggleButton.addEventListener('animationend', () => {
            animating = true;
        });
    }
});