document.addEventListener('DOMContentLoaded', () => {
  const directory = window.aclBranchDirectory || { provinces: [], branches: [] };
  const form = document.querySelector('form[data-form="contact"]');
  if (!form) return;

  const provinceSelect = form.querySelector('#province');
  const municipalityInput = form.querySelector('#municipality');
  const municipalityOptions = form.querySelector('#branch-municipality-options');
  const districtInput = form.querySelector('#district');
  const wardSelect = form.querySelector('#ward');
  const branchTypeSelect = form.querySelector('#branchType');
  const branchNumberInput = form.querySelector('#branchNumber');
  const locationCodeInput = form.querySelector('#locationCode');
  const branchSearchInput = document.querySelector('#branch-search');
  const branchResults = document.querySelector('#province-branch-results');
  const branchCount = document.querySelector('#branch-directory-count');
  const detailsPanel = form.querySelector('#selected-branch-details');
  const detailName = form.querySelector('#selected-branch-name');
  const detailStatus = form.querySelector('#selected-branch-status');
  const detailMessage = form.querySelector('#selected-branch-message');
  const detailFacts = form.querySelector('#selected-branch-facts');
  const numberOfWards = 32;

  directory.provinces.forEach((province) => {
    const option = document.createElement('option');
    option.value = province.name;
    option.dataset.provinceId = province.id;
    option.textContent = province.name;
    provinceSelect.append(option);
  });

  const selectedProvinceId = () => provinceSelect.selectedOptions[0]?.dataset.provinceId || '';
  const branchesForProvince = () => directory.branches.filter((branch) => branch.province === selectedProvinceId());

  const fillDistrictOptions = () => {
    const districts = directory.districtsByProvince[selectedProvinceId()] || [];
    districtInput.replaceChildren(new Option('Choose district', ''));
    districts.forEach((district) => districtInput.add(new Option(district, district)));
    districtInput.disabled = districts.length === 0;
  };

  const fillMunicipalitySuggestions = () => {
    const district = districtInput.value.trim().toLocaleLowerCase();
    const names = [...new Set(branchesForProvince()
      .filter((branch) => !district || branch.district.toLocaleLowerCase() === district)
      .map((branch) => branch.municipality)
      .filter(Boolean))];
    municipalityOptions.replaceChildren(...names.map((name) => {
      const option = document.createElement('option');
      option.value = name;
      return option;
    }));
  };

  const resetWard = () => {
    wardSelect.replaceChildren(new Option('Choose municipality first', ''));
    wardSelect.disabled = !municipalityInput.value.trim();
  };

  const fillWards = () => {
    wardSelect.replaceChildren(new Option('Choose ward', ''));
    for (let wardNumber = 1; wardNumber <= numberOfWards; wardNumber += 1) {
      wardSelect.add(new Option(`Ward ${wardNumber}`, String(wardNumber)));
    }
    wardSelect.disabled = !municipalityInput.value.trim();
  };

  const addFact = (label, value, href) => {
    const row = document.createElement('div');
    const term = document.createElement('span');
    const description = document.createElement('strong');
    term.textContent = label;
    if (href) {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = value;
      if (href.startsWith('http')) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      description.append(link);
    } else {
      description.textContent = value;
    }
    row.append(term, description);
    detailFacts.append(row);
  };

  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

  const renderProvinceBranches = () => {
    const query = branchSearchInput.value.trim().toLocaleLowerCase();
    branchResults.replaceChildren();

    const matches = directory.branches.filter((branch) => {
      const searchableValues = [
        branch.branchCode,
        branch.name,
        branch.email,
        branch.phone,
        branch.province,
        branch.district,
        branch.municipality,
        branch.ruralMunicipality,
        branch.ward
      ];
      return searchableValues.some((value) => String(value || '').toLocaleLowerCase().includes(query));
    });

    if (branchCount) {
      branchCount.textContent = query
        ? `${matches.length} of ${directory.branches.length} branches`
        : `${directory.branches.length} branches`;
    }

    if (!matches.length) {
      branchResults.innerHTML = '<div class="branch-directory-empty"><strong>No matching branch</strong><span>Try a branch code, name, phone, province, or location.</span></div>';
      return;
    }

    const statusLabels = {
      active: ['Active demo record', 'branch-status-active'],
      temporarily_closed: ['Temporarily closed', 'branch-status-closed'],
      pending_verification: ['Details partly provided', 'branch-status-pending'],
      details_pending: ['Details pending', 'branch-status-pending']
    };
    branchResults.innerHTML = matches.map((branch) => {
      const [statusLabel, statusClass] = statusLabels[branch.status] || statusLabels.details_pending;
      return `
        <article class="province-branch-card">
          <div class="province-branch-card-top"><span class="province-branch-code">${escapeHtml(branch.branchCode)}</span><span class="branch-status ${statusClass}">${escapeHtml(statusLabel)}</span></div>
          <h4>${escapeHtml(branch.name)}</h4>
          <dl>
            <div><dt>Email</dt><dd>${escapeHtml(branch.email || 'Details pending')}</dd></div>
            <div><dt>Phone</dt><dd>${escapeHtml(branch.phone || 'Details pending')}</dd></div>
            <div><dt>Province</dt><dd>${escapeHtml(branch.province || 'Details pending')}</dd></div>
            <div><dt>District</dt><dd>${escapeHtml(branch.district || 'Details pending')}</dd></div>
            <div><dt>Municipality</dt><dd>${escapeHtml(branch.municipality || 'Details pending')}</dd></div>
            <div><dt>Rural municipality</dt><dd>${escapeHtml(branch.ruralMunicipality || 'Details pending')}</dd></div>
            <div><dt>Ward</dt><dd>${escapeHtml(branch.ward || 'Details pending')}</dd></div>
          </dl>
          <button class="branch-select-button" type="button" data-branch-code="${escapeHtml(branch.branchCode)}">Select branch</button>
        </article>`;
    }).join('');
  };

  const showUnverifiedLocation = () => {
    const province = directory.provinces.find((item) => item.id === selectedProvinceId());
    const municipality = municipalityInput.value.trim();
    const ward = wardSelect.value;
    const locationParts = [province?.name, districtInput.value.trim(), municipality, ward ? `Ward ${ward}` : ''].filter(Boolean);

    detailFacts.replaceChildren();
    branchNumberInput.value = '';
    locationCodeInput.value = '';

    if (!locationParts.length) {
      detailFacts.hidden = true;
      detailName.textContent = 'Choose a location to see branch details';
      detailStatus.textContent = 'No location selected';
      detailStatus.className = 'branch-status';
      detailMessage.textContent = 'प्रदेश, पालिका र वडा छान्दा प्रमाणित शाखा विवरण यहाँ देखिन्छ।';
      detailsPanel.dataset.hasBranch = 'false';
      return;
    }

    detailName.textContent = locationParts.join(' · ');
    detailStatus.textContent = 'Branch not verified';
    detailStatus.className = 'branch-status branch-status-pending';
    detailMessage.textContent = 'Official branch code र सञ्चालकको विवरण पुष्टि भएपछि यहाँ देखिनेछ।';
    detailFacts.replaceChildren();
    const hasCompleteLocation = Boolean(province && districtInput.value.trim() && municipality && ward);
    if (hasCompleteLocation) {
      const locationCode = [province.name, districtInput.value, municipality]
        .map(createLocationSegment)
        .join('-');
      const provisionalCode = `ACL-${locationCode}-W${String(ward).padStart(2, '0')}`;
      locationCodeInput.value = provisionalCode;
      addFact('Provisional location code / अस्थायी स्थान कोड', provisionalCode);
      addFact('Official branch code / आधिकारिक शाखा कोड', 'Awaiting verified branch record');
      addFact('Operator / सञ्चालक', 'Details not provided');
      addFact('Office hours / समय', 'Details not provided');
    }
    detailFacts.hidden = !hasCompleteLocation;
    detailsPanel.dataset.hasBranch = 'false';
  };

  const createLocationSegment = (value) => {
    const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalized) return normalized.slice(0, 3);
    let hash = 0;
    for (const character of value) hash = (hash * 31 + character.codePointAt(0)) >>> 0;
    return `N${hash.toString(36).toUpperCase().slice(0, 2)}`;
  };

  const showBranchDetails = (branch) => {
    detailFacts.replaceChildren();
    detailName.textContent = branch.name || `${branch.municipality} Branch`;
    const statusLabels = {
      active: ['Active', 'branch-status-active'],
      temporarily_closed: ['Temporarily closed', 'branch-status-closed'],
      pending_verification: ['Details partly provided', 'branch-status-pending'],
      details_pending: ['Details pending', 'branch-status-pending']
    };
    const [statusLabel, statusClass] = statusLabels[branch.status] || statusLabels.active;
    detailStatus.textContent = statusLabel;
    detailStatus.className = `branch-status ${statusClass}`;
    detailMessage.textContent = branch.serviceArea || (branch.status === 'details_pending'
      ? 'Branch contact and location information will be added after verification.'
      : 'Local farmer support, agricultural services, and project coordination.');
    branchNumberInput.value = branch.branchNumber || '';
    locationCodeInput.value = branch.locationCode || '';
    detailFacts.hidden = false;

    addFact('Branch code / शाखा कोड', branch.branchCode || branch.branchNumber || 'Not assigned');
    addFact('Operator / सञ्चालक', branch.operatorName || 'Not published');
    if (branch.operatorTitle) addFact('Position / पद', branch.operatorTitle);
    addFact('Address / ठेगाना', branch.address || [branch.province, branch.district, branch.municipality, branch.ruralMunicipality, branch.ward ? `Ward ${branch.ward}` : ''].filter(Boolean).join(', ') || 'Not published');
    addFact('Phone / फोन', branch.phone || 'Not published', branch.phone ? `tel:${branch.phone.replace(/[^+\d]/g, '')}` : null);
    if (branch.whatsapp) {
      const whatsappNumber = branch.whatsapp.replace(/\D/g, '');
      addFact('WhatsApp', branch.whatsapp, `https://wa.me/${whatsappNumber}`);
    }
    addFact('Email / इमेल', branch.email || 'Not published', branch.email ? `mailto:${branch.email}` : null);
    addFact('Office hours / समय', branch.hours || 'Not published');
    if (branch.serviceArea) addFact('Service area / सेवा क्षेत्र', branch.serviceArea);
    if (branch.mapUrl) addFact('Map / नक्सा', 'Open Google Maps', branch.mapUrl);
    detailsPanel.dataset.hasBranch = 'true';
  };

  const updateSelectedBranch = () => {
    if (branchTypeSelect.value === 'head') {
      showBranchDetails(directory.headOffice);
      return;
    }

    const province = selectedProvinceId();
    const municipality = municipalityInput.value.trim().toLocaleLowerCase();
    const ward = wardSelect.value;
    const branch = directory.branches.find((item) =>
      item.province === province &&
      item.municipality.toLocaleLowerCase() === municipality &&
      String(item.ward) === ward
    );

    if (branch) {
      showBranchDetails(branch);
      branchTypeSelect.value = 'province';
      districtInput.value = branch.district || districtInput.value;
      return;
    }

    showUnverifiedLocation();
    if (province && municipality) branchTypeSelect.value = 'province';
  };

  provinceSelect.addEventListener('change', () => {
    municipalityInput.value = '';
    fillDistrictOptions();
    municipalityInput.disabled = true;
    wardSelect.value = '';
    fillMunicipalitySuggestions();
    resetWard();
    showUnverifiedLocation();
  });

  districtInput.addEventListener('change', () => {
    municipalityInput.value = '';
    municipalityInput.disabled = !provinceSelect.value || !districtInput.value.trim();
    wardSelect.value = '';
    resetWard();
    fillMunicipalitySuggestions();
    updateSelectedBranch();
  });

  municipalityInput.addEventListener('input', () => {
    fillWards();
    updateSelectedBranch();
  });

  municipalityInput.addEventListener('change', () => {
    const match = branchesForProvince().find((branch) => branch.municipality.toLocaleLowerCase() === municipalityInput.value.trim().toLocaleLowerCase());
    if (match) {
      districtInput.value = match.district || '';
      fillWards();
      if (match.ward) wardSelect.value = String(match.ward);
    }
    updateSelectedBranch();
  });

  wardSelect.addEventListener('change', updateSelectedBranch);
  branchTypeSelect.addEventListener('change', updateSelectedBranch);
  if (branchSearchInput && branchResults) {
    branchSearchInput.addEventListener('input', renderProvinceBranches);
    branchResults.addEventListener('click', (event) => {
      const button = event.target.closest('[data-branch-code]');
      if (!button) return;
      const branch = directory.branches.find((item) => item.branchCode === button.dataset.branchCode);
      if (!branch) return;
      branchTypeSelect.value = 'province';
      showBranchDetails(branch);
      document.querySelector('#selected-branch-details').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
  form.addEventListener('reset', () => {
    window.setTimeout(() => {
      provinceSelect.dispatchEvent(new Event('change'));
      showUnverifiedLocation();
    }, 0);
  });

  fillMunicipalitySuggestions();
  fillDistrictOptions();
  municipalityInput.disabled = true;
  resetWard();
  showUnverifiedLocation();
  if (branchSearchInput && branchResults) renderProvinceBranches();
});