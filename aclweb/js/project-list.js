const projectGrid = document.querySelector('.project-showcase-grid');
const projectListSection = document.querySelector('.projects-list-section');
const featuredProjectSection = document.querySelector('.featured-project-section');

const createManagedProjectCard = (project) => {
  const card = document.createElement('article');
  card.className = 'project-showcase';

  const imageLink = document.createElement('a');
  imageLink.className = 'project-image-link';
  imageLink.href = 'contact.html';
  imageLink.setAttribute('aria-label', `Ask about ${project.title_en}`);
  const image = document.createElement('img');
  image.alt = project.title_en;
  image.loading = 'lazy';
  try {
    const source = new URL(project.image_url || 'assets/images/logo3.png', window.location.href);
    image.src = ['http:', 'https:'].includes(source.protocol) ? source.href : 'assets/images/logo3.png';
  } catch {
    image.src = 'assets/images/logo3.png';
  }
  imageLink.append(image);

  const content = document.createElement('div');
  content.className = 'project-showcase-body';
  const meta = document.createElement('div');
  meta.className = 'project-meta';
  const location = document.createElement('span');
  location.className = 'project-location';
  location.textContent = project.location || 'Nepal';
  const category = document.createElement('span');
  category.className = 'project-category';
  category.textContent = project.category || '';
  const status = document.createElement('span');
  status.className = 'project-status status-planning';
  status.textContent = `${project.featured ? 'Featured · ' : ''}${String(project.project_status || 'Published').replace(/_/g, ' ')}`;
  meta.append(location, category, status);

  const title = document.createElement('h2');
  title.textContent = project.title_en;
  content.append(meta, title);
  if (project.project_code) {
    const projectCode = document.createElement('p');
    projectCode.className = 'project-code';
    projectCode.textContent = project.project_code;
    content.append(projectCode);
  }
  if (project.title_np) {
    const nepaliTitle = document.createElement('h3');
    nepaliTitle.lang = 'ne';
    nepaliTitle.textContent = project.title_np;
    content.append(nepaliTitle);
  }
  for (const text of [project.summary_en, project.content_en]) {
    if (!text) continue;
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    content.append(paragraph);
  }

  const details = document.createElement('details');
  details.className = 'project-profile-details';
  const detailsSummary = document.createElement('summary');
  detailsSummary.textContent = 'Project details';
  details.append(detailsSummary);
  const profileFields = [
    ['Objectives', project.objectives],
    ['Project Scope', project.project_scope],
    ['Target Beneficiaries', project.target_beneficiaries],
    ['Estimated Budget', project.estimated_budget === null ? '' : project.estimated_budget],
    ['Project Duration', project.duration],
    ['Progress', project.progress === null ? '' : `${project.progress || 0}%`],
    ['Contact Person', project.contact_person]
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');

  if (profileFields.length) {
    const list = document.createElement('dl');
    for (const [label, value] of profileFields) {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = label === 'Estimated Budget' ? `NPR ${new Intl.NumberFormat().format(Number(value))}` : value;
      row.append(term, description);
      list.append(row);
    }
    details.append(list);
  }

  const gallery = Array.isArray(project.gallery) ? project.gallery : [];
  if (gallery.length) {
    const galleryGrid = document.createElement('div');
    galleryGrid.className = 'project-profile-gallery';
    for (const mediaUrl of gallery) {
      let mediaSource;
      try {
        const source = new URL(mediaUrl, window.location.href);
        if (!['http:', 'https:'].includes(source.protocol)) continue;
        mediaSource = source.href;
      } catch {
        continue;
      }
      if (/\.(mp4|webm|mov)(?:$|[?#])/i.test(mediaSource)) {
        const video = document.createElement('video');
        video.src = mediaSource;
        video.controls = true;
        video.preload = 'metadata';
        galleryGrid.append(video);
      } else {
        const link = document.createElement('a');
        link.href = mediaSource;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const galleryImage = document.createElement('img');
        galleryImage.src = mediaSource;
        galleryImage.alt = `${project.title_en} project gallery image`;
        galleryImage.loading = 'lazy';
        link.append(galleryImage);
        galleryGrid.append(link);
      }
    }
    if (galleryGrid.childElementCount) details.append(galleryGrid);
  }
  if (details.children.length > 1) content.append(details);

  const link = document.createElement('a');
  link.className = 'project-details-link';
  link.href = 'contact.html';
  link.textContent = 'Enquire about this project';
  content.append(link);
  card.append(imageLink, content);
  return card;
};

const loadManagedProjects = async () => {
  if (!projectGrid || !projectListSection || !featuredProjectSection) return;
  try {
    const response = await fetch('/api/projects');
    if (!response.ok) return;
    const result = await response.json();
    if (!result.ok || !Array.isArray(result.data) || !result.data.length) return;

    featuredProjectSection.hidden = true;
    projectGrid.replaceChildren(...result.data.map(createManagedProjectCard));
  } catch {
    // Keep the existing project portfolio available if the API is offline.
  }
};

loadManagedProjects();
