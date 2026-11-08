document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.querySelector('.nav-toggle');
  const navMenu = document.querySelector('.nav-menu');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', navMenu.classList.contains('open'));
    });
  }

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  const heroImage = document.querySelector('.hero-image img');
  if (heroImage && !heroImage.src) {
    heroImage.src = 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=80';
  }

  const homeBlogSlider = document.querySelector('#home-blog-slider');
  if (homeBlogSlider && window.blogPlan?.length && window.createBlogImage) {
    const track = homeBlogSlider.querySelector('.home-blog-track');
    const dots = homeBlogSlider.querySelector('.home-blog-dots');
    const articles = window.blogPlan.slice(0, 6);
    const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
    let activeIndex = 0;
    let timer;
    const pages = Array.from({ length: Math.ceil(articles.length / 3) }, (_, pageIndex) => articles.slice(pageIndex * 3, pageIndex * 3 + 3));

    const renderArticle = (article) => {
      const title = window.englishText(article.title, `${article.categoryLabel} Guide ${article.id}`);
      return `<article class="home-blog-slide"><div class="blog-plan-card"><a class="blog-plan-image" href="blog-details.html?id=${article.id}"><img src="${window.createBlogImage(article)}" alt="Illustration for ${escapeHtml(title)}" loading="lazy" /></a><div class="blog-plan-card-body"><p class="blog-card-category">${escapeHtml(article.categoryLabel)}</p><h3>${escapeHtml(title)}</h3><div class="blog-card-footer"><span class="blog-planned-status"><i aria-hidden="true"></i> Planned article</span><a href="blog-details.html?id=${article.id}">Read Article <span aria-hidden="true">↗</span></a></div></div></div></article>`;
    };
    track.innerHTML = pages.map((page) => `<div class="home-blog-page">${page.map(renderArticle).join('')}</div>`).join('');
    dots.innerHTML = pages.map((page, index) => `<button class="home-blog-dot${index === 0 ? ' is-active' : ''}" type="button" aria-label="Show blog articles ${index * 3 + 1} to ${index * 3 + page.length}" aria-current="${index === 0 ? 'true' : 'false'}"></button>`).join('');

    const showBlogSlide = (index) => {
      activeIndex = (index + pages.length) % pages.length;
      track.style.transform = `translateX(-${activeIndex * 100}%)`;
      dots.querySelectorAll('.home-blog-dot').forEach((dot, dotIndex) => {
        const isActive = dotIndex === activeIndex;
        dot.classList.toggle('is-active', isActive);
        dot.setAttribute('aria-current', isActive ? 'true' : 'false');
      });
    };
    const restartBlogTimer = () => {
      window.clearInterval(timer);
      timer = window.setInterval(() => showBlogSlide(activeIndex + 1), Number(homeBlogSlider.dataset.autoplay) || 5000);
    };

    homeBlogSlider.querySelector('.home-blog-prev').addEventListener('click', () => { showBlogSlide(activeIndex - 1); restartBlogTimer(); });
    homeBlogSlider.querySelector('.home-blog-next').addEventListener('click', () => { showBlogSlide(activeIndex + 1); restartBlogTimer(); });
    dots.querySelectorAll('.home-blog-dot').forEach((dot, dotIndex) => dot.addEventListener('click', () => { showBlogSlide(dotIndex); restartBlogTimer(); }));
    homeBlogSlider.addEventListener('mouseenter', () => window.clearInterval(timer));
    homeBlogSlider.addEventListener('mouseleave', restartBlogTimer);
    restartBlogTimer();
  }

  const homeProjectSlider = document.querySelector('#home-project-slider');
  if (homeProjectSlider) {
    const track = homeProjectSlider.querySelector('.home-project-track');
    const projects = [...track.querySelectorAll('.project-card')];
    track.innerHTML = projects.map((project) => `<div class="home-project-page">${project.outerHTML}</div>`).join('');
    const pages = [...track.querySelectorAll('.home-project-page')];
    const dots = homeProjectSlider.querySelector('.home-project-dots');
    let activeIndex = 0;
    let timer;

    dots.innerHTML = pages.map((page, index) => `<button class="home-project-dot${index === 0 ? ' is-active' : ''}" type="button" aria-label="Show project slide ${index + 1}" aria-current="${index === 0 ? 'true' : 'false'}"></button>`).join('');
    const showProjectSlide = (index) => {
      activeIndex = (index + pages.length) % pages.length;
      track.style.transform = `translateX(-${activeIndex * 100}%)`;
      dots.querySelectorAll('.home-project-dot').forEach((dot, dotIndex) => {
        const isActive = dotIndex === activeIndex;
        dot.classList.toggle('is-active', isActive);
        dot.setAttribute('aria-current', isActive ? 'true' : 'false');
      });
    };
    const restartProjectTimer = () => {
      window.clearInterval(timer);
      timer = window.setInterval(() => showProjectSlide(activeIndex + 1), Number(homeProjectSlider.dataset.autoplay) || 6000);
    };

    homeProjectSlider.querySelector('.home-project-prev').addEventListener('click', () => { showProjectSlide(activeIndex - 1); restartProjectTimer(); });
    homeProjectSlider.querySelector('.home-project-next').addEventListener('click', () => { showProjectSlide(activeIndex + 1); restartProjectTimer(); });
    dots.querySelectorAll('.home-project-dot').forEach((dot, dotIndex) => dot.addEventListener('click', () => { showProjectSlide(dotIndex); restartProjectTimer(); }));
    homeProjectSlider.addEventListener('mouseenter', () => window.clearInterval(timer));
    homeProjectSlider.addEventListener('mouseleave', restartProjectTimer);
    restartProjectTimer();
  }

  const homeFocusSlider = document.querySelector('#home-focus-slider');
  if (homeFocusSlider) {
    const track = homeFocusSlider.querySelector('.home-focus-track');
    const focusCards = [...track.querySelectorAll('.home-focus-card')];
    track.innerHTML = focusCards.map((card) => `<div class="home-focus-page">${card.outerHTML}</div>`).join('');
    const pages = [...track.querySelectorAll('.home-focus-page')];
    const dots = homeFocusSlider.querySelector('.home-focus-dots');
    let activeIndex = 0;
    let timer;

    dots.innerHTML = pages.map((page, index) => `<button class="home-focus-dot${index === 0 ? ' is-active' : ''}" type="button" aria-label="Show agricultural focus slide ${index + 1}" aria-current="${index === 0 ? 'true' : 'false'}"></button>`).join('');
    const showFocusSlide = (index) => {
      activeIndex = (index + pages.length) % pages.length;
      track.style.transform = `translateX(-${activeIndex * 100}%)`;
      dots.querySelectorAll('.home-focus-dot').forEach((dot, dotIndex) => {
        const isActive = dotIndex === activeIndex;
        dot.classList.toggle('is-active', isActive);
        dot.setAttribute('aria-current', isActive ? 'true' : 'false');
      });
    };
    const restartFocusTimer = () => {
      window.clearInterval(timer);
      timer = window.setInterval(() => showFocusSlide(activeIndex + 1), Number(homeFocusSlider.dataset.autoplay) || 6000);
    };

    homeFocusSlider.querySelector('.home-focus-prev').addEventListener('click', () => { showFocusSlide(activeIndex - 1); restartFocusTimer(); });
    homeFocusSlider.querySelector('.home-focus-next').addEventListener('click', () => { showFocusSlide(activeIndex + 1); restartFocusTimer(); });
    dots.querySelectorAll('.home-focus-dot').forEach((dot, dotIndex) => dot.addEventListener('click', () => { showFocusSlide(dotIndex); restartFocusTimer(); }));
    homeFocusSlider.addEventListener('mouseenter', () => window.clearInterval(timer));
    homeFocusSlider.addEventListener('mouseleave', restartFocusTimer);
    restartFocusTimer();
  }

  const heroSlider = document.querySelector('.hero-slider');
  if (heroSlider) {
    const slides = [...heroSlider.querySelectorAll('.hero-slide')];
    const dots = [...heroSlider.querySelectorAll('.hero-slider-dot')];
    const previousButton = heroSlider.querySelector('.hero-slider-prev');
    const nextButton = heroSlider.querySelector('.hero-slider-next');
    let activeIndex = 0;
    let timer;

    const showSlide = (index) => {
      activeIndex = (index + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => slide.classList.toggle('is-active', slideIndex === activeIndex));
      dots.forEach((dot, dotIndex) => {
        const isActive = dotIndex === activeIndex;
        dot.classList.toggle('is-active', isActive);
        dot.setAttribute('aria-current', isActive ? 'true' : 'false');
      });
    };

    const restartTimer = () => {
      window.clearInterval(timer);
      timer = window.setInterval(() => showSlide(activeIndex + 1), Number(heroSlider.dataset.autoplay) || 6500);
    };

    previousButton.addEventListener('click', () => { showSlide(activeIndex - 1); restartTimer(); });
    nextButton.addEventListener('click', () => { showSlide(activeIndex + 1); restartTimer(); });
    dots.forEach((dot, dotIndex) => dot.addEventListener('click', () => { showSlide(dotIndex); restartTimer(); }));
    heroSlider.addEventListener('mouseenter', () => window.clearInterval(timer));
    heroSlider.addEventListener('mouseleave', restartTimer);
    showSlide(0);
    restartTimer();
  }
});
