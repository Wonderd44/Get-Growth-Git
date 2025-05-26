// ---- CONFIGURATION ----
const BACKEND_URL = 'https://worker.danwellington44.workers.dev'; // Example backend URL
const RETURN_URL = `${window.location.origin}/order-confirmation.html`; // Example return URL for Stripe
// ---------------------

// --- Global Variables ---
let stripe = null; // Stripe.js instance
let elements = null; // Stripe Elements instance
let clientSecret = null; // PaymentIntent client secret
let isLoadingPayment = false; // Flag to prevent multiple payment submissions
let isLoadingStep = false; // Flag to prevent multiple step transitions
let currentStep = 1; // Tracks the current visible step (1, 2, or 3)
let priceDetails = null; // Stores details fetched for the selected priceId
let collectedData = {}; // Object to store data from all form steps
let isAnalyticsInitialized = false; // Flag to ensure analytics initializes only once

// --- DOM Elements ---
// It's good practice to cache DOM elements that are frequently accessed.
const stepsContainer = document.getElementById('steps-container');
const progressStep1 = document.getElementById('progress-step-1');
const progressStep2 = document.getElementById('progress-step-2');
const progressStep3 = document.getElementById('progress-step-3');
const progressSteps = [progressStep1, progressStep2, progressStep3];

// Step 1 Form Elements
const step1Form = document.getElementById('step-1-form');
const firstNameInput = document.getElementById('first-name-input');
const lastNameInput = document.getElementById('last-name-input');
const emailInput = document.getElementById('email-input');
const phoneInput = document.getElementById('phone-input');
const step1NextButton = document.getElementById('continue-button');
const step1Message = document.getElementById('step-1-message');

// Step 2 Form Elements
const step2Form = document.getElementById('step-2-form');
const businessNameInput = document.getElementById('business-name-input');
const locationInput = document.getElementById('location-input');
// const adLocationInput = document.getElementById('ad-location-input'); // This element was in JS but not HTML, commented out
const yearsInput = document.getElementById('years-input');
const achieveInput = document.getElementById('achieve-input');
const step2NextButton = document.getElementById('to-step-3');
const step2Message = document.getElementById('step-2-message');
const backToStep1Button = document.getElementById('back-to-step-1');

// Step 3 Payment Elements
const paymentForm = document.getElementById('payment-form');
const paymentElementDiv = document.getElementById('payment-element');
const paymentElementLoader = document.getElementById('payment-element-loader');
const submitButton = document.getElementById('submit-button');
const paymentMessage = document.getElementById('payment-message');
const backToStep2Button = document.getElementById('back-to-step-2');

// Order Summary Elements
const summaryPlaceholder = document.getElementById('summary-placeholder');
const summaryContent = document.getElementById('summary-content');
const summaryError = document.getElementById('summary-error');
const summaryPackageName = document.getElementById('summary-package-name');
const summaryPackagePrice = document.getElementById('summary-package-price');
const summaryTotalPrice = document.getElementById('summary-total-price');
const summaryFeaturesSection = document.getElementById('summary-features-section');
const summaryFeaturesList = document.getElementById('summary-features-list');

// --- Analytics Functions ---
/**
 * Initializes analytics tracking if not already done.
 * Tracks an initial page view.
 */
function initializeAnalytics() {
    if (isAnalyticsInitialized) return;
    console.log("Analytics initialized");
    trackEvent('page_view', {
        page: 'checkout',
        referrer: document.referrer,
        priceId: collectedData.priceId || ''
    });
    isAnalyticsInitialized = true;
}

/**
 * Tracks a custom event with optional data.
 * Logs to console and sends to Google Analytics (gtag) and Facebook Pixel (fbq) if available.
 * @param {string} eventName - The name of the event to track.
 * @param {object} eventData - Additional data associated with the event.
 */
function trackEvent(eventName, eventData = {}) {
    console.log(`Analytics: ${eventName}`, eventData);
    if (typeof gtag === 'function') {
        gtag('event', eventName, eventData);
    }
    if (typeof fbq === 'function') {
        // For standard FB events, use fbq('track', 'EventName'); for custom, use fbq('trackCustom', 'CustomEventName');
        // Assuming generic custom events for this example
        fbq('trackCustom', eventName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), eventData);
    }
}

/**
 * Tracks when a checkout step is viewed.
 * @param {number} stepNumber - The number of the step being viewed.
 */
function trackStepView(stepNumber) {
    trackEvent('view_checkout_step', {
        step: stepNumber,
        step_name: getStepName(stepNumber)
    });
}

/**
 * Gets the name of a step based on its number.
 * @param {number} stepNumber - The step number.
 * @returns {string} The name of the step or 'unknown'.
 */
function getStepName(stepNumber) {
    const steps = ['contact', 'business', 'payment'];
    return steps[stepNumber - 1] || 'unknown';
}

/**
 * Tracks when a form field is successfully completed (validated).
 * @param {string} fieldName - The name of the completed field.
 * @param {number} stepNumber - The current step number.
 */
function trackFieldCompletion(fieldName, stepNumber) {
    trackEvent('form_field_completion', {
        field_name: fieldName,
        step: stepNumber,
        step_name: getStepName(stepNumber)
    });
}

