document.addEventListener('DOMContentLoaded', () => {
    const accordionHeaders = document.querySelectorAll('.accordion__header');

    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            const icon = header.querySelector('.icon');
            
            // Toggle current
            if (content.style.maxHeight) {
                content.style.maxHeight = null;
                icon.textContent = '+';
            } else {
                // Close others (optional, but good for UX)
                document.querySelectorAll('.accordion__content').forEach(c => c.style.maxHeight = null);
                document.querySelectorAll('.accordion__header .icon').forEach(i => i.textContent = '+');

                content.style.maxHeight = content.scrollHeight + "px";
                icon.textContent = '-';
            }
        });
    });
});
