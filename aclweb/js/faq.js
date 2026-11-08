document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.querySelector('#faq-search');
  const filterContainer = document.querySelector('#faq-filters');
  const resultCount = document.querySelector('#faq-result-count');
  const emptyState = document.querySelector('#faq-empty');
  const items = [...document.querySelectorAll('.faq-item')];
  let activeCategory = 'all';

  const render = () => {
    const query = searchInput.value.trim().toLocaleLowerCase();
    let visibleCount = 0;

    items.forEach((item) => {
      const matchesCategory = activeCategory === 'all' || item.dataset.category === activeCategory;
      const matchesSearch = !query || item.textContent.toLocaleLowerCase().includes(query);
      const visible = matchesCategory && matchesSearch;
      item.hidden = !visible;
      if (!visible) item.open = false;
      if (visible) visibleCount += 1;
    });

    resultCount.textContent = `${visibleCount} ${visibleCount === 1 ? 'answer' : 'answers'}`;
    emptyState.hidden = visibleCount > 0;
  };

  filterContainer.addEventListener('click', (event) => {
    const filter = event.target.closest('[data-faq-category]');
    if (!filter) return;

    activeCategory = filter.dataset.faqCategory;
    filterContainer.querySelectorAll('[data-faq-category]').forEach((button) => {
      const active = button === filter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    render();
  });

  searchInput.addEventListener('input', render);

  items.forEach((item) => {
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      items.forEach((other) => {
        if (other !== item) other.open = false;
      });
    });
  });

  render();
});
