const sidebarToggleButton = document.getElementById('btn--toggle-sidebar');
const sidebar = document.getElementById('sidebar');

// WARNING: this must be made into a module script for namespace separation

// Debounce
let isAnimating = false;

// Updated sidebar toggle state for use in event handler
let newIsSidebarToggled;

// Handle toggle button click
sidebarToggleButton.addEventListener('click', (event) => {
    if (!isAnimating) {
        isAnimating = true;
        
        const initialIsSidebarToggled = sidebarToggleButton.getAttribute('aria-expanded');
        
        // User tampered with the aria-expanded value.
        if (initialIsSidebarToggled != 'true' && initialIsSidebarToggled != 'false') {
            throw new Error(`Invalid aria-expanded value provided: '${initialIsSidebarToggled}'.`)
        }
        
        // firstIsSidebarToggled is a string, so we must use this logic to negate it,
        // ... as Boolean(non_empty_string) results in `true`.
        newIsSidebarToggled = initialIsSidebarToggled == 'false' ? 'true' : 'false';
        
        sidebarToggleButton.setAttribute(
            'aria-expanded',
            newIsSidebarToggled
        );
        
        if (newIsSidebarToggled == 'false') {
            // Play closing animation
            sidebar.classList.add('closing');
        }
        else {
            // We want to manually control the popover instead of using the popovertarget attribute,
            // ... since the animation will go out of sync given that the popover events aren't bound
            // ... by the animation by default.
            // Thus we handle shows and hides via JS ourselves, not with the free popovertarget attr for a button.
            // We shouldn't use the beforetoggle event either, since we can only cancel a show state,
            // ... not a hide state.
            
            sidebar.showPopover(); // Acts like `display: block | inline`
            // Play opening animation
            sidebar.classList.add('opening');
        }
    }
});

// Handle animation finish
sidebar.addEventListener('animationend', (event) => {
    // Note to self for the future:
    // We should define this event listener outside of the click event.
    // For one, it would add a new event listener for each click, which is not the desired logic.
    // Secondly, if we were to also define newIsSidebarToggled within the click handler,
    // ... a 'animationend' closure will reference the newIsSidebarToggled definition from when the event listener
    // ... was first defined (when the user first opens the sidebar).
    // Multiple animationend event listeners would fight, and also
    // ... a new newIsSidebarToggled variable would be created for each click.
    
    if (newIsSidebarToggled == 'false') {
        sidebar.classList.remove('closing');
        sidebar.hidePopover(); // Acts like `display: none`
    }
    else {
        sidebar.classList.remove('opening');
    }
    
    isAnimating = false;
});