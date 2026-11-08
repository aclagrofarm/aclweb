const formState = {
  pending: false
};

function showFormMessage(form, message, isError = false) {
  const target = form.querySelector('.form-message') || document.createElement('div');
  target.className = `form-message ${isError ? 'error' : 'success'}`;
  target.textContent = message;
  if (!form.querySelector('.form-message')) {
    form.appendChild(target);
  }
}

async function submitContactForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());

  if (!data.name || !data.message) {
    showFormMessage(form, 'Please enter your name and message.', true);
    return;
  }

  formState.pending = true;
  form.querySelector('button[type="submit"]').disabled = true;

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        phone: data.phone,
        province: data.province,
        district: data.district,
        municipality: data.municipality,
        ward: data.ward,
        branchType: data.branchType,
        branchNumber: data.branchNumber,
        locationCode: data.locationCode,
        subject: data.subject,
        message: data.message,
        website: data.website
      })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Unable to submit contact form.');

    showFormMessage(form, result.message || 'Message sent successfully.', false);
    form.reset();
  } catch (error) {
    showFormMessage(form, error.message, true);
  } finally {
    formState.pending = false;
    form.querySelector('button[type="submit"]').disabled = false;
  }
}

async function submitInvestmentForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  if (!data.fullName || !data.phone || !data.district || !data.farmingSector || !data.investmentAmount) {
    showFormMessage(form, 'Please complete all required fields.', true);
    return;
  }

  if (!data.privacyConsent) {
    showFormMessage(form, 'Please accept the privacy consent.', true);
    return;
  }

  formState.pending = true;
  form.querySelector('button[type="submit"]').disabled = true;

  try {
    const response = await fetch('/api/investment-apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        district: data.district,
        municipality: data.municipality,
        farmingSector: data.farmingSector,
        investmentAmount: data.investmentAmount,
        partnershipModel: data.partnershipModel,
        message: data.message,
        privacyConsent: true
      })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Investment application failed.');

    const referenceNode = form.querySelector('.application-reference');
    if (referenceNode) {
      referenceNode.textContent = `Reference: ${result.reference}`;
    }

    showFormMessage(form, `Application submitted successfully. Reference: ${result.reference}`, false);
    form.reset();
  } catch (error) {
    showFormMessage(form, error.message, true);
  } finally {
    formState.pending = false;
    form.querySelector('button[type="submit"]').disabled = false;
  }
}

async function submitAgentApplication(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());

  if (!data.fullName || !data.phone || !data.email || !data.district || !data.coverageArea) {
    showFormMessage(form, 'Please complete all required fields.', true);
    return;
  }
  if (!data.privacyConsent) {
    showFormMessage(form, 'Please accept the privacy consent.', true);
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  formState.pending = true;
  submitButton.disabled = true;
  try {
    const response = await fetch('/api/agent-applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        district: data.district,
        municipality: data.municipality,
        address: data.address,
        experienceYears: data.experienceYears,
        coverageArea: data.coverageArea,
        message: data.message,
        privacyConsent: true,
        website: data.website
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Unable to submit your Agent application.');
    const referenceNode = form.querySelector('.application-reference');
    if (referenceNode) referenceNode.textContent = `Application reference: ${result.reference}`;
    showFormMessage(form, 'Your application has been submitted. Our team will contact you after review.', false);
    form.reset();
  } catch (error) {
    showFormMessage(form, error.message, true);
  } finally {
    formState.pending = false;
    submitButton.disabled = false;
  }
}

window.submitContactForm = submitContactForm;
window.submitInvestmentForm = submitInvestmentForm;
window.submitAgentApplication = submitAgentApplication;

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('form[data-form="contact"]').forEach((form) => {
    form.addEventListener('submit', submitContactForm);
  });

  document.querySelectorAll('form[data-form="investment"]').forEach((form) => {
    form.addEventListener('submit', submitInvestmentForm);
  });
  document.querySelectorAll('form[data-form="agent-application"]').forEach((form) => {
    form.addEventListener('submit', submitAgentApplication);
  });
});
