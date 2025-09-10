// Hero Slider JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const heroTrack = document.querySelector('.hero-photo-track');
    const heroSlides = document.querySelectorAll('.hero-photo-slide');
    
    if (heroTrack && heroSlides.length > 0) {
        console.log('Hero slider initialized with', heroSlides.length, 'slides');
        
        // Ensure slides are properly sized
        heroSlides.forEach((slide, index) => {
            slide.style.width = '50%';
            slide.style.flexShrink = '0';
            slide.style.height = '100%';
            console.log(`Slide ${index + 1}:`, slide.style.backgroundImage);
        });
        
        // Add pause on hover functionality
        heroTrack.addEventListener('mouseenter', function() {
            heroTrack.style.animationPlayState = 'paused';
        });
        
        heroTrack.addEventListener('mouseleave', function() {
            heroTrack.style.animationPlayState = 'running';
        });
        
        // Force animation restart with correct timing
        setTimeout(() => {
            heroTrack.style.animation = 'none';
            heroTrack.offsetHeight; // Trigger reflow
            heroTrack.style.animation = 'heroSlide 6s ease-in-out infinite';
        }, 100);
        
        // Add debugging info
        console.log('Hero track width:', heroTrack.style.width);
        console.log('Hero track animation:', heroTrack.style.animation);
        
    } else {
        console.warn('Hero slider elements not found');
    }
});