/**
 * Tracks the completion progress of a form for a given step.
 * @param {number} stepNumber - The current step number.
 * @param {number} percentComplete - The percentage of required fields filled.
 */
function trackFormCompletion(stepNumber, percentComplete) {
    trackEvent('form_completion_progress', {
        step: stepNumber,
        step_name: getStepName(stepNumber),
        percent_complete: percentComplete
    });
}


// --- Helper Functions ---
/**
 * Formats a price amount and currency into a displayable string.
 * @param {number} amount - The price amount in cents.
 * @param {string} currency - The currency code (e.g., 'USD').
 * @returns {string} The formatted price string (e.g., '$19.99').
 */
function formatPrice(amount, currency) {
    if (typeof amount !== 'number' || !currency) return '$?.??';
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase()
        }).format(amount / 100);
    } catch (e) {
        console.warn(`Price formatting error:`, e);
        return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
    }
}

/**
 * Updates the order summary section with price details.
 */
function updateOrderSummary() {
    if (priceDetails) {
        if (summaryPackageName) summaryPackageName.textContent = priceDetails.name || 'Package';
        const formattedPrice = formatPrice(priceDetails.amount, priceDetails.currency);
        let priceText = formattedPrice;
        if (priceDetails.recurring && priceDetails.interval === 'month') {
            priceText += ' / month';
        }
        if (summaryPackagePrice) summaryPackagePrice.textContent = priceText;
        if (summaryTotalPrice) summaryTotalPrice.textContent = formattedPrice;

        if (summaryFeaturesList && summaryFeaturesSection && Array.isArray(priceDetails.features) && priceDetails.features.length > 0) {
            summaryFeaturesList.innerHTML = ''; // Clear existing features
            priceDetails.features.forEach(featureText => {
                const li = document.createElement('li');
                li.innerHTML = `<i data-feather="check" class="inline-block w-3 h-3 mr-1.5 text-green-500 stroke-current stroke-2"></i> ${featureText}`;
                summaryFeaturesList.appendChild(li);
            });
            summaryFeaturesSection.classList.remove('hidden');
        } else {
            if (summaryFeaturesSection) summaryFeaturesSection.classList.add('hidden');
            if (summaryFeaturesList) summaryFeaturesList.innerHTML = '';
        }

        if (summaryPlaceholder) {
            summaryPlaceholder.style.opacity = '0';
            setTimeout(() => {
                if (summaryPlaceholder) summaryPlaceholder.style.display = 'none';
                if (summaryError) summaryError.classList.add('hidden');
                if (summaryContent) summaryContent.classList.remove('summary-content-loading');
            }, 300); // Match CSS transition
        }
    } else {
        if (summaryPlaceholder) summaryPlaceholder.style.display = 'none';
        if (summaryContent) summaryContent.classList.add('summary-content-loading');
        if (summaryFeaturesSection) summaryFeaturesSection.classList.add('hidden');
        if (summaryError) {
            summaryError.classList.remove('hidden');
            summaryError.textContent = summaryError.textContent || 'Could not load order details.';
        }
        console.error("Price details are missing, cannot update order summary.");
    }
}

/**
 * Shows a toast notification.
 * @param {string} message - The message to display.
 * @param {string} type - 'info', 'success', or 'error'.
 * @param {number} duration - How long the toast stays visible in ms.
 */
function showToast(message, type = 'info', duration = 3000) {
    const existingToasts = document.querySelectorAll('.toast-notification');
    existingToasts.forEach(t => t.remove()); // Remove any existing toasts

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    let iconClass = 'fa-circle-info'; // Default for info
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-xmark';

    toast.innerHTML = `<div class="flex items-center"><i class="fa-solid ${iconClass} mr-2"></i>${message}</div>`;
    document.body.appendChild(toast);

    // Trigger reflow to enable transition
    setTimeout(() => toast.classList.add('visible'), 10);

    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300); // Remove from DOM after transition
    }, duration);
}

/**
 * Calculates the percentage of required fields that are filled in a form.
 * @param {HTMLFormElement} formElement - The form to check.
 * @returns {number} The completion percentage (0-100).
 */
function calculateFormCompletionPercentage(formElement) {
    if (!formElement) return 0;
    const requiredFields = formElement.querySelectorAll('[required]');
    if (requiredFields.length === 0) return 100; // No required fields means 100% complete

    let filledCount = 0;
    requiredFields.forEach(field => {
        if (field.value.trim() !== '') {
            filledCount++;
        }
    });
    return Math.round((filledCount / requiredFields.length) * 100);
}

/**
 * Creates and animates confetti particles for a celebratory effect.
 * @param {number} count - The number of confetti particles to create.
 */
function createConfetti(count = 50) {
    for (let i = 0; i < count; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.animationDuration = (Math.random() * 2 + 3) + 's'; // Fall duration
        confetti.style.animationDelay = Math.random() * 1 + 's';
        const colors = ['#AEFF00', '#34d399', '#fbbf24', '#60a5fa', '#ec4899'];
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.width = (Math.random() * 5 + 5) + 'px';
        confetti.style.height = confetti.style.width;
        confetti.style.opacity = Math.random() * 0.5 + 0.5;
        document.body.appendChild(confetti);
        setTimeout(() => {
            confetti.remove();
        }, parseFloat(confetti.style.animationDuration) * 1000 + parseFloat(confetti.style.animationDelay) * 1000 + 500);
    }
}


