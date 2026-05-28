import { useEffect } from 'react';

export function useLandingEffects(visibleClass) {
  useEffect(() => {
    const reveals = document.querySelectorAll('[data-reveal]');
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, index) => {
          if (entry.isIntersecting) {
            setTimeout(() => entry.target.classList.add(visibleClass), index * 60);
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    reveals.forEach((element) => revealObserver.observe(element));

    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('[data-nav-link]');
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            navLinks.forEach((link) => {
              const active = link.getAttribute('href') === `#${entry.target.id}`;
              link.style.color = active ? 'var(--landing-text)' : 'var(--landing-muted)';
            });
          }
        });
      },
      { threshold: 0.3 }
    );
    sections.forEach((section) => sectionObserver.observe(section));

    return () => {
      revealObserver.disconnect();
      sectionObserver.disconnect();
    };
  }, [visibleClass]);
}
