document.addEventListener('DOMContentLoaded', () => {
  const root = document.querySelector('#branch-directory');
  if (!root) return;

  const elements = {
    search: root.querySelector('#branch-search-input'),
    province: root.querySelector('#branch-province'),
    district: root.querySelector('#branch-district'),
    municipality: root.querySelector('#branch-municipality'),
    ward: root.querySelector('#branch-ward'),
    name: root.querySelector('#branch-name'),
    type: root.querySelector('#branch-type'),
    status: root.querySelector('#branch-status'),
    reset: root.querySelector('#branch-reset'),
    count: root.querySelector('#branch-filter-count'),
    summary: root.querySelector('#branch-location-summary'),
    results: root.querySelector('#branch-results'),
    detail: root.querySelector('#branch-detail'),
    resultStatus: root.querySelector('#branch-results-status')
  };
  let branches = [];
  let selectedBranch = null;
  let searchTimer;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));

  const request = async (url) => {
    const response = await fetch(url);
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.message || 'Unable to load branch information.');
    return result;
  };

  const setOptions = (select, items, label, valueKey = 'id', textKey = 'name') => {
    select.replaceChildren(new Option(label, ''));
    items.forEach((item) => select.add(new Option(item[textKey], item[valueKey])));
    select.disabled = !items.length;
  };

  const resetSelect = (select, label) => {
    select.replaceChildren(new Option(label, ''));
    select.disabled = true;
  };

  const setStat = (key, value) => {
    const node = root.querySelector(`[data-stat="${key}"]`);
    if (node) node.textContent = value > 0 ? value : (key === 'total' ? 'Not yet registered' : 'Not disclosed');
  };

  const updateSummary = () => {
    const parts = [elements.province, elements.district, elements.municipality, elements.ward]
      .map((select) => select.selectedOptions[0]?.textContent)
      .filter((value) => value && !value.startsWith('Select'));
    elements.summary.textContent = parts.length ? `Selected location: ${parts.join(' / ')}` : 'Choose a province to begin narrowing your search.';
  };

  const renderDetail = (branch) => {
    selectedBranch = branch;
    const address = branch.full_address || '';
    const mapUrl = branch.latitude && branch.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${branch.latitude},${branch.longitude}`
      : '';
    const rows = [
      ['Branch Name', branch.branch_name],
      ['Branch ID / Code', branch.branch_code],
      ['Branch Type', branch.branch_type],
      ['Province', branch.province_name],
      ['District', branch.district_name],
      ['Municipality / Rural Municipality', branch.municipality_name],
      ['Ward Number', branch.ward_number ? `Ward ${branch.ward_number}` : ''],
      ['Full Branch Address', address],
      ['Branch Manager / Operator', branch.manager_name],
      ['Designation', branch.designation],
      ['Primary Contact Number', branch.phone],
      ['Alternative Contact Number', branch.alternate_phone],
      ['Official Email Address', branch.email],
      ['Office Opening Hours', branch.opening_hours],
      ['Branch Status', branch.status],
      ['Date Established', branch.established_date]
    ].filter(([, value]) => value);
    elements.detail.hidden = false;
    elements.detail.innerHTML = `
      <div class="branch-detail-header"><div><p class="contact-eyebrow">SELECTED BRANCH</p><h4>${escapeHtml(branch.branch_name)}</h4></div><span class="branch-status-pill">${escapeHtml(branch.status)}</span></div>
      <dl class="branch-detail-facts">${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
      <div class="branch-detail-actions">
        ${branch.phone ? `<a class="btn" href="tel:${escapeHtml(branch.phone.replace(/[^\d+]/g, ''))}">Call Branch</a>` : ''}
        ${branch.email ? `<a class="btn btn-outline" href="mailto:${escapeHtml(branch.email)}">Email Branch</a>` : ''}
        ${mapUrl ? `<a class="btn btn-outline" href="${mapUrl}" target="_blank" rel="noopener noreferrer">Get Directions</a>` : ''}
        <button type="button" class="btn btn-outline" data-copy-branch>Copy Contact Details</button>
      </div>
    `;
  };

  const renderResults = () => {
    elements.results.replaceChildren();
    elements.count.textContent = `${branches.length} matching branch${branches.length === 1 ? '' : 'es'}`;
    if (!branches.length) {
      elements.results.innerHTML = '<div class="branch-empty"><strong>No matching published branch found.</strong><span>Try a different location or search term.</span></div>';
      elements.resultStatus.textContent = '';
      elements.detail.hidden = true;
      return;
    }
    elements.resultStatus.textContent = `${branches.length} result${branches.length === 1 ? '' : 's'}`;
    const list = document.createElement('div');
    list.className = 'branch-result-list';
    branches.forEach((branch) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'branch-result-item';
      button.innerHTML = `<strong>${escapeHtml(branch.branch_name)}</strong><span>${escapeHtml(branch.branch_code)} · ${escapeHtml(branch.district_name)}, ${escapeHtml(branch.province_name)}</span>`;
      button.addEventListener('click', () => renderDetail(branch));
      list.append(button);
    });
    elements.results.append(list);
    elements.detail.hidden = false;
    elements.detail.innerHTML = '<div class="branch-empty"><strong>Select a branch to view contact information.</strong><span>Choose one of the matching branches above.</span></div>';
  };

  const loadBranches = async () => {
    elements.results.innerHTML = '<div class="branch-loading">Loading published branch records…</div>';
    const params = new URLSearchParams({ limit: '50' });
    if (elements.search.value.trim()) params.set('search', elements.search.value.trim());
    if (elements.province.value) params.set('provinceId', elements.province.value);
    if (elements.district.value) params.set('districtId', elements.district.value);
    if (elements.municipality.value) params.set('municipalityId', elements.municipality.value);
    if (elements.ward.value) params.set('wardId', elements.ward.value);
    if (elements.type.value) params.set('branchType', elements.type.value);
    if (elements.status.value) params.set('status', elements.status.value);
    try {
      const result = await request(`/api/branches?${params}`);
      branches = result.data;
      setOptions(elements.name, branches, 'All Branches', 'id', 'branch_name');
      renderResults();
    } catch (error) {
      elements.count.textContent = 'Unable to load branches';
      elements.results.innerHTML = `<div class="branch-empty error"><strong>Branch directory unavailable.</strong><span>${escapeHtml(error.message)} Please try again.</span><button type="button" class="btn" data-retry>Retry</button></div>`;
      elements.detail.hidden = true;
    }
  };

  const loadStats = async () => {
    try {
      const result = await request('/api/branches/stats');
      Object.entries(result.data).forEach(([key, value]) => setStat(key, value));
    } catch {
      ['total', 'provincial', 'district', 'municipality', 'ward'].forEach((key) => setStat(key, '—'));
    }
  };

  const loadLocation = async (url, target, label) => {
    resetSelect(target, `Select ${label}`);
    if (!url) return;
    try {
      const result = await request(url);
      setOptions(target, result.data, `Select ${label}`);
    } catch {
      target.replaceChildren(new Option(`Unable to load ${label}`, ''));
    }
  };

  elements.province.addEventListener('change', async () => {
    resetSelect(elements.district, 'Select District');
    resetSelect(elements.municipality, 'Select Municipality');
    resetSelect(elements.ward, 'Select Ward');
    updateSummary();
    await loadLocation(elements.province.value && `/api/locations/districts?provinceId=${elements.province.value}`, elements.district, 'District');
    loadBranches();
  });
  elements.district.addEventListener('change', async () => {
    resetSelect(elements.municipality, 'Select Municipality');
    resetSelect(elements.ward, 'Select Ward');
    updateSummary();
    await loadLocation(elements.district.value && `/api/locations/municipalities?districtId=${elements.district.value}`, elements.municipality, 'Municipality');
    loadBranches();
  });
  elements.municipality.addEventListener('change', async () => {
    resetSelect(elements.ward, 'Select Ward');
    updateSummary();
    await loadLocation(elements.municipality.value && `/api/locations/wards?municipalityId=${elements.municipality.value}`, elements.ward, 'Ward');
    loadBranches();
  });
  [elements.ward, elements.type, elements.status].forEach((select) => select.addEventListener('change', () => {
    updateSummary();
    loadBranches();
  }));
  elements.name.addEventListener('change', () => {
    const branch = branches.find((item) => String(item.id) === elements.name.value);
    if (branch) renderDetail(branch);
  });
  elements.search.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(loadBranches, 250);
  });
  elements.reset.addEventListener('click', () => {
    elements.search.value = '';
    elements.province.value = '';
    resetSelect(elements.district, 'Select District');
    resetSelect(elements.municipality, 'Select Municipality');
    resetSelect(elements.ward, 'Select Ward');
    elements.type.value = '';
    elements.status.value = '';
    updateSummary();
    loadBranches();
  });
  root.addEventListener('click', async (event) => {
    if (!event.target.matches('[data-retry]')) return;
    await loadBranches();
  });
  root.addEventListener('click', async (event) => {
    if (!event.target.matches('[data-copy-branch]') || !selectedBranch) return;
    const text = [selectedBranch.branch_name, selectedBranch.branch_code, selectedBranch.full_address, selectedBranch.phone, selectedBranch.email].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      event.target.textContent = 'Copied';
    } catch {
      event.target.textContent = 'Copy unavailable';
    }
  });

  request('/api/locations/provinces')
    .then((result) => setOptions(elements.province, result.data, 'Select Province'))
    .catch(() => { elements.province.replaceChildren(new Option('Unable to load provinces', '')); })
    .finally(() => { loadStats(); loadBranches(); });
});