/**
 * Fetches price details from the backend.
 * @param {string} priceId - The ID of the price to fetch.
 * @returns {Promise<object|null>} The price details object or null if an error occurs.
 */
async function fetchPriceDetails(priceId) {
    console.log(`Fetching price details for: ${priceId}`);
    if (!priceId) {
        console.error("No priceId provided to fetchPriceDetails.");
        if (summaryError) summaryError.textContent = 'Error: Missing product/price ID.';
        return null;
    }

    if (summaryPlaceholder) {
        summaryPlaceholder.style.display = 'flex'; // Show loader
        summaryPlaceholder.style.opacity = '1';
    }
    if (summaryContent) summaryContent.classList.add('summary-content-loading'); // Hide content
    if (summaryError) summaryError.classList.add('hidden'); // Hide error

    try {
        // Simulate network delay for UX, remove in production if not needed
        await new Promise(resolve => setTimeout(resolve, 800));

        const response = await fetch(`${BACKEND_URL}/api/prices/${priceId}`);
        if (!response.ok) {
            let errorDetail = `Server responded with status ${response.status}`;
            try {
                const errorData = await response.json();
                errorDetail = errorData.error || errorData.message || errorDetail;
            } catch (e) { /* Ignore if response is not JSON */ }
            throw new Error(`Failed to fetch price information: ${errorDetail}`);
        }
        const data = await response.json();

        // Basic validation of the received data structure
        if (!data || typeof data.name !== 'string' || typeof data.amount !== 'number' || typeof data.currency !== 'string' || typeof data.recurring !== 'boolean' || (data.features && !Array.isArray(data.features))) {
            console.error("Invalid price data received from server:", data);
            throw new Error("Received invalid price information from the server.");
        }
        data.features = data.features || []; // Ensure features array exists

        trackEvent('price_details_loaded', { price_id: priceId, price_name: data.name });
        console.log("Fetched price details:", data);
        return data;
    } catch (error) {
        console.error("Error fetching price details:", error);
        trackEvent('price_details_error', { price_id: priceId, error_message: error.message });
        if (summaryError) {
            summaryError.textContent = `Error loading details: ${error.message}`;
            summaryError.classList.remove('hidden');
            if (summaryPlaceholder) summaryPlaceholder.style.display = 'none';
            if (summaryContent) summaryContent.classList.add('summary-content-loading');
            if (summaryFeaturesSection) summaryFeaturesSection.classList.add('hidden');
        }
        return null;
    }
}

/**
 * Shows a spinner on a button and disables it.
 * @param {HTMLButtonElement} buttonElement - The button to update.
 * @param {string} [spinnerText='Processing...'] - Optional text to display next to the spinner.
 */
function showButtonSpinner(buttonElement, spinnerText = 'Processing...') {
    if (!buttonElement) return;
    const spinner = buttonElement.querySelector('.spinner');
    const buttonText = buttonElement.querySelector('.button-text');

    if (spinner) spinner.classList.remove('hidden');
    if (buttonText && spinnerText) buttonText.textContent = spinnerText;
    buttonElement.disabled = true;
}

/**
 * Hides the spinner on a button and re-enables it.
 * @param {HTMLButtonElement} buttonElement - The button to update.
 * @param {string} originalButtonText - The original text to restore to the button.
 */
function hideButtonSpinner(buttonElement, originalButtonText) {
    if (!buttonElement) return;
    const spinner = buttonElement.querySelector('.spinner');
    const buttonText = buttonElement.querySelector('.button-text');

    if (spinner) spinner.classList.add('hidden');
    if (buttonText && originalButtonText) buttonText.textContent = originalButtonText;

    // Special handling for the main submit button on payment step
    if (buttonElement.id === 'submit-button') {
        buttonElement.disabled = !elements || isLoadingPayment; // Only enable if Stripe Elements are ready and not currently processing
    } else {
        buttonElement.disabled = false;
    }
}

/**
 * Shows a spinner and disables inputs for a step transition.
 * @param {number} targetStep - The step number being transitioned to.
 */
function showStepSpinner(targetStep) {
    isLoadingStep = true;
    if (targetStep === 2) { // Transitioning from step 1 to step 2
        showButtonSpinner(step1NextButton, 'Saving...');
        [firstNameInput, lastNameInput, emailInput, phoneInput].forEach(el => {
            if (el) el.disabled = true;
        });
    } else if (targetStep === 3) { // Transitioning from step 2 to step 3
        showButtonSpinner(step2NextButton, 'Initializing Payment...');
        [businessNameInput, locationInput, yearsInput, achieveInput].forEach(el => {
            if (el) el.disabled = true;
        });
    }
}

/**
 * Hides the spinner and re-enables inputs after a step transition.
 * @param {number} completedStep - The step number that was just completed/left.
 */
