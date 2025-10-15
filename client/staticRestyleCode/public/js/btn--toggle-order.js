const sortControlDivs = Array.from(document.querySelectorAll('#sort-fieldset .sort-control'));
const enableSortRuleCheckboxInputs = Array.from(document.querySelectorAll('#sort-fieldset .control__input'));

// Hairy state. A framework might make this a lot better.

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
        const negatedOrderIconText = negatedOrderString == 'asc' ? '↑' : '↓';
        
        a11yNextOrderTextSpan.textContent = enableSortRuleCheckboxInput.value;
        enableSortRuleCheckboxInput.value = negatedOrderString;
        
        a11yCurrentOrderTextSpan.textContent = negatedOrderString;
        
        currentSortOrderIndicator.textContent = negatedOrderIconText;
        
        // Send a web request and update the URL to include query parameters (in case the user shares their query to other users via URL)
    });
});

// Handle click to enable sort rule
enableSortRuleCheckboxInputs.forEach(
    enableSortRuleCheckboxInput => enableSortRuleCheckboxInput.addEventListener(event => {
    // Send a web request and update the URL to include query parameters (in case the user shares their query to other users via URL)

    // Use the checkbox's value attribute
}));