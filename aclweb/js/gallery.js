document.addEventListener('DOMContentLoaded', async () => {
  const galleryGrid = document.querySelector('#gallery-grid');
  if (!galleryGrid) return;

  const fallbackItems = [
    { title_en: 'Integrated Modern Farm', title_np: 'एकीकृत आधुनिक कृषि प्रणाली', category: 'Farm', image_url: 'assets/images/s1.png', alt_text_en: 'Integrated hydroponic and modern farm systems' },
    { title_en: 'Greenhouse Farming', title_np: 'ग्रीनहाउस तथा संरक्षित खेती', category: 'Farm', image_url: 'assets/images/s2.png', alt_text_en: 'Greenhouse and protected cultivation' },
    { title_en: 'Livestock Development', title_np: 'पशुपालन विकास', category: 'Dairy', image_url: 'assets/images/s3.png', alt_text_en: 'Goat and livestock farm' },
    { title_en: 'Farm Infrastructure', title_np: 'कृषि पूर्वाधार तथा बजार', category: 'Infrastructure', image_url: 'assets/images/s4.png', alt_text_en: 'Agricultural market and farm infrastructure' },
    { title_en: 'Sustainable Agriculture', title_np: 'दिगो कृषि तथा बाली उत्पादन', category: 'Agriculture', image_url: 'assets/images/s5.png', alt_text_en: 'Sustainable agriculture and crop production' },
    { title_en: 'ACL Agro Vision', title_np: 'ACL Agro Farm को दृष्टिकोण', category: 'Vision', image_url: 'assets/images/s6.png', alt_text_en: 'ACL Agro Farm project vision' },
    { title_en: 'Fodder Production', title_np: 'घाँस तथा पशु आहार उत्पादन', category: 'Feed', image_url: 'assets/images/a1.png', alt_text_en: 'Fodder production and farm landscape' },
    { title_en: 'Smart Farm Operations', title_np: 'स्मार्ट फार्म सञ्चालन', category: 'Technology', image_url: 'assets/images/a2.png', alt_text_en: 'Modern farming and agricultural operations' },
    { title_en: 'Smart Farming & Hydroponics', title_np: 'स्मार्ट खेती तथा हाइड्रोपोनिक्स', category: 'Hydroponics', image_url: 'assets/images/q1.jpg', alt_text_en: 'Smart farming and hydroponic systems' },
    { title_en: 'Modern Livestock Farming', title_np: 'आधुनिक पशुपालन तथा डेरी खेती', category: 'Dairy', image_url: 'assets/images/q2.jpg', alt_text_en: 'Modern livestock and dairy farming' },
    { title_en: 'Farm Consultancy & Planning', title_np: 'कृषि परामर्श तथा योजना', category: 'Consulting', image_url: 'assets/images/q3.jpg', alt_text_en: 'Farm consultancy and agricultural planning' },
    { title_en: 'Smart Irrigation', title_np: 'स्मार्ट सिँचाइ तथा पानी व्यवस्थापन', category: 'Irrigation', image_url: 'assets/images/q4.jpg', alt_text_en: 'Smart irrigation and water management' }
  ];

  const resolveImageSrc = (imageUrl) => {
    if (!imageUrl) return 'assets/images/logo3.png';
    try {
      const source = new URL(imageUrl, window.location.href);
      return ['http:', 'https:'].includes(source.protocol) ? source.href : imageUrl;
    } catch {
      return imageUrl;
    }
  };

  const renderGallery = (items) => {
    if (!items.length) {
      galleryGrid.innerHTML = fallbackItems.map((item) => `
        <div class="gallery-item">
          <img src="${resolveImageSrc(item.image_url)}" alt="${item.alt_text_en || item.title_en || 'Agriculture gallery'}" loading="lazy" />
          <div class="gallery-body">
            <h3>${item.title_en || 'Gallery item'}</h3>
            <p>${item.title_np || ''}</p>
          </div>
        </div>
      `).join('');
      return;
    }

    galleryGrid.innerHTML = items.map((item) => {
      const title = item.title_en || item.title_np || 'Gallery item';
      const subtitle = item.title_np || item.alt_text_np || item.alt_text_en || '';
      const imageSrc = resolveImageSrc(item.image_url);
      const altText = item.alt_text_en || item.title_en || title;
      return `
        <div class="gallery-item">
          <img src="${imageSrc}" alt="${altText}" loading="lazy" />
          <div class="gallery-body">
            <h3>${title}</h3>
            <p>${subtitle}</p>
          </div>
        </div>
      `;
    }).join('');
  };

  try {
    const response = await fetch('/api/gallery');
    if (!response.ok) {
      renderGallery([]);
      return;
    }

    const result = await response.json();
    if (!result?.ok || !Array.isArray(result.data)) {
      renderGallery([]);
      return;
    }

    renderGallery(result.data);
  } catch {
    renderGallery([]);
  }
});