function hideStepSpinner(completedStep) {
    isLoadingStep = false;
    if (completedStep === 1) { // Finished step 1, now on step 2
        hideButtonSpinner(step1NextButton, 'Next: Business Info');
        [firstNameInput, lastNameInput, emailInput, phoneInput].forEach(el => {
            if (el) el.disabled = false;
        });
    } else if (completedStep === 2) { // Finished step 2, now on step 3
        hideButtonSpinner(step2NextButton, 'Continue to Payment');
        [businessNameInput, locationInput, yearsInput, achieveInput].forEach(el => {
            if (el) el.disabled = false;
        });
    }
}

/**
 * Shows the main payment processing spinner.
 */
function showPaymentSpinner() {
    isLoadingPayment = true;
    if (submitButton) showButtonSpinner(submitButton, 'Processing Payment...');
}

/**
 * Hides the main payment processing spinner.
 */
function hidePaymentSpinner() {
    isLoadingPayment = false;
    if (submitButton && elements) { // Check if elements are initialized
        hideButtonSpinner(submitButton, 'Pay Now');
        // submitButton should be re-enabled/disabled based on Stripe Element state by its own event listeners
    } else if (submitButton) {
        hideButtonSpinner(submitButton, 'Pay Now');
        submitButton.disabled = true; // Disable if elements aren't ready
    }
}

/**
 * Displays a message (error or success) for a specific step.
 * @param {number} step - The step number (1, 2, or 3).
 * @param {string} messageText - The message to display.
 * @param {boolean} [isError=true] - True if it's an error message, false for success.
 */
function showStepMessage(step, messageText, isError = true) {
    let messageElement;
    if (step === 1) messageElement = step1Message;
    else if (step === 2) messageElement = step2Message;
    else if (step === 3) messageElement = paymentMessage;
    else return; // Invalid step

    if (messageElement) {
        messageElement.textContent = messageText || '';
        messageElement.classList.toggle('text-red-600', isError && !!messageText);
        messageElement.classList.toggle('text-green-600', !isError && !!messageText);

        // Trigger animation if there's a message
        if (messageText) {
            messageElement.style.animation = 'none'; // Reset animation
            void messageElement.offsetWidth; // Trigger reflow
            messageElement.style.animation = 'fadeInUp 0.3s ease-out forwards';
        }
    }
}


// --- Validation Functions ---
const validationRules = {
    'first-name-input': { required: true, message: 'First name is required.' },
    'last-name-input': { required: true, message: 'Last name is required.' },
    'email-input': { required: true, type: 'email', message: 'A valid email address is required.' },
    'phone-input': { required: true, message: 'Phone number is required.' }, // Basic required, can add regex for format
    'business-name-input': { required: true, message: 'Business name is required.' },
    'location-input': { required: true, message: 'Location (City, State) is required.' },
    'years-input': { required: true, message: 'Years in business is required.'}, // Can add type: 'number' if you want to enforce numeric
    'achieve-input': { required: true, message: 'Please describe your primary goals.' }
};

const validIconHTML = `<i data-feather="check-circle" class="step-icon text-green-500 w-4 h-4"></i>`;
const invalidIconHTML = `<i data-feather="x-circle" class="step-icon text-red-500 w-4 h-4"></i>`;

/**
 * Validates a single input field based on predefined rules.
 * Updates UI with validation status (icon and message).
 * @param {HTMLInputElement|HTMLTextAreaElement} inputElement - The input field to validate.
 * @returns {boolean} True if the field is valid, false otherwise.
 */
function validateField(inputElement) {
    if (!inputElement) return true; // Should not happen if called correctly
    const rule = validationRules[inputElement.id];
    if (!rule) return true; // No validation rule for this field

    const value = inputElement.value.trim();
    let isValid = true;
    let errorMessage = '';

    const iconElement = document.getElementById(`${inputElement.id}-validation-icon`);
    const messageElement = document.getElementById(`${inputElement.id}-validation-message`);

    if (rule.required && value === '') {
        isValid = false;
        errorMessage = rule.message || 'This field is required.';
    } else if (rule.type === 'email' && !/^\S+@\S+\.\S+$/.test(value)) {
        isValid = false;
        errorMessage = rule.message || 'Please enter a valid email address.';
    } else if (rule.type === 'number') {
        const numericValue = parseInt(value, 10);
        if (isNaN(numericValue) || (typeof rule.min === 'number' && numericValue < rule.min) || (typeof rule.max === 'number' && numericValue > rule.max)) {
            isValid = false;
            errorMessage = rule.message || `Please enter a valid number.`;
        }
    }
    // Add more specific validation rules as needed (e.g., phone format, length)

    inputElement.classList.toggle('is-valid', isValid && value !== ''); // Only show valid if not empty
    inputElement.classList.toggle('is-invalid', !isValid);

    let iconHTML = '';
    if (isValid && value !== '') { // Field is valid and has content
        iconHTML = validIconHTML;
    } else if (!isValid) { // Field is invalid
        iconHTML = invalidIconHTML;
    }
    // If field is valid but empty (e.g. optional field), no icon.

    if (iconElement) {
        iconElement.innerHTML = iconHTML;
        if (iconHTML && typeof feather !== 'undefined') { // Only call replace if there's an icon
            feather.replace(); // Render the new Feather icon
        }
    }
    if (messageElement) {
        messageElement.textContent = errorMessage;
        if (errorMessage) { // Animate message appearance
            messageElement.style.animation = 'none';
            void messageElement.offsetWidth; // Trigger reflow
            messageElement.style.animation = 'fadeInUp 0.3s ease-out forwards';
        }
    }

    if (isValid && value !== '') {
        trackFieldCompletion(inputElement.name || inputElement.id, currentStep);
    }
    return isValid;
}

