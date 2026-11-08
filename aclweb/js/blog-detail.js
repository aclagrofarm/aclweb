document.addEventListener('DOMContentLoaded', () => {
  const slug = new URLSearchParams(window.location.search).get('slug');
  if (slug) {
    fetch(`/api/blog/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.message || 'Blog post not found.');
        return result.data;
      })
      .then((post) => {
        const seoTitle = post.seo_title || post.title_en;
        document.title = `${seoTitle} | ACL Agro Farm Ltd.`;
        const metaDescription = document.querySelector('meta[name="description"]') || document.createElement('meta');
        metaDescription.name = 'description';
        metaDescription.content = post.short_description || post.excerpt_en || post.title_en;
        if (!document.querySelector('meta[name="description"]')) document.head.appendChild(metaDescription);
        document.querySelector('#article-category').textContent = post.category || 'Blog';
        document.querySelector('#article-title').textContent = post.title_en;
        document.querySelector('#article-date').textContent = post.publish_date || post.published_at
          ? new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(post.publish_date || post.published_at))
          : '';

        const image = document.querySelector('#article-image');
        image.alt = post.title_en;
        try {
          const source = new URL(post.featured_image || 'assets/images/logo3.png', window.location.href);
          image.src = ['http:', 'https:'].includes(source.protocol) ? source.href : 'assets/images/logo3.png';
        } catch {
          image.src = 'assets/images/logo3.png';
        }

        const badge = document.querySelector('.blog-outline-badge');
        if (badge && badge.lastChild) badge.lastChild.textContent = ' Published article';
        const content = document.querySelector('#article-content');
        content.replaceChildren();
        if (post.short_description) {
          const short = document.createElement('p');
          short.className = 'blog-short-description';
          short.textContent = post.short_description;
          content.append(short);
        }
        const intro = document.createElement('p');
        intro.textContent = post.excerpt_en || post.short_description || '';
        if (intro.textContent.trim()) content.append(intro);
        for (const [text, language] of [[post.content_en, 'en'], [post.content_np, 'ne']]) {
          if (!text) continue;
          for (const block of String(text).split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)) {
            const paragraph = document.createElement('p');
            paragraph.lang = language;
            paragraph.textContent = block;
            content.append(paragraph);
          }
        }

        fetch('/api/blog')
          .then((response) => response.ok ? response.json() : null)
          .then((result) => {
            if (!result?.ok) return;
            const relatedContainer = document.querySelector('#related-articles');
            result.data.filter((item) => item.slug !== post.slug).slice(0, 4).forEach((item) => {
              const card = document.createElement('div');
              card.className = 'info-card';
              const link = document.createElement('a');
              link.href = `blog-details.html?slug=${encodeURIComponent(item.slug)}`;
              const title = document.createElement('strong');
              title.textContent = item.title_en;
              link.append(title);
              card.append(link);
              relatedContainer.append(card);
            });
          })
          .catch(() => {});
      })
      .catch(() => window.location.replace('blog.html'));
    return;
  }

  const articleId = Number(new URLSearchParams(window.location.search).get('id'));
  const article = window.blogPlan?.find((item) => item.id === articleId);
  if (!article) {
    window.location.replace('blog.html');
    return;
  }

  const category = window.blogCategories.find((item) => item.id === article.category);
  const title = window.englishText(article.title, `${category.label} Guide ${article.id}`);
  document.title = `${title} | ACL Agro Farm Ltd.`;
  document.querySelector('#article-category').textContent = `${String(article.id).padStart(3, '0')} / ${category.label}`;
  document.querySelector('#article-title').textContent = title;
  document.querySelector('#article-date').textContent = 'Planned article';

  const image = document.querySelector('#article-image');
  image.src = window.createBlogImage(article);
  image.alt = `Illustration for ${title}`;

  const content = document.querySelector('#article-content');
  const scopeTitle = document.createElement('h2');
  scopeTitle.textContent = 'Planned coverage';
  const scopeCopy = document.createElement('p');
  scopeCopy.textContent = `This article is part of ACL Agro Farm's editorial plan for ${category.label.toLowerCase()}. The finished guide will explore the topic in the context of Nepalese farming and practical decisions for farmers.`;
  const listTitle = document.createElement('h3');
  listTitle.textContent = 'Outline';
  const outline = document.createElement('ul');
  outline.className = 'list-check';
  [
    'Core concepts and relevant farming context',
    'Practical considerations for Nepalese farms',
    'Useful next steps and responsible recommendations'
  ].forEach((text) => {
    const item = document.createElement('li');
    item.textContent = text;
    outline.append(item);
  });
  content.replaceChildren(scopeTitle, scopeCopy, listTitle, outline);

  const related = window.blogPlan
    .filter((item) => item.category === article.category && item.id !== article.id)
    .slice(0, 4);
  const relatedContainer = document.querySelector('#related-articles');
  related.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'info-card';
    const link = document.createElement('a');
    link.href = `blog-details.html?id=${item.id}`;
    const title = document.createElement('strong');
    title.textContent = window.englishText(item.title, `${category.label} Guide ${item.id}`);
    link.append(title);
    card.append(link);
    relatedContainer.append(card);
  });
});