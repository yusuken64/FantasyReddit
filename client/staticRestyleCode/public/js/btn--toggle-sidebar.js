const sidebarToggleButton = document.getElementById('btn--toggle-sidebar');
const sidebar = document.getElementById('sidebar');

// Debounce
let isAnimating = false;

sidebarToggleButton.addEventListener('click', (event) => {
    if (!isAnimating) {
        isAnimating = true;
        
        const initialIsSidebarToggled = sidebarToggleButton.getAttribute('aria-expanded');
    
        // User tampered with the aria-expanded value.
        if (initialIsSidebarToggled != 'true' && initialIsSidebarToggled != 'false') {
            throw new Error(`Invalid aria-expanded value provided: '${initialIsSidebarToggled}'.`)
        }
        
        // firstIsSidebarToggled is a string, so we must use this logic to negate it,
        // ... as Boolean(non_empty_string) results in true
        const newIsSidebarToggled = initialIsSidebarToggled == 'false' ? 'true' : 'false';
        
        // Will also trigger a close animation to occur (currently not implemented yet in the CSS)
        sidebarToggleButton.setAttribute(
            'aria-expanded',
            newIsSidebarToggled
        );
        
        if (newIsSidebarToggled == 'false') {
            // Play closing animation
            sidebar.classList.add('closing');
        }
        
        // Wait for current animation to finish
        sidebar.addEventListener('animationend', () => {
            // If user toggled to close, cleanup class after close animation completes.
            if (newIsSidebarToggled == 'false') {
                sidebar.classList.remove('closing');
            }
            
            isAnimating = false;
        });
    }
});