/**
 * Validates all required fields in a given form.
 * @param {HTMLFormElement} formElement - The form to validate.
 * @returns {boolean} True if all required fields are valid, false otherwise.
 */
function validateStepForm(formElement) {
    if (!formElement) return false;
    let isFormValid = true;
    // Query for inputs and textareas that have the 'required' attribute
    formElement.querySelectorAll('input[required], textarea[required]').forEach(input => {
        if (!validateField(input)) {
            isFormValid = false;
        }
    });
    trackFormCompletion(currentStep, calculateFormCompletionPercentage(formElement));
    return isFormValid;
}

function setupValidation() {
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        input.addEventListener('blur', () => {
            validateField(input);
        });
    });
}

// --- Step Navigation & Progress Bar ---
/**
 * Navigates to the specified step number.
 * Updates the progress bar and slides the step content.
 * @param {number} stepNumber - The target step number (1, 2, or 3).
 */
function goToStep(stepNumber) {
    if (isLoadingStep || stepNumber < 1 || stepNumber > 3 || stepNumber === currentStep) {
        // Prevent navigation if already loading, out of bounds, or already on the target step
        if (stepNumber === currentStep && document.getElementById(`step-${stepNumber}`)?.classList.contains('step-visible')) {
            // If already on the step and it's visible, do nothing further.
            return;
        }
    }

    const previousStepEl = document.getElementById(`step-${currentStep}`);
    if (previousStepEl && currentStep !== stepNumber) {
         previousStepEl.classList.remove('step-visible');
    }

    currentStep = stepNumber; // Update the global current step tracker

    // Calculate the translation percentage for the steps container
    // Each step takes up 100% / 3 = 33.333% of the container width
    let translatePercentage = (stepNumber - 1) * -33.333;
    if (stepsContainer) {
        stepsContainer.style.transform = `translateX(${translatePercentage}%)`;
    }

    // Update progress bar appearance
    progressSteps.forEach((stepElement, index) => {
        if (!stepElement) return;
        const stepIndex = index + 1; // Progress steps are 1-indexed
        stepElement.classList.remove('active', 'completed');
        if (stepIndex < stepNumber) {
            stepElement.classList.add('completed');
        } else if (stepIndex === stepNumber) {
            stepElement.classList.add('active');
        }
    });

    document.title = `Checkout – Step ${stepNumber} | Get Growth Media`; // Update page title
    window.scrollTo(0, 0); // Scroll to top of page
    trackStepView(stepNumber); // Track step view for analytics

    const currentStepEl = document.getElementById(`step-${stepNumber}`);
    if (currentStepEl) {
        // Delay adding 'step-visible' to ensure CSS transitions apply correctly
        // This allows the transform to happen first, then the opacity/visibility change.
        setTimeout(() => {
             if (currentStep === stepNumber) { // Double check we are still on the intended step
                 currentStepEl.classList.add('step-visible');
                 console.log(`Made step-${stepNumber} visible.`);
             }
        }, 50); // A small delay, adjust if needed, must be less than CSS transition for transform.
    }
}
// --- END Step Navigation ---


// --- Stripe Elements Initialization ---
/**
 * Initializes Stripe Elements and mounts the Payment Element.
 * This is typically called when navigating to the payment step.
 * @returns {Promise<boolean>} True if initialization was successful, false otherwise.
 */
