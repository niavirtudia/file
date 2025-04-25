class SilktideCookieBanner {
  constructor(config) {
    this.config = config; // Save config to the instance

    this.wrapper = null;
    this.banner = null;
    this.modal = null;
    this.cookieIcon = null;
    this.backdrop = null;

    this.createWrapper();

    if (this.shouldShowBackdrop()) {
      this.createBackdrop();
    }

    this.createCookieIcon();
    this.createModal();

    if (this.shouldShowBanner()) {
      this.createBanner();
      this.showBackdrop();
    } else {
      this.showCookieIcon();
    }

    this.setupEventListeners();

    if (this.hasSetInitialCookieChoices()) {
      this.loadRequiredCookies();
      this.runAcceptedCookieCallbacks();
    }
  }

  destroyCookieBanner() {
    // Remove all cookie banner elements from the DOM
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }

    // Restore scrolling
    this.allowBodyScroll();

    // Clear all references
    this.wrapper = null;
    this.banner = null;
    this.modal = null;
    this.cookieIcon = null;
    this.backdrop = null;
  }

  // ----------------------------------------------------------------
  // Wrapper
  // ----------------------------------------------------------------
  createWrapper() {
    this.wrapper = document.createElement('div');
    this.wrapper.id = 'consentWrap';
    document.body.insertBefore(this.wrapper, document.body.firstChild);
  }

  // ----------------------------------------------------------------
  // Wrapper Child Generator
  // ----------------------------------------------------------------
  createWrapperChild(htmlContent, id) {
    // Create child element
    const child = document.createElement('div');
    child.id = id;
    child.innerHTML = htmlContent;

    // Ensure wrapper exists
    if (!this.wrapper || !document.body.contains(this.wrapper)) {
      this.createWrapper();
    }

    // Append child to wrapper
    this.wrapper.appendChild(child);
    return child;
  }

  // ----------------------------------------------------------------
  // Backdrop
  // ----------------------------------------------------------------
  createBackdrop() {
    this.backdrop = this.createWrapperChild(null, 'cBackdrop');
  }

  showBackdrop() {
    if (this.backdrop) {
      this.backdrop.style.display = 'block';
    }
    // Trigger optional onBackdropOpen callback
    if (typeof this.config.onBackdropOpen === 'function') {
      this.config.onBackdropOpen();
    }
  }

  hideBackdrop() {
    if (this.backdrop) {
      this.backdrop.style.display = 'none';
    }

    // Trigger optional onBackdropClose callback
    if (typeof this.config.onBackdropClose === 'function') {
      this.config.onBackdropClose();
    }
  }

  shouldShowBackdrop() {
    return this.config?.background?.showBackground || false;
  }

  // update the checkboxes in the modal with the values from localStorage
  updateCheckboxState(saveToStorage = false) {
    const preferencesSection = this.modal.querySelector('#cookie-preferences');
    const checkboxes = preferencesSection.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach((checkbox) => {
      const [, cookieId] = checkbox.id.split('cookies-');
      const cookieType = this.config.cookieTypes.find(type => type.id === cookieId);
      
      if (!cookieType) return;

      if (saveToStorage) {
        // Save the current state to localStorage and run callbacks
        const currentState = checkbox.checked;
        
        if (cookieType.required) {
          localStorage.setItem(
            `silktideCookieChoice_${cookieId}${this.getBannerSuffix()}`,
            'true'
          );
        } else {
          localStorage.setItem(
            `silktideCookieChoice_${cookieId}${this.getBannerSuffix()}`,
            currentState.toString()
          );
          
          // Run appropriate callback
          if (currentState && typeof cookieType.onAccept === 'function') {
            cookieType.onAccept();
          } else if (!currentState && typeof cookieType.onReject === 'function') {
            cookieType.onReject();
          }
        }
      } else {
        // When reading values (opening modal)
        if (cookieType.required) {
          checkbox.checked = true;
          checkbox.disabled = true;
        } else {
          const storedValue = localStorage.getItem(
            `silktideCookieChoice_${cookieId}${this.getBannerSuffix()}`
          );
          
          if (storedValue !== null) {
            checkbox.checked = storedValue === 'true';
          } else {
            checkbox.checked = !!cookieType.defaultValue;
          }
        }
      }
    });
  }

  setInitialCookieChoiceMade() {
    window.localStorage.setItem(`silktideCookieBanner_InitialChoice${this.getBannerSuffix()}`, 1);
  }

  // ----------------------------------------------------------------
  // Consent Handling
  // ----------------------------------------------------------------
  handleCookieChoice(accepted) {
    // We set that an initial choice was made regardless of what it was so we don't show the banner again
    this.setInitialCookieChoiceMade();

    this.removeBanner();
    this.hideBackdrop();
    this.toggleModal(false);
    this.showCookieIcon();

    this.config.cookieTypes.forEach((type) => {
      // Set localStorage and run accept/reject callbacks
      if (type.required == true) {
        localStorage.setItem(`silktideCookieChoice_${type.id}${this.getBannerSuffix()}`, 'true');
        if (typeof type.onAccept === 'function') { type.onAccept() }
      } else {
        localStorage.setItem(
          `silktideCookieChoice_${type.id}${this.getBannerSuffix()}`,
          accepted.toString(),
        );

        if (accepted) {
          if (typeof type.onAccept === 'function') { type.onAccept(); }
        } else {
          if (typeof type.onReject === 'function') { type.onReject(); }
        }
      }
    });

    // Trigger optional onAcceptAll/onRejectAll callbacks
    if (accepted && typeof this.config.onAcceptAll === 'function') {
      if (typeof this.config.onAcceptAll === 'function') { this.config.onAcceptAll(); }
    } else if (typeof this.config.onRejectAll === 'function') {
      if (typeof this.config.onRejectAll === 'function') { this.config.onRejectAll(); }
    }

    // finally update the checkboxes in the modal with the values from localStorage
    this.updateCheckboxState();
  }

  getAcceptedCookies() {
    return (this.config.cookieTypes || []).reduce((acc, cookieType) => {
      acc[cookieType.id] =
        localStorage.getItem(`silktideCookieChoice_${cookieType.id}${this.getBannerSuffix()}`) ===
        'true';
      return acc;
    }, {});
  }

  runAcceptedCookieCallbacks() {
    if (!this.config.cookieTypes) return;

    const acceptedCookies = this.getAcceptedCookies();
    this.config.cookieTypes.forEach((type) => {
      if (type.required) return; // we run required cookies separately in loadRequiredCookies
      if (acceptedCookies[type.id] && typeof type.onAccept === 'function') {
        if (typeof type.onAccept === 'function') { type.onAccept(); }
      }
    });
  }

  runRejectedCookieCallbacks() {
    if (!this.config.cookieTypes) return;

    const rejectedCookies = this.getRejectedCookies();
    this.config.cookieTypes.forEach((type) => {
      if (rejectedCookies[type.id] && typeof type.onReject === 'function') {
        if (typeof type.onReject === 'function') { type.onReject(); }
      }
    });
  }

  /**
   * Run through all of the cookie callbacks based on the current localStorage values
   */
  runStoredCookiePreferenceCallbacks() {
    this.config.cookieTypes.forEach((type) => {
      const accepted =
        localStorage.getItem(`silktideCookieChoice_${type.id}${this.getBannerSuffix()}`) === 'true';
      // Set localStorage and run accept/reject callbacks
      if (accepted) {
        if (typeof type.onAccept === 'function') { type.onAccept(); }
      } else {
        if (typeof type.onReject === 'function') { type.onReject(); }
      }
    });
  }

  loadRequiredCookies() {
    if (!this.config.cookieTypes) return;
    this.config.cookieTypes.forEach((cookie) => {
      if (cookie.required && typeof cookie.onAccept === 'function') {
        if (typeof cookie.onAccept === 'function') { cookie.onAccept(); }
      }
    });
  }

  // ----------------------------------------------------------------
  // Banner
  // ----------------------------------------------------------------
  getBannerContent() {
	const bannerTitle =
	  this.config.text?.banner?.title || 'Privasi Anda penting bagi kami.';
	  
    const bannerDescription =
      this.config.text?.banner?.description ||
      `<p>Kami memproses informasi pribadi Anda untuk mengukur dan meningkatkan situs dan layanan kami, untuk membantu kampanye pemasaran kami, dan untuk menyediakan konten dan iklan yang dipersonalisasi. Untuk informasi lebih lanjut, lihat <a href='/p/privacy-policy.html' target='_blank'>Kebijakan Privasi</a> kami.</p>`;

    // Accept button
    const acceptAllButtonText = this.config.text?.banner?.acceptAllButtonText || 'Accept all';
    const acceptAllButtonLabel = this.config.text?.banner?.acceptAllButtonAccessibleLabel;
    const acceptAllButton = `<button class="accept-all stB stBPaccept"${
      acceptAllButtonLabel && acceptAllButtonLabel !== acceptAllButtonText 
        ? ` aria-label="${acceptAllButtonLabel}"` 
        : ''
    }>${acceptAllButtonText}</button>`;
    
    // Reject button
    const rejectNonEssentialButtonText = this.config.text?.banner?.rejectNonEssentialButtonText || 'Reject non-essential';
    const rejectNonEssentialButtonLabel = this.config.text?.banner?.rejectNonEssentialButtonAccessibleLabel;
    const rejectNonEssentialButton = `<button class="reject-all stB stBPreject"${
      rejectNonEssentialButtonLabel && rejectNonEssentialButtonLabel !== rejectNonEssentialButtonText 
        ? ` aria-label="${rejectNonEssentialButtonLabel}"` 
        : ''
    }>${rejectNonEssentialButtonText}</button>`;

    // Preferences button
	const preferencesButtonLabel = this.config.text?.banner?.preferencesButtonAccessibleLabel || 'Kelola Preferensi';
	const preferencesButton = `<button class="preferences"${preferencesButtonLabel ? ` aria-label="${
	   preferencesButtonLabel}"` : ''}><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000" aria-hidden="true"><path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z"/></svg></button>`;
    
    const bannerContent = `
      <div class="actCT">
	  <h2>${bannerTitle}</h2>
	  ${bannerDescription}
	  </div>
      <div class="actCC">
        <div class="actCC-setting">
          ${preferencesButton}
        </div>
        ${acceptAllButton}
        ${rejectNonEssentialButton}
      </div>
    `;

    return bannerContent;
  }

  hasSetInitialCookieChoices() {
    return !!localStorage.getItem(`silktideCookieBanner_InitialChoice${this.getBannerSuffix()}`);
  }

  createBanner() {
    // Create banner element
    this.banner = this.createWrapperChild(this.getBannerContent(), 'webCB');

    // Add positioning class from config
    if (this.banner && this.config.position?.banner) {
      this.banner.classList.add(this.config.position.banner);
    }

    // Trigger optional onBannerOpen callback
    if (this.banner && typeof this.config.onBannerOpen === 'function') {
      this.config.onBannerOpen();
    }
  }

  removeBanner() {
    if (this.banner && this.banner.parentNode) {
      this.banner.parentNode.removeChild(this.banner);
      this.banner = null;

      // Trigger optional onBannerClose callback
      if (typeof this.config.onBannerClose === 'function') {
        this.config.onBannerClose();
      }
    }
  }

  shouldShowBanner() {
    if (this.config.showBanner === false) {
      return false;
    }
    return (
      localStorage.getItem(`silktideCookieBanner_InitialChoice${this.getBannerSuffix()}`) === null
    );
  }

  // ----------------------------------------------------------------
  // Modal
  // ----------------------------------------------------------------
  getModalContent() {
  const preferencesTitle =
    this.config.text?.preferences?.title || 'Manage Consent Preferences';

  const preferencesDescription =
    this.config.text?.preferences?.description ||
    '<p>Kami menghormati hak privasi Anda. Anda dapat memilih untuk tidak mengizinkan beberapa jenis cookie. Preferensi cookie Anda akan berlaku di seluruh situs web kami.</p></p>';

  const preferencesButtonLabel = this.config.text?.banner?.preferencesButtonAccessibleLabel;

  const closeModalButton = `<button class="settingClose"${preferencesButtonLabel ? ` aria-label="${preferencesButtonLabel}"` : ''}>
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19.4081 3.41559C20.189 2.6347 20.189 1.36655 19.4081 0.585663C18.6272 -0.195221 17.3591 -0.195221 16.5782 0.585663L10 7.17008L3.41559 0.59191C2.6347 -0.188974 1.36655 -0.188974 0.585663 0.59191C-0.195221 1.37279 -0.195221 2.64095 0.585663 3.42183L7.17008 10L0.59191 16.5844C-0.188974 17.3653 -0.188974 18.6335 0.59191 19.4143C1.37279 20.1952 2.64095 20.1952 3.42183 19.4143L10 12.8299L16.5844 19.4081C17.3653 20.189 18.6335 20.189 19.4143 19.4081C20.1952 18.6272 20.1952 17.3591 19.4143 16.5782L12.8299 10L19.4081 3.41559Z"/>
    </svg>
  </button>`;

  const cookieTypes = this.config.cookieTypes || [];
  const acceptedCookieMap = this.getAcceptedCookies();

  const acceptAllButtonText = this.config.text?.banner?.acceptAllButtonText || 'Accept all';
  const acceptAllButtonLabel = this.config.text?.banner?.acceptAllButtonAccessibleLabel;
  const acceptAllButton = `<button class="preferences-accept-all stB stBPaccept"${
    acceptAllButtonLabel && acceptAllButtonLabel !== acceptAllButtonText 
      ? ` aria-label="${acceptAllButtonLabel}"` 
      : ''
  }>${acceptAllButtonText}</button>`;

  const rejectNonEssentialButtonText = this.config.text?.banner?.rejectNonEssentialButtonText || 'Reject non-essential';
  const rejectNonEssentialButtonLabel = this.config.text?.banner?.rejectNonEssentialButtonAccessibleLabel;
  const rejectNonEssentialButton = `<button class="preferences-reject-all stB stBPreject"${
    rejectNonEssentialButtonLabel && rejectNonEssentialButtonLabel !== rejectNonEssentialButtonText 
      ? ` aria-label="${rejectNonEssentialButtonLabel}"` 
      : ''
  }>${rejectNonEssentialButtonText}</button>`;

  // ✅ Tambahkan tombol "Save preferences"
  const savePreferencesText = 'Save preferences';
  const savePreferencesButton = `<button class="preferences-save stB stBPsave">${savePreferencesText}</button>`;

  const modalContent = `
    <header>
      <h1>${preferencesTitle}</h1>                    
      ${closeModalButton}
    </header>
    ${preferencesDescription}
    <section id="cookie-preferences">
      ${cookieTypes.map((type) => {
        const accepted = acceptedCookieMap[type.id];
        let isChecked = false;

        if (accepted) isChecked = true;
        if (!accepted && !this.hasSetInitialCookieChoices()) isChecked = type.defaultValue;

        return `
          <fieldset>
            <legend>${type.name}</legend>
            <div class="cookie-type-content">
              <div class="cookie-type-description">${type.description}</div>
              <label class="switch" for="cookies-${type.id}">
                <input type="checkbox" id="cookies-${type.id}" ${
                  type.required ? 'checked disabled' : isChecked ? 'checked' : ''
                } />
                <span class="switch__pill" aria-hidden="true"></span>
                <span class="switch__dot" aria-hidden="true"></span>
                <span class="switch__off" aria-hidden="true">Off</span>
                <span class="switch__on" aria-hidden="true">On</span>
              </label>
            </div>
          </fieldset>
        `;
      }).join('')}
    </section>
    <footer>
      ${acceptAllButton}
      ${rejectNonEssentialButton}
      ${savePreferencesButton} 
    </footer>
  `;

  return modalContent;
}


  createModal() {
    // Create banner element
    this.modal = this.createWrapperChild(this.getModalContent(), 'consentSetting');
  }

  toggleModal(show) {
    if (!this.modal) return;

    this.modal.style.display = show ? 'flex' : 'none';

    if (show) {
      this.showBackdrop();
      this.hideCookieIcon();
      this.removeBanner();
      this.preventBodyScroll();

      // Focus the close button
      const modalCloseButton = this.modal.querySelector('.settingClose');
      modalCloseButton.focus();

      // Trigger optional onPreferencesOpen callback
      if (typeof this.config.onPreferencesOpen === 'function') {
        this.config.onPreferencesOpen();
      }

      this.updateCheckboxState(false); // read from storage when opening
    } else {
      // Set that an initial choice was made when closing the modal
      this.setInitialCookieChoiceMade();
      
      // Save current checkbox states to storage
      this.updateCheckboxState(true);

      this.hideBackdrop();
      this.showCookieIcon();
      this.allowBodyScroll();

      // Trigger optional onPreferencesClose callback
      if (typeof this.config.onPreferencesClose === 'function') {
        this.config.onPreferencesClose();
      }
    }
  }

  // ----------------------------------------------------------------
  // Cookie Icon
  // ----------------------------------------------------------------
  getCookieIconContent() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="none"><path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z"/></svg>
    `;
  }

  createCookieIcon() {
    this.cookieIcon = document.createElement('button');
    this.cookieIcon.id = 'cookieSetting';
    this.cookieIcon.innerHTML = this.getCookieIconContent();

    if (this.config.text?.banner?.preferencesButtonAccessibleLabel) {
      this.cookieIcon.ariaLabel = this.config.text?.banner?.preferencesButtonAccessibleLabel;
    }

    // Ensure wrapper exists
    if (!this.wrapper || !document.body.contains(this.wrapper)) {
      this.createWrapper();
    }

    // Append child to wrapper
    this.wrapper.appendChild(this.cookieIcon);

    // Add positioning class from config
    if (this.cookieIcon && this.config.cookieIcon?.position) {
      this.cookieIcon.classList.add(this.config.cookieIcon.position);
    }

    // Add color scheme class from config
    if (this.cookieIcon && this.config.cookieIcon?.colorScheme) {
      this.cookieIcon.classList.add(this.config.cookieIcon.colorScheme);
    }
  }

  showCookieIcon() {
    if (this.cookieIcon) {
      this.cookieIcon.style.display = 'none';
    }
  }

  hideCookieIcon() {
    if (this.cookieIcon) {
      this.cookieIcon.style.display = 'none';
    }
  }

  /**
   * This runs if the user closes the modal without making a choice for the first time
   * We apply the default values and the necessary values as default
   */
  handleClosedWithNoChoice() {
    this.config.cookieTypes.forEach((type) => {
      let accepted = true;
      // Set localStorage and run accept/reject callbacks
      if (type.required == true) {
        localStorage.setItem(
          `silktideCookieChoice_${type.id}${this.getBannerSuffix()}`,
          accepted.toString(),
        );
      } else if (type.defaultValue) {
        localStorage.setItem(
          `silktideCookieChoice_${type.id}${this.getBannerSuffix()}`,
          accepted.toString(),
        );
      } else {
        accepted = false;
        localStorage.setItem(
          `silktideCookieChoice_${type.id}${this.getBannerSuffix()}`,
          accepted.toString(),
        );
      }

      if (accepted) {
        if (typeof type.onAccept === 'function') { type.onAccept(); }
      } else {
        if (typeof type.onReject === 'function') { type.onReject(); }
      }
      // set the flag to say that the cookie choice has been made
      this.setInitialCookieChoiceMade();
      this.updateCheckboxState();
    });
  }

  // ----------------------------------------------------------------
  // Focusable Elements
  // ----------------------------------------------------------------
  getFocusableElements(element) {
    return element.querySelectorAll(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
  }

  // ----------------------------------------------------------------
  // Event Listeners
  // ----------------------------------------------------------------
setupEventListeners() {
  if (this.banner) {
    this.setupBannerEventListeners();
  }

  if (this.modal) {
    this.setupModalEventListeners();
  }

  if (this.cookieIcon) {
    this.setupCookieIconEventListener();
  }
}

setupBannerEventListeners() {
  const acceptButton = this.banner.querySelector('.accept-all');
  const rejectButton = this.banner.querySelector('.reject-all');
  const preferencesButton = this.banner.querySelector('.preferences');

  acceptButton?.addEventListener('click', () => {
    this.handleCookieChoice(true);
    if (typeof this.config.onClickAccept === 'function') {
      this.config.onClickAccept();
    }
  });

  rejectButton?.addEventListener('click', () => {
    this.handleCookieChoice(false);
    if (typeof this.config.onClickReject === 'function') {
      this.config.onClickReject();
    }
  });

  preferencesButton?.addEventListener('click', () => {
    this.showBackdrop();
    this.toggleModal(true);
    if (typeof this.config.onClickPreferences === 'function') {
      this.config.onClickPreferences();
    }
  });

  // Focus Trap
  const focusableElements = this.getFocusableElements(this.banner);
  const firstFocusableEl = focusableElements[0];
  const lastFocusableEl = focusableElements[focusableElements.length - 1];

  this.banner.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstFocusableEl) {
        lastFocusableEl.focus();
        e.preventDefault();
      } else if (document.activeElement === lastFocusableEl) {
        firstFocusableEl.focus();
        e.preventDefault();
      }
    }
  });

  if (this.config.mode !== 'wizard') {
    acceptButton?.focus();
  }
}

setupModalEventListeners() {
  const closeButton = this.modal.querySelector('.settingClose');
  const acceptAllButton = this.modal.querySelector('.preferences-accept-all');
  const rejectAllButton = this.modal.querySelector('.preferences-reject-all');
  const savePreferencesButton = this.modal.querySelector('.preferences-save');

  closeButton?.addEventListener('click', () => {
    this.toggleModal(false);
    const hasMadeFirstChoice = this.hasSetInitialCookieChoices();

    if (hasMadeFirstChoice) {
      this.runStoredCookiePreferenceCallbacks();
    } else {
      this.handleClosedWithNoChoice();
    }
  });

  acceptAllButton?.addEventListener('click', () => this.handleCookieChoice(true));
  rejectAllButton?.addEventListener('click', () => this.handleCookieChoice(false));

  savePreferencesButton?.addEventListener('click', () => {
    const newChoices = {};

    this.config.cookieTypes.forEach((type) => {
      const checkbox = document.getElementById(`cookies-${type.id}`);
      newChoices[type.id] = type.required ? true : checkbox?.checked || false;

      localStorage.setItem(
        `silktideCookieChoice_${type.id}${this.getBannerSuffix()}`,
        newChoices[type.id].toString()
      );
    });

    if (typeof this.saveConsentChoices === 'function') {
      this.saveConsentChoices(newChoices);
    }

    if (typeof this.applyConsentChoices === 'function') {
      this.applyConsentChoices(newChoices);
    }

    this.toggleModal(false);
  });

  // Update checkbox listener per preferensi
  const preferencesSection = this.modal.querySelector('#cookie-preferences');
  const checkboxes = preferencesSection.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (event) => {
      const [, cookieId] = event.target.id.split('cookies-');
      const isAccepted = event.target.checked;
      const previousValue = localStorage.getItem(
        `silktideCookieChoice_${cookieId}${this.getBannerSuffix()}`
      ) === 'true';

      if (isAccepted !== previousValue) {
        const cookieType = this.config.cookieTypes.find(type => type.id === cookieId);
        if (cookieType) {
          localStorage.setItem(
            `silktideCookieChoice_${cookieId}${this.getBannerSuffix()}`,
            isAccepted.toString()
          );

          if (isAccepted && typeof cookieType.onAccept === 'function') {
            cookieType.onAccept();
          } else if (!isAccepted && typeof cookieType.onReject === 'function') {
            cookieType.onReject();
          }
        }
      }
    });
  });

  this.setupFocusTrap(this.modal, closeButton);
}

setupCookieIconEventListener() {
  this.cookieIcon.addEventListener('click', () => {
    if (!this.modal) {
      this.createModal();
      this.toggleModal(true);
      this.hideCookieIcon();
    } else if (this.modal.style.display === 'none' || this.modal.style.display === '') {
      this.toggleModal(true);
      this.hideCookieIcon();
    } else {
      this.toggleModal(false);
    }
  });
}

setupFocusTrap(container, initialFocusElement) {
  const focusableElements = this.getFocusableElements(container);
  const firstFocusableEl = focusableElements[0];
  const lastFocusableEl = focusableElements[focusableElements.length - 1];

  container.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstFocusableEl) {
          lastFocusableEl.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastFocusableEl) {
          firstFocusableEl.focus();
          e.preventDefault();
        }
      }
    }

    if (e.key === 'Escape' && container === this.modal) {
      this.toggleModal(false);
    }
  });

  initialFocusElement?.focus();
}


  getBannerSuffix() {
    if (this.config.bannerSuffix) {
      return '_' + this.config.bannerSuffix;
    }
    return '';
  }

  preventBodyScroll() {
    document.body.style.overflow = 'hidden';
    // Prevent iOS Safari scrolling
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
  }

  allowBodyScroll() {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
  }
}



(function () {
  window.silktideCookieBannerManager = {};

  let config = {};
  let cookieBanner;

  function updateCookieBannerConfig(userConfig = {}) {
    config = { ...config, ...userConfig };

    // If cookie banner exists, destroy and recreate it with new config
    if (cookieBanner) {
      if (typeof cookieBanner.destroyCookieBanner === 'function') {
        cookieBanner.destroyCookieBanner();
      }
      cookieBanner = null;
    }

    // Only initialize if document.body exists
    if (document.body) {
      initCookieBanner();
    } else {
      document.addEventListener('DOMContentLoaded', initCookieBanner, { once: true });
    }
  }

  function initCookieBanner() {
    if (!cookieBanner) {
      cookieBanner = new SilktideCookieBanner(config);

      // Jalankan callback setelah persetujuan diberikan, jika disediakan
      if (typeof config.onConsentGiven === 'function') {
        const observer = new MutationObserver(() => {
          const consentKeys = [
            'silktideCookieChoice_analytics',
            'silktideCookieChoice_marketing',
            'silktideCookieChoice_necessary',
            'silktideCookieChoice_functionality'
          ];
          const hasConsent = consentKeys.some(k => localStorage.getItem(k) !== null);
          if (hasConsent) {
            config.onConsentGiven();
            observer.disconnect();
          }
        });

        // Mulai mengamati DOM untuk mendeteksi saat consent tersimpan
        observer.observe(document, { subtree: true, childList: true });
      }
    }
  }

  function injectScript(url, loadOption) {
    const existingScript = document.querySelector(`script[src="${url}"]`);
    if (existingScript) return;

    const script = document.createElement('script');
    script.src = url;

    if (loadOption === 'async') {
      script.async = true;
    } else if (loadOption === 'defer') {
      script.defer = true;
    }

    document.head.appendChild(script);
  }

  // Ekspor fungsi ke global
  window.silktideCookieBannerManager.initCookieBanner = initCookieBanner;
  window.silktideCookieBannerManager.updateCookieBannerConfig = updateCookieBannerConfig;
  window.silktideCookieBannerManager.injectScript = injectScript;

  // Inisialisasi awal saat dokumen siap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieBanner, { once: true });
  } else {
    initCookieBanner();
  }
})();

// === Injected: saveConsentChoices and applyConsentChoices ===
function saveConsentChoices(choices) {
  Object.entries(choices).forEach(([key, value]) => {
    localStorage.setItem(`silktideCookieChoice_${key}`, value.toString());
  });

	dataLayer.push({
	  event: 'mConsentUpdated',
	  consent_necessary: true, // bisa selalu true kalau required
	  consent_analytical: choices.analytical === true,
	  consent_advertising: choices.advertising === true
	});


  if (window.gtag) {
    gtag('consent', 'update', {
      analytics_storage: choices.analytical ? 'granted' : 'denied',
      ad_storage: choices.advertising ? 'granted' : 'denied',
      ad_user_data: choices.advertising ? 'granted' : 'denied',
      ad_personalization: choices.advertising ? 'granted' : 'denied'
    });
  }
}

function applyConsentChoices(choices) {
  const cookieTypes = window.silktideCookieBannerManager?.config?.cookieTypes || [];

  cookieTypes.forEach(type => {
    const accepted = choices[type.id];

    if (accepted && typeof type.onAccept === 'function') {
      type.onAccept();
    } else if (!accepted && typeof type.onReject === 'function') {
      type.onReject();
    }
  });
}
// === End Injected Functions ===
