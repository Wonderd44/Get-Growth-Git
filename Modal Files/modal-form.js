function loadExternalScripts() {
    // Load reCAPTCHA if not already present
    if (!document.querySelector('script[src*="recaptcha/api.js"]')) {
        const recaptchaScript = document.createElement('script');
        recaptchaScript.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
        recaptchaScript.async = true;
        recaptchaScript.defer = true;
        document.head.appendChild(recaptchaScript);
    }

    // Load flatpickr if not already present
    if (!window.flatpickr) {
        const flatpickrScript = document.createElement('script');
        flatpickrScript.src = 'https://cdn.jsdelivr.net/npm/flatpickr';
        document.head.appendChild(flatpickrScript);

        const flatpickrStyle = document.createElement('link');
        flatpickrStyle.rel = 'stylesheet';
        flatpickrStyle.href = 'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css';
        document.head.appendChild(flatpickrStyle);
    }
}
loadExternalScripts();

// modal-form.js - Logic for the Consultation Modal (Dynamic Loading)

// Function to initialize the modal logic AFTER its HTML is loaded
function initializeModal() {
    console.log("_initializeModal function CALLED_"); // Diagnostic log
    const consultationModal = document.getElementById('consultationModal');
    const openConsultationButton = document.getElementById('openConsultationPopup');
    const closeConsultationButton = document.getElementById('closeConsultationPopup');
    const consultationForm = document.getElementById('consultationForm');
    const consultConfirmationMessage = document.getElementById('consultConfirmationMessage');
    const formUserMessage = document.getElementById('formUserMessage');
    const submitButton = consultationForm?.querySelector('.submit-btn');
    const formGrid = consultationForm?.querySelector('.form-grid');
    const formActions = consultationForm?.querySelector('.form-actions');
    let recaptchaWidgetId = null;

    if (!consultationModal || !closeConsultationButton || !consultationForm || !submitButton || !formGrid || !formActions) {
        console.error("Modal elements not found after loading. Check modal-form.html. Make sure all expected IDs and classes are present.");
        return;
    }

    const recaptchaDiv = consultationModal.querySelector('.g-recaptcha');
    function renderRecaptcha() {
        console.log("_renderRecaptcha CALLED_");
        if (recaptchaDiv && typeof grecaptcha !== 'undefined' && grecaptcha.render) {
            console.log("  _renderRecaptcha: grecaptcha API is ready.");
            try {
                 if (recaptchaDiv.innerHTML.trim() === '') {
                     console.log("  _renderRecaptcha: recaptchaDiv is empty, attempting to render...");
                     recaptchaWidgetId = grecaptcha.render(recaptchaDiv, {
                          'sitekey': recaptchaDiv.getAttribute('data-sitekey')
                     });
                     console.log("  _renderRecaptcha: grecaptcha.render() CALLED, widget ID:", recaptchaWidgetId);
                 } else {
                     console.log("  _renderRecaptcha: recaptchaDiv is NOT empty. innerHTML:", recaptchaDiv.innerHTML);
                 }
            } catch (e) {
                 console.error("  _renderRecaptcha: Error in grecaptcha.render():", e);
                 if(formUserMessage) displayFormMessage('Could not load reCAPTCHA. Please refresh.', 'error');
            }
        } else if (!recaptchaDiv) {
            console.error("  _renderRecaptcha: recaptchaDiv NOT FOUND_. Check selector '.g-recaptcha' within the modal content.");
        } else if (typeof grecaptcha === 'undefined') {
             console.log("  _renderRecaptcha: grecaptcha IS UNDEFINED, setting timeout for retry.");
             setTimeout(renderRecaptcha, 500);
        } else if (typeof grecaptcha.render === 'undefined') {
             console.log("  _renderRecaptcha: grecaptcha object exists, but grecaptcha.render IS UNDEFINED. This might indicate an issue with how the API was loaded (e.g., not for explicit rendering, or an incomplete load). Setting timeout for retry.");
             setTimeout(renderRecaptcha, 500);
        }
    }
    renderRecaptcha(); // Initial call during modal initialization

    function openModal() {
        console.log("_openModal CALLED_");
        if (typeof renderRecaptcha === 'function') {
            console.log("  _openModal: Calling renderRecaptcha().");
            renderRecaptcha();
        }

        formGrid.style.display = 'grid';
        formActions.style.display = 'flex';
        if(consultConfirmationMessage) consultConfirmationMessage.style.display = 'none';
        if (formUserMessage) {
            formUserMessage.style.display = 'none';
            formUserMessage.textContent = '';
        }
        if(consultationForm) consultationForm.reset();

        if (typeof grecaptcha !== 'undefined' && grecaptcha.reset && recaptchaWidgetId !== null) {
            console.log("  _openModal: Attempting to reset reCAPTCHA with widget ID:", recaptchaWidgetId);
            try { grecaptcha.reset(recaptchaWidgetId); } catch (e) { console.error("  _openModal: Error resetting reCAPTCHA (with ID):", e); }
        } else if (typeof grecaptcha !== 'undefined' && grecaptcha.reset) {
            console.log("  _openModal: Attempting to reset reCAPTCHA (no specific widget ID).");
            try { grecaptcha.reset(); } catch (e) { console.error("  _openModal: Error resetting reCAPTCHA (no ID fallback):", e); }
        }
        
        if(submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Request Consultation';
        }

        consultationModal.style.display = 'flex';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                 consultationModal.classList.add('visible');
            });
        });
    }

    function closeModal() {
        console.log("_closeModal CALLED_");
        consultationModal.classList.remove('visible');
        setTimeout(() => {
            consultationModal.style.display = 'none';
        }, 300);
    }

    if (openConsultationButton) {
         openConsultationButton.addEventListener('click', openModal);
    } else {
         console.warn("Trigger button (#openConsultationPopup) not found on the main page. Modal might not open via this button.");
    }

    if(closeConsultationButton) closeConsultationButton.addEventListener('click', closeModal);
    consultationModal.addEventListener('click', (event) => {
        if (event.target === consultationModal) {
            closeModal();
        }
    });

    setTimeout(() => {
        const dateTimeInput = document.getElementById('consultDateTime');
        if (dateTimeInput && typeof flatpickr !== 'undefined') {
            try {
                flatpickr(dateTimeInput, {
                    enableTime: true,
                    dateFormat: "Y-m-d H:i",
                    altInput: true,
                    altFormat: "F j, Y at h:i K",
                    time_24hr: false,
                    minDate: "today"
                });
            } catch(e) {
                console.error("Error initializing Flatpickr:", e);
            }
        } else if (dateTimeInput && typeof flatpickr === 'undefined') {
            console.warn("Flatpickr input found, but Flatpickr library is not loaded.");
        }
    }, 100);

    if(consultationForm) {
        consultationForm.addEventListener('submit', function(event) {
            event.preventDefault();
            console.log("_formSubmit CALLED_");

            if (formUserMessage) {
                formUserMessage.style.display = 'none';
                formUserMessage.textContent = '';
            }
            if (consultConfirmationMessage) consultConfirmationMessage.style.display = 'none';

            let isValid = true;
            consultationForm.querySelectorAll('[required]').forEach(input => {
                const parentFormGroup = input.closest('.form-group');
                if (parentFormGroup) input.style.borderColor = '';

                if (!input.value.trim()) {
                    isValid = false;
                    if (parentFormGroup) input.style.borderColor = 'red';
                    console.log("Validation fail: Required field empty - ", input.name);
                } else if (input.type === 'email' && !/^\S+@\S+\.\S+$/.test(input.value)) {
                    isValid = false;
                    if (parentFormGroup) input.style.borderColor = 'red';
                    console.log("Validation fail: Invalid email - ", input.name);
                }
            });

            let recaptchaResponse = '';
            if (typeof grecaptcha !== 'undefined' && grecaptcha.getResponse) {
                console.log("  _formSubmit: Checking reCAPTCHA response.");
                recaptchaResponse = recaptchaWidgetId !== null ? grecaptcha.getResponse(recaptchaWidgetId) : grecaptcha.getResponse();
                 if (!recaptchaResponse) {
                    isValid = false;
                    displayFormMessage('Please complete the reCAPTCHA.', 'error');
                    console.log("  _formSubmit: reCAPTCHA not completed.");
                } else {
                    console.log("  _formSubmit: reCAPTCHA response obtained.");
                }
            } else {
                 isValid = false;
                 displayFormMessage('reCAPTCHA not loaded. Please refresh and try again.', 'error');
                 console.log("  _formSubmit: grecaptcha or getResponse is undefined.");
            }

            if (!isValid) {
                console.log("  _formSubmit: Form is NOT valid.");
                if(formUserMessage && formUserMessage.textContent === ''){
                     displayFormMessage('Please correct the highlighted fields and complete the reCAPTCHA.', 'error');
                }
                return;
            }
            console.log("  _formSubmit: Form IS valid. Proceeding with submission.");

            if(submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Sending...';
            }

            const referrerInput = document.getElementById('referrerUrlInput');
            if (referrerInput) {
                 referrerInput.value = window.location.href;
            }

            const formData = new FormData(consultationForm);
            console.log("  _formSubmit: FormData prepared. Fetching PHP endpoint.");

            fetch('consultation-submit.php', { method: 'POST', body: formData })
            .then(response => {
                console.log("  _formSubmit: Received response from PHP endpoint. Status:", response.status);
                if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
                return response.json();
             })
            .then(data => {
                console.log("  _formSubmit: PHP response JSON data:", data);
                if (data.success) {
                    if(formGrid) formGrid.style.display = 'none';
                    if(formActions) formActions.style.display = 'none';
                    if (consultConfirmationMessage) {
                        consultConfirmationMessage.textContent = data.message || "Thank you! Your consultation request has been sent. We'll be in touch shortly.";
                        consultConfirmationMessage.style.display = 'block';
                    }
                } else {
                    displayFormMessage(data.message || 'An unknown error occurred. Please try again.', 'error');
                    if(submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = 'Request Consultation';
                    }
                    if (typeof grecaptcha !== 'undefined' && grecaptcha.reset) {
                         try { 
                            if(recaptchaWidgetId !== null) grecaptcha.reset(recaptchaWidgetId);
                            else grecaptcha.reset(); 
                        } catch (e) { console.error("  _formSubmit: Error resetting reCAPTCHA on submission failure:", e); }
                    }
                }
            })
            .catch(error => {
                console.error('  _formSubmit: Form Submission Fetch Error:', error);
                displayFormMessage(`A network error occurred: ${error.message}. Please try again.`, 'error');
                if(submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Request Consultation';
                }
                if (typeof grecaptcha !== 'undefined' && grecaptcha.reset) {
                     try {
                        if(recaptchaWidgetId !== null) grecaptcha.reset(recaptchaWidgetId);
                        else grecaptcha.reset();
                    } catch (e) { console.error("  _formSubmit: Error resetting reCAPTCHA on fetch error:", e); }
                }
            });
        });
    }

    function displayFormMessage(message, type = 'error') {
        if (!formUserMessage) {
            console.error("displayFormMessage: formUserMessage element not found. Message:", message);
            return;
        }
        formUserMessage.textContent = message;
        formUserMessage.style.backgroundColor = (type === 'error') ? '#fff5f5' : '#f0fdf4';
        formUserMessage.style.borderColor = (type === 'error') ? '#fca5a5' : '#a3e6b6';
        formUserMessage.style.color = (type === 'error') ? '#b91c1c' : '#166534';
        formUserMessage.style.display = 'block';
    }

} // End of initializeModal function


document.addEventListener('DOMContentLoaded', () => {
    console.log("_DOMContentLoaded: Event Fired_");
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
        console.log("_DOMContentLoaded: modalContainer found. Fetching modal HTML..._");
        fetch('Modal Files/modal-form.html') 
            .then(response => {
                console.log("_DOMContentLoaded: Fetch response status:", response.status);
                if (!response.ok) { throw new Error(`HTTP error loading modal HTML! status: ${response.status}`); }
                return response.text();
            })
            .then(html => {
                console.log("_DOMContentLoaded: Modal HTML fetched successfully. Injecting and initializing modal..._");
                modalContainer.innerHTML = html;
                initializeModal();
            })
            .catch(error => {
                console.error('_DOMContentLoaded: Error loading or initializing modal:', error);
                if(modalContainer) modalContainer.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Error loading consultation form. Please try refreshing the page.</p>';
            });
    } else {
        console.error("_DOMContentLoaded: Crucial element with ID 'modal-container' not found in the main HTML. Modal cannot be loaded._");
    }
});