async function initializeAndMountElements() {
    if (!stripe) {
        console.error("Stripe.js has not been loaded. Cannot initialize Elements.");
        showStepMessage(2, "Error: Payment gateway failed to load. Please refresh."); // Show message on previous step if possible
        return false;
    }
    if (!clientSecret) {
        console.error("Client secret is missing. Cannot initialize Stripe Elements.");
        showStepMessage(2, "Error: Payment authorization failed. Please try again.");
        return false;
    }
    if (elements) { // Already initialized
        console.log("Stripe Elements already initialized.");
        if (submitButton) submitButton.disabled = false; // Ensure button is enabled
        return true;
    }

    try {
        console.log("Initializing Stripe Elements...");
        const appearance = {
            theme: 'stripe', // or 'night', 'flat'
            labels: 'floating', // or 'above'
            variables: {
                colorPrimary: '#AEFF00', // Your brand color for focused elements
                colorBackground: '#ffffff',
                colorText: '#1A202C',
                colorDanger: '#ef4444',
                fontFamily: 'Inter, system-ui, sans-serif',
                spacingUnit: '4px', // Adjusts padding and margins within elements
                borderRadius: '6px', // Border radius for inputs
                focusRingColor: 'rgba(174, 255, 0, 0.3)', // Custom focus ring
            },
            rules: { // CSS-like rules to customize elements further
                '.Input:focus': {
                    borderColor: '#AEFF00', // Matches premium-input focus
                    boxShadow: '0 0 0 3px rgba(174, 255, 0, 0.2)', // Matches premium-input focus
                },
                '.Input--invalid': {
                    borderColor: '#ef4444', // Matches premium-input invalid
                }
            }
        };
        // Pass the client secret and appearance to create the Elements instance
        elements = stripe.elements({ appearance, clientSecret });

        // Create and mount the Payment Element
        const paymentElement = elements.create("payment", {
            layout: "tabs" // or "accordion"
        });

        if (paymentElementLoader) paymentElementLoader.style.display = 'none';
        if (paymentElementDiv) {
            paymentElementDiv.style.display = 'block';
            paymentElement.mount("#payment-element"); // Mount to the div
        } else {
            throw new Error("Payment Element container (#payment-element) not found in DOM.");
        }

        paymentElement.on('ready', () => {
            console.log("Stripe Payment Element is ready.");
            // Enable submit button only when payment element is ready and not currently processing
            if (!isLoadingPayment && submitButton) {
                submitButton.disabled = false;
            }
        });

        paymentElement.on('change', (event) => {
            // Disable the Pay button if there are errors or the form is incomplete
            if (submitButton) {
                submitButton.disabled = !!event.error || !event.complete || isLoadingPayment;
            }
            // Display any errors from the Payment Element
            showStepMessage(3, event.error ? event.error.message : "");
        });

        console.log("Stripe Elements created and Payment Element mounted.");
        if (submitButton) submitButton.disabled = false; // Initial state, might be overridden by 'change' event
        return true;

    } catch (error) {
        console.error("Error initializing or mounting Stripe Elements:", error);
        showStepMessage(2, "Error displaying payment form. Please try again."); // Show on previous step
        if (paymentElementLoader) {
            paymentElementLoader.innerHTML = '<i data-feather="alert-triangle" class="mx-auto"></i><br>Error loading payment form.';
            try { if (typeof feather !== 'undefined') feather.replace(); } catch (e) { console.warn("Feather error on payment loader:", e); }
            paymentElementLoader.style.display = 'block';
        }
        if (paymentElementDiv) paymentElementDiv.style.display = 'none';
        if (submitButton) submitButton.disabled = true;
        return false;
    }
}


// --- Event Handlers ---

// Step 1 "Next" Button
if (step1NextButton && step1Form) {
    step1NextButton.addEventListener('click', () => {
        console.log("Step 1 'Next' button clicked.");
        showStepMessage(1, ''); // Clear previous messages
        const isStep1Valid = validateStepForm(step1Form);
        console.log("Step 1 form validation result:", isStep1Valid);

        if (isLoadingStep || !isStep1Valid) {
            console.log("Step 1 validation failed or already loading.");
            showStepMessage(1, 'Please correct the errors above before continuing.');
            // Focus the first invalid field for better UX
            const firstInvalidField = step1Form.querySelector('.is-invalid');
            if (firstInvalidField) firstInvalidField.focus();
            return;
        }

        console.log("Step 1 validation successful.");
        showStepSpinner(2); // Show spinner for transition to step 2

        // Collect data from Step 1
        collectedData = {
            ...collectedData, // Preserve existing data (like priceId)
            firstName: firstNameInput?.value.trim(),
            lastName: lastNameInput?.value.trim(),
            email: emailInput?.value.trim(),
            phone: phoneInput?.value.trim(),
        };
        console.log("Collected data after Step 1:", collectedData);
        trackEvent('checkout_step_complete', { step: 1, step_name: getStepName(1) });

        // Simulate async operation (e.g., saving data) then navigate
        setTimeout(() => {
            console.log("Transitioning to Step 2.");
            goToStep(2);
            hideStepSpinner(1); // Hide spinner after completing step 1 actions
        }, 700); // Delay for spinner visibility and simulated save
    });
} else {
    console.error("Step 1 'Next' button or form element not found.");
}

