// Accordion functionality
document.querySelectorAll('.accordion__header').forEach(function(header) {
    header.addEventListener('click', function() {
        var content = this.nextElementSibling;
        var icon = this.querySelector('.icon');

        // Close other open items
        document.querySelectorAll('.accordion__content').forEach(function(item) {
            if (item !== content) {
                item.style.maxHeight = null;
                var otherIcon = item.previousElementSibling.querySelector('.icon');
                if (otherIcon) otherIcon.textContent = '+';
            }
        });

        // Toggle current
        if (content.style.maxHeight) {
            content.style.maxHeight = null;
            if (icon) icon.textContent = '+';
        } else {
            content.style.maxHeight = content.scrollHeight + 'px';
            if (icon) icon.textContent = '−';
        }
    });
});
