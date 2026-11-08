document.addEventListener('DOMContentLoaded', () => {
  const articleContainer = document.querySelector('#blog-articles');
  const paginationContainer = document.querySelector('#blog-pagination');
  const searchInput = document.querySelector('#blog-search');
  const resultCount = document.querySelector('#blog-result-count');
  let articles = [];
  let managedPosts = true;
  const pageSize = 12;
  let activeCategory = 'all';
  let activePage = 1;

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

  const filteredArticles = () => {
    const query = searchInput.value.trim().toLocaleLowerCase();
    return articles.filter((article) => {
      const matchesCategory = activeCategory === 'all' || article.category === activeCategory;
      const searchableText = `${article.id || ''} ${article.title_en || article.title || ''} ${article.title_np || ''} ${article.category || article.categoryLabel || ''} ${article.categoryNepali || ''}`.toLocaleLowerCase();
      return matchesCategory && (!query || searchableText.includes(query));
    });
  };

  const renderPagination = (pageCount) => {
    if (pageCount <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }

    const pages = Array.from({ length: pageCount }, (_, index) => {
      const page = index + 1;
      return `<button class="blog-page-button${page === activePage ? ' active' : ''}" type="button" data-page="${page}" aria-label="Page ${page}" aria-current="${page === activePage ? 'page' : 'false'}">${String(page).padStart(2, '0')}</button>`;
    }).join('');

    paginationContainer.innerHTML = `<button class="blog-page-arrow" type="button" data-page="${activePage - 1}" aria-label="Previous page" ${activePage === 1 ? 'disabled' : ''}>←</button>${pages}<button class="blog-page-arrow" type="button" data-page="${activePage + 1}" aria-label="Next page" ${activePage === pageCount ? 'disabled' : ''}>→</button>`;
  };

  const renderArticles = () => {
    const matches = filteredArticles();
    const pageCount = Math.ceil(matches.length / pageSize);
    activePage = Math.min(activePage, Math.max(pageCount, 1));
    const firstIndex = (activePage - 1) * pageSize;
    const visibleArticles = matches.slice(firstIndex, firstIndex + pageSize);

    resultCount.textContent = matches.length
      ? `Showing ${firstIndex + 1}-${Math.min(firstIndex + pageSize, matches.length)} of ${matches.length} published articles`
      : (managedPosts ? 'No published blog posts yet.' : 'No articles match this search.');

    if (!matches.length) {
      articleContainer.innerHTML = '<div class="blog-empty-state"><span aria-hidden="true">⌕</span><h3>No published blog posts</h3><p lang="ne">हाल सार्वजनिक गरिएको लेख छैन।</p></div>';
      renderPagination(0);
      return;
    }

    articleContainer.innerHTML = visibleArticles.map((article, index) => {
      const title = managedPosts ? article.title_en : window.englishText(article.title, `${article.categoryLabel} Guide ${article.id}`);
      const category = managedPosts ? article.category || 'General' : article.categoryLabel;
      let imageUrl = window.createBlogImage(article);
      if (managedPosts && article.featured_image) {
        try {
          const image = new URL(article.featured_image, window.location.href);
          if (['http:', 'https:'].includes(image.protocol)) imageUrl = image.href;
        } catch {
          imageUrl = window.createBlogImage(article);
        }
      }
      const href = managedPosts ? `blog-details.html?slug=${encodeURIComponent(article.slug)}` : `blog-details.html?id=${article.id}`;
      const postStatus = managedPosts ? 'Published' : 'Planned';
      const cardNumber = managedPosts ? String(firstIndex + index + 1).padStart(3, '0') : String(article.id).padStart(3, '0');
      const excerptText = managedPosts ? (article.short_description || article.excerpt_en || '') : '';
      const excerpt = excerptText ? `<p class="blog-card-excerpt">${escapeHtml(excerptText)}</p>` : '';
      const dateText = managedPosts && (article.publish_date || article.published_at)
        ? `<p class="blog-card-date">${escapeHtml(new Date(article.publish_date || article.published_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }))}</p>`
        : '';
      return `<article class="blog-plan-card"><a class="blog-plan-image" href="${href}" aria-label="View article: ${escapeHtml(title)}"><img src="${imageUrl}" alt="Illustration for ${escapeHtml(title)}" loading="lazy" /><span class="blog-card-number">${cardNumber}</span></a><div class="blog-plan-card-body"><p class="blog-card-category">${escapeHtml(category)}</p><h3>${escapeHtml(title)}</h3>${excerpt}${dateText}<div class="blog-card-footer"><span class="blog-planned-status"><i aria-hidden="true"></i> ${postStatus}</span><a href="${href}">${managedPosts ? 'Read article' : 'Outline'} <span aria-hidden="true">↗</span></a></div></div></article>`;
    }).join('');

    renderPagination(pageCount);
  };

  paginationContainer.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    activePage = Number(button.dataset.page);
    renderArticles();
    document.querySelector('.blog-plan-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  searchInput.addEventListener('input', () => {
    activePage = 1;
    renderArticles();
  });

  renderArticles();
  fetch('/api/blog')
    .then((response) => response.ok ? response.json() : null)
    .then((result) => {
      if (!result?.ok || !Array.isArray(result.data)) {
        articles = [];
        managedPosts = true;
        activePage = 1;
        renderArticles();
        return;
      }

      articles = result.data;
      managedPosts = true;
      activePage = 1;
      renderArticles();
    })
    .catch(() => {
      articles = [];
      managedPosts = true;
      activePage = 1;
      renderArticles();
    });
});