// Step 2 "Continue to Payment" Button
if (step2NextButton && step2Form) {
    step2NextButton.addEventListener('click', async () => {
        showStepMessage(2, ''); // Clear previous messages
        if (isLoadingStep || !validateStepForm(step2Form)) {
            showStepMessage(2, 'Please correct the errors above to proceed.');
            const firstInvalidField = step2Form.querySelector('.is-invalid');
            if (firstInvalidField) firstInvalidField.focus();
            return;
        }

        showStepSpinner(3); // Show spinner for transition to step 3

        collectedData = {
            ...collectedData,
            businessName: businessNameInput?.value.trim(),
            location: locationInput?.value.trim(),
            yearsInBusiness: yearsInput?.value.trim(),
            achieveGoal: achieveInput?.value.trim(),
        };
        console.log("Collected data after Step 2:", collectedData);
        trackEvent('checkout_step_complete', { step: 2, step_name: getStepName(2) });

        try {
            const { priceId, email } = collectedData;
            if (!priceId) {
                throw new Error("Price ID is missing. Cannot initialize payment.");
            }
            if (!email) {
                throw new Error("Email is missing. Cannot initialize payment.");
            }

            // API call to backend to create a PaymentIntent
            const response = await fetch(`${BACKEND_URL}/api/initialize-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ priceId, email, customerDetails: collectedData }), // Send all collected data
            });

            if (!response.ok) {
                let errorMessage = `Payment setup failed (Status: ${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.details || errorMessage;
                } catch (e) { /* Response might not be JSON */ }
                throw new Error(errorMessage);
            }

            const setupData = await response.json();
            clientSecret = setupData.clientSecret; // Store the client secret

            if (!clientSecret) {
                throw new Error('Client secret not received from server.');
            }
            console.log("PaymentIntent client secret received.");
            trackEvent('payment_intent_created', { price_id: priceId });

            // Initialize and mount Stripe Elements
            const elementsInitialized = await initializeAndMountElements();
            if (elementsInitialized) {
                goToStep(3);
            } else {
                // Error message would have been shown by initializeAndMountElements
                throw new Error("Failed to initialize Stripe payment form.");
            }
        } catch (error) {
            console.error("Error during payment initialization or Step 2 next action:", error);
            showStepMessage(2, `Error: ${error.message}`);
            trackEvent('payment_setup_error', { error_message: error.message, step: 2 });
            showToast("A problem occurred while setting up payment. Please try again.", "error");
        } finally {
            hideStepSpinner(2); // Hide spinner after completing step 2 actions
        }
    });
} else {
    console.error("Step 2 'Continue to Payment' button or form element not found.");
}

// Payment Form Submission (Step 3)
if (paymentForm) {
    paymentForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission

        if (isLoadingPayment || !stripe || !elements || !clientSecret || (submitButton && submitButton.disabled)) {
            let msg = "Payment system is not ready.";
            if (submitButton && submitButton.disabled && !isLoadingPayment) msg = "Please complete the payment form or correct errors.";
            showStepMessage(3, msg);
            return;
        }

        showPaymentSpinner(); // Show spinner on submit button
        showStepMessage(3, ''); // Clear previous messages
        trackEvent('payment_attempt', { price_id: collectedData.priceId });

        try {
            const { error } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: RETURN_URL, // URL Stripe will redirect to after payment
                    receipt_email: collectedData.email, // Optional: prefill email for receipt
                    payment_method_data: { // Optional: prefill billing details
                        billing_details: {
                            name: `${collectedData.firstName || ''} ${collectedData.lastName || ''}`.trim(),
                            email: collectedData.email,
                            phone: collectedData.phone,
                            // address: {} // Can add address if collected
                        }
                    }
                },
            });

            // This point will only be reached if there is an immediate error during confirmPayment().
            // Otherwise, the browser will be redirected to the return_url.
            if (error) {
                let userMessage = "An unexpected error occurred with your payment.";
                if (error.type === "card_error" || error.type === "validation_error") {
                    userMessage = error.message || userMessage;
                }
                showStepMessage(3, userMessage);
                console.error("Stripe confirmPayment error:", error);
                trackEvent('payment_error', { error_type: error.type, error_message: error.message });
                showToast("Payment failed. Please check your details or try another card.", "error");
                createConfetti(10); // Negative confetti? Maybe not.
            }
            // If no error, redirection to RETURN_URL happens. Logic there will handle success/failure.
        } catch (processError) {
            // Catch any unexpected errors during the process itself (not Stripe API errors)
            console.error("Error during Stripe confirmPayment process:", processError);
            showStepMessage(3, `Critical Error: ${processError.message}`);
            trackEvent('payment_exception', { error_message: processError.message });
        } finally {
            // Hide spinner, but button state will depend on Stripe Element state
            // if not redirected.
            hidePaymentSpinner();
        }
    });
} else {
    console.error("Payment form element not found.");
}


// --- Back Buttons ---
if (backToStep1Button) {
    backToStep1Button.addEventListener('click', () => {
        if (isLoadingStep) return;
        goToStep(1);
        trackEvent('navigate_back', { from_step: 2, to_step: 1 });
    });
}

if (backToStep2Button) {
    backToStep2Button.addEventListener('click', () => {
        if (isLoadingStep) return;
        goToStep(2);
        trackEvent('navigate_back', { from_step: 3, to_step: 2 });
        // Payment elements might need to be re-evaluated or re-initialized if user goes back and forth
        // For simplicity, current implementation assumes they remain valid.
        // If clientSecret could change, it would need to be re-fetched.
    });
}


