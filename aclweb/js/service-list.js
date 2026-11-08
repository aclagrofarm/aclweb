const serviceGrid = document.querySelector('.services-catalog');
const serviceEditorialSection = document.querySelector('.services-list-section');
const serviceCountLabel = document.querySelector('.services-new-list .services-eyebrow');

const createManagedServiceCard = (service, index) => {
  const card = document.createElement('article');
  card.className = 'service-catalog-card';

  const imageLink = document.createElement('a');
  imageLink.href = 'contact.html';
  imageLink.setAttribute('aria-label', `Ask about ${service.title_en}`);
  const image = document.createElement('img');
  image.alt = service.title_en;
  image.loading = 'lazy';
  try {
    const source = new URL(service.image_url || 'assets/images/logo3.png', window.location.href);
    image.src = ['http:', 'https:'].includes(source.protocol) ? source.href : 'assets/images/logo3.png';
  } catch {
    image.src = 'assets/images/logo3.png';
  }
  imageLink.append(image);

  const content = document.createElement('div');
  const indexLabel = document.createElement('span');
  indexLabel.textContent = `${String(index + 1).padStart(2, '0')} / ${service.category || 'SERVICE'}`;
  const title = document.createElement('h3');
  title.textContent = service.title_en;
  content.append(indexLabel, title);

  if (service.summary_en) {
    const paragraph = document.createElement('p');
    paragraph.textContent = service.summary_en;
    content.append(paragraph);
  }

  const details = String(service.content_en || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const bulletItems = details.filter((line) => line.startsWith('- '));
  if (bulletItems.length) {
    const list = document.createElement('ul');
    for (const item of bulletItems) {
      const listItem = document.createElement('li');
      listItem.textContent = item.slice(2);
      list.append(listItem);
    }
    content.append(list);
  }
  for (const text of details.filter((line) => !line.startsWith('- '))) {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    content.append(paragraph);
  }

  const contactLink = document.createElement('a');
  contactLink.href = 'contact.html';
  contactLink.textContent = 'Ask about this service';
  content.append(contactLink);
  card.append(imageLink, content);
  return card;
};

const loadManagedServices = async () => {
  if (!serviceGrid || !serviceEditorialSection) return;
  try {
    const response = await fetch('/api/services');
    if (!response.ok) return;
    const result = await response.json();
    if (!result.ok || !Array.isArray(result.data) || !result.data.length) return;

    serviceEditorialSection.hidden = true;
    serviceGrid.replaceChildren(...result.data.map(createManagedServiceCard));
    if (serviceCountLabel) serviceCountLabel.textContent = `${String(result.data.length).padStart(2, '0')} / OUR SERVICES`;
  } catch {
    // Keep the existing service catalog available if the API is offline.
  }
};

loadManagedServices();
