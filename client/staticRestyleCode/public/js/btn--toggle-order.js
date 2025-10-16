const sortControlDivs = Array.from(document.querySelectorAll('#sort-fieldset .sort-control'));
const enableSortRuleCheckboxInputs = Array.from(document.querySelectorAll('#sort-fieldset .control__input'));

/*
 * Add +180deg to the arrow's rotation.
 * If the current rotation is 360deg, reset to 0.
 * Saves memory (given the reset) and is the best way to achieve a
 * counter-clockwise rotation animation like this.
 */
function rotateSortIndicator(sortIndicatorElement) {
    debugger;
    const currentStyleObject = getComputedStyle(sortIndicatorElement);
    const currentRotationValueString = currentStyleObject.getPropertyValue("rotate");
    const currentRotationDeg = Number(currentRotationValueString.slice(0, -3)); // remove 'deg' from the end
    
    // Don't use up more memory than we need.
    if (currentRotationDeg == 360) {
        currentRotationDeg = 0;
    }
    
    const keyFrame = new KeyframeEffect(
        sortIndicatorElement,
        // Properties
        [
            { rotate: `${currentRotationDeg + 180}deg` },
        ],
        // Keyframe options
        {
            duration: .2 * 1000, // .2 seconds
            easing: "ease",
            composite: "add",
            fill: "forwards",
        },
    )
    const animationTo = new Animation(keyFrame);
    animationTo.play();
}

// Hairy state management. A framework might make this a lot better.

// Controls default to descending order until the user toggles the order.
sortControlDivs.forEach(sortControlDiv => {
    const enableSortRuleCheckboxInput = sortControlDiv.querySelector('.control__input');
    const toggleSortOrderButton = sortControlDiv.querySelector('.btn--toggle-order');
    
    // Show screen readers what the next order will be when the order toggler is clicked.
    // e.g ascending if the current order is descending.
    const a11yNextOrderTextSpan = toggleSortOrderButton.querySelector('.next-order-text');
    // Show screen readers a label with the current active sort order.
    const a11yCurrentOrderTextSpan = sortControlDiv.querySelector('.control__label .current-order-text');
    const currentSortOrderIndicator = toggleSortOrderButton.querySelector('.order-icon');
    
    // Order (asc/desc) button handler
    toggleSortOrderButton.addEventListener('click', (event) => {
        // No need to stop propagation since the checkbox input and sort order button have not a parent-child relationship.
        
        const currentOrderValue = enableSortRuleCheckboxInput.value;
        
        // User tampered with sort rule input value or logic errors occured.
        if (currentOrderValue != 'desc' && currentOrderValue != 'asc') {
            throw new Error('enableSortRuleCheckboxInput must have a value of desc or asc.')
        }
        
        const negatedOrderString = currentOrderValue == 'desc' ? 'asc' : 'desc';
        // const negatedOrderIconText = negatedOrderString == 'asc' ? '↑' : '↓';
        
        a11yNextOrderTextSpan.textContent = enableSortRuleCheckboxInput.value;
        enableSortRuleCheckboxInput.value = negatedOrderString;
        
        a11yCurrentOrderTextSpan.textContent = negatedOrderString;
        
        rotateSortIndicator(currentSortOrderIndicator);
        // currentSortOrderIndicator.textContent = negatedOrderIconText;
        
        // Send a web request and update the URL to include query parameters (in case the user shares their query to other users via URL)
    });
});

// Handle click to enable sort rule
enableSortRuleCheckboxInputs.forEach(
    enableSortRuleCheckboxInput => enableSortRuleCheckboxInput.addEventListener(event => {
    // Send a web request and update the URL to include query parameters (in case the user shares their query to other users via URL)

    // Use the checkbox's value attribute
}));