// --- Initial Page Load Logic ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Checkout page DOM fully loaded and parsed.");
    initializeAnalytics(); // Initialize analytics tracking

    // Initialize tsParticles if the library is loaded
    if (typeof tsParticles !== 'undefined' && typeof tsParticles.load === 'function') {
        tsParticles.load("tsparticles", {
            fpsLimit: 60,
            interactivity: {
                events: {
                    onHover: { enable: true, mode: "grab" },
                    onClick: { enable: true, mode: "push" },
                },
                modes: { grab: { distance: 140, links: { opacity: 0.3 } }, push: { quantity: 2 } }
            },
            particles: {
                color: { value: "#AEFF00" }, // Light green accent
                links: { color: "#AEFF00", distance: 150, enable: true, opacity: 0.1, width: 1 },
                move: { enable: true, speed: 0.5, direction: "none", random: true, straight: false, outModes: "out" },
                number: { density: { enable: true, area: 800 }, value: 30 }, // Fewer particles
                opacity: { value: { min: 0.1, max: 0.3 } }, // More subtle
                shape: { type: "circle" },
                size: { value: { min: 1, max: 3 } }
            },
            detectRetina: true,
        }).then(container => {
            console.log("tsParticles loaded successfully.");
        }).catch(error => {
            console.warn("tsParticles loading failed:", error);
        });
    } else {
        console.warn("tsParticles library not found or 'load' function is missing.");
    }


    // Initialize MutationObserver for validation icons to trigger Feather replacement
    const validationIcons = document.querySelectorAll('.validation-icon');
    validationIcons.forEach(iconContainer => {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                // Check if new nodes were added and if feather needs to be called
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Check if the added node is an <i> tag (likely a feather icon)
                    let needsFeather = false;
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeName === 'I' && node.dataset.feather) {
                            needsFeather = true;
                        }
                    });
                    if (needsFeather && typeof feather !== 'undefined') {
                        try {
                            feather.replace();
                            iconContainer.classList.add('active'); // Show icon container
                        } catch (e) { console.warn("Feather replace error in observer:", e); }
                    }
                } else if (mutation.type === 'childList' && mutation.removedNodes.length > 0 && iconContainer.innerHTML.trim() === '') {
                    iconContainer.classList.remove('active'); // Hide if empty
                }
            });
        });
        observer.observe(iconContainer, { childList: true, subtree: true });
    });


    // Get priceId from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const priceIdFromUrl = urlParams.get('priceId');

    if (!priceIdFromUrl || !priceIdFromUrl.startsWith('price_')) {
        console.error('Error: Invalid or missing priceId in URL.');
        document.body.innerHTML = `<div class="text-center text-red-500 p-10"><h2 class="text-xl font-semibold mb-4">Checkout Error</h2><p class="mb-4">A valid product selection is required to proceed. Please ensure you've followed a correct link.</p><p><a href="/" class="text-blue-600 hover:underline font-medium">Return to homepage</a></p></div>`;
        trackEvent('checkout_load_error', { error_type: 'missing_or_invalid_price_id' });
        return; // Stop further execution
    }
    collectedData.priceId = priceIdFromUrl; // Store priceId globally
    console.log(`Using Price ID from URL: ${collectedData.priceId}`);

    try {
        console.log("Fetching backend configuration for Stripe publishable key...");
        const configResponse = await fetch(`${BACKEND_URL}/api/config`);
        if (!configResponse.ok) {
            throw new Error('Could not fetch server configuration for payment gateway.');
        }
        const { publishableKey } = await configResponse.json();
        if (!publishableKey) {
            throw new Error('Invalid configuration received from server (missing publishable key).');
        }
        stripe = Stripe(publishableKey); // Initialize Stripe.js
        console.log("Stripe.js initialized with publishable key.");

        // --- Initial UI Setup ---
        // Start at Step 1. The goToStep function handles making it visible.
        goToStep(1);
        console.log("Checkout form initialized, starting at Step 1.");

        // --- Initial Feather Icons Replacement ---
        // Call feather.replace() after a short delay to ensure DOM is ready and step content is potentially visible
        setTimeout(() => {
            if (typeof feather !== 'undefined') {
                try {
                    feather.replace();
                    console.log("Initial global feather.replace() called.");
                } catch (e) { console.warn("Initial Feather replace error:", e); }
            } else { console.warn("Feather icons library not loaded for initial replace."); }
        }, 150); // Adjusted delay, ensure it's after step content might become visible

        // --- Load Order Summary data asynchronously ---
        priceDetails = await fetchPriceDetails(collectedData.priceId); // fetchPriceDetails includes its own loading indicators
        updateOrderSummary(); // Update summary UI (this might add more feather icons if features list is populated)

        // --- Final Feather Icons Replacement ---
        // Call feather.replace() again to catch any icons added by updateOrderSummary or other dynamic content
        // This is a fallback; ideally, components adding icons should call feather.replace() themselves.
        if (typeof feather !== 'undefined') {
            setTimeout(() => { // Add a small delay to ensure DOM updates from updateOrderSummary are complete
                try {
                    feather.replace();
                    console.log("Final global feather.replace() called after summary update.");
                } catch (e) { console.warn("Final Feather replace error after summary:", e); }
            }, 200);
        }

        // Setup support chat button
        const supportChatButton = document.querySelector('.support-chat-button');
        if (supportChatButton) {
            supportChatButton.addEventListener('click', function() {
                showToast("Our support team is here to help! Chat will open shortly.", "info", 4000);
                // Example: window.open('https://your-chat-provider.com/chat', '_blank');
            });
        }

    } catch (error) {
        console.error("Fatal initialization error:", error);
        document.body.innerHTML = `<div class="text-center text-red-600 p-10"><h2 class="text-xl font-semibold mb-4">Checkout Initialization Error</h2><p class="mb-4">There was a problem loading the checkout page: ${error.message || 'Please try refreshing the page or contact support if the issue persists.'}</p><p><a href="/" class="text-blue-600 hover:underline font-medium">Return to homepage</a></p></div>`;
        trackEvent('checkout_initialization_error', { error_message: error.message });
    }
});
// --- END Initial Page Load Logic ---
