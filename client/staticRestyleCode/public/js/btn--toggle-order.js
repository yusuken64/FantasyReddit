const sortControlDivs = Array.from(document.querySelectorAll('#sort-fieldset .sort-control'));
const enableSortRuleCheckboxInputs = Array.from(document.querySelectorAll('#sort-fieldset .control__input'));

// Debounce to keep state and animation in sync
let isChangingState = false;

/*
 * Add +180deg to the passed element's rotation.
 */
function flipElementClockwise(element) {    
    // At first, nothing will be set on style.rotate, as it purely reflects direct mutation, not computed.
    // So we use the computed rotation value; it's fine since the isChangingState lock prevents de-sync.
    const computedStyleObject = getComputedStyle(element);
    const currentRotationValueString = computedStyleObject.getPropertyValue("rotate");
    
    const currentRotationDeg = Number(currentRotationValueString.slice(0, -3)); // remove 'deg' from the end
    
    const animationTo = element.animate(
        [
            // I guess precision loss will occur once the max int size is hit.
            // But hey, if they get there then they'll get a fun (broken) animation as an easter-egg.
            { rotate: `${currentRotationDeg + 180}deg` },
        ],
        {
            duration: .2 * 1000, // .2 seconds
            easing: "ease",
            composite: "replace",
            fill: "forwards",
        },
    );
    
    animationTo.addEventListener('finish', () => {
        // Update the element's .style property so we can use it for future animations
        animationTo.commitStyles();
        animationTo.cancel();
        
        isChangingState = false;
    });
}

// Warning: hairy state management. A framework might make this a lot better.

sortControlDivs.forEach(sortControlDiv => {
    const enableSortRuleCheckboxInput = sortControlDiv.querySelector('.control__input');
    const toggleSortOrderButton = sortControlDiv.querySelector('.btn--toggle-order');
    const sortTypeLabel = sortControlDiv.querySelector('.control__label');
    
    // Show screen readers what the next order will be when the order toggler is clicked.
    // e.g ascending if the current order is descending.
    const a11yNextOrderTextSpan = toggleSortOrderButton.querySelector('.next-order-text');
    // Show screen readers a label with the current active sort order.
    const a11yCurrentOrderTextSpan = sortControlDiv.querySelector('.control__label .current-order-text');
    const currentSortOrderIndicator = toggleSortOrderButton.querySelector('.order-icon');
    
    // Order (asc/desc) button handler
    toggleSortOrderButton.addEventListener('click', (event) => {
        if (!isChangingState) {
            isChangingState = true; // Prevent state de-sync issues
            
            // No need to call stopPropogation(),
            // ... since the checkbox input and sort order button don't have a parent-child relationship.
            const currentOrderValue = enableSortRuleCheckboxInput.value;
            
            // User tampered with sort rule input value or logic errors occured.
            if (currentOrderValue != 'desc' && currentOrderValue != 'asc') {
                throw new Error('enableSortRuleCheckboxInput must have a value of desc or asc.')
            }
            
            const negatedOrderString = currentOrderValue == 'desc' ? 'asc' : 'desc';
            
            a11yNextOrderTextSpan.textContent = enableSortRuleCheckboxInput.value;
            enableSortRuleCheckboxInput.value = negatedOrderString;
            
            // Update hover title
            const sortTypeLabelDirectTextNode = sortTypeLabel.childNodes[0];
            const sortTypeLabelDirectTextContent = sortTypeLabelDirectTextNode.textContent.trim();
            const finalHoverTitleText = `${sortTypeLabelDirectTextContent} ${negatedOrderString}ending`;
            sortControlDiv.setAttribute('title', finalHoverTitleText);
            
            a11yCurrentOrderTextSpan.textContent = negatedOrderString;
            
            rotateSortIndicator(currentSortOrderIndicator);
            
            // For Yusuke:
            // Send a web request and update the URL to include query parameters (in case the user shares their query to other users via URL)
        }
    });
});

// Handle click to enable sort rule
enableSortRuleCheckboxInputs.forEach(
    enableSortRuleCheckboxInput => enableSortRuleCheckboxInput.addEventListener('click', event => {
    // For Yusuke:
    // Send a web request and update the URL to include query parameters (in case the user shares their query to other users via URL)
    // Use the checkbox's value attribute
}));