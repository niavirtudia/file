class MCB {
  constructor(config) {
    this.config = {
      cookieTypes: [],
      ...config,
    };
    if (!Array.isArray(this.config.cookieTypes)) {
      console.warn('config.cookieTypes bukan array, menggunakan array kosong sebagai default');
      this.config.cookieTypes = [];
    }
    this.wrapper = null;
    this.banner = null;
    this.modal = null;
    this.cookieIcon = null;
    this.backdrop = null;
    this.randomSuffix = null;
    this.modalEventListeners = null;
    this.bannerEventListeners = null;
    this.cookieIconEventListener = null;

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

  /**
   * Menangani pilihan persetujuan cookie pengguna (menerima atau menolak semua cookie non-wajib).
   * Menyimpan pilihan ke localStorage dan menjalankan callback yang sesuai.
   * @param {boolean} accepted True jika pengguna menerima semua cookie, false jika menolak non-wajib.
   * @returns {void}
   */
  handleCookieChoice(accepted) {
    this.setInitialCookieChoiceMade();

    this.removeBanner();
    this.hideBackdrop();
    this.toggleModal(false);
    this.showCookieIcon();

    const choices = {};
    this.config.cookieTypes.forEach((type) => {
      const isAccepted = type.required ? true : accepted;
      choices[type.id] = isAccepted;
      localStorage.setItem(
        `mcc_${type.id}${this.getBannerSuffix()}`,
        isAccepted.toString()
      );

      if (isAccepted && typeof type.onAccept === 'function') {
        try {
          type.onAccept();
        } catch (e) {
          console.warn(`Error menjalankan onAccept untuk ${type.id}:`, e);
        }
      } else if (!isAccepted && typeof type.onReject === 'function') {
        try {
          type.onReject();
        } catch (e) {
          console.warn(`Error menjalankan onReject untuk ${type.id}:`, e);
        }
      }
    });

    if (accepted && typeof this.config.onAcceptAll === 'function') {
      this.config.onAcceptAll();
    } else if (!accepted && typeof this.config.onRejectAll === 'function') {
      this.config.onRejectAll();
    }

    if (typeof this.config.saveConsentChoices === 'function') {
      try {
        this.config.saveConsentChoices(choices);
      } catch (e) {
        console.warn('Error menjalankan saveConsentChoices:', e);
      }
    }

    if (typeof this.config.applyConsentChoices === 'function') {
      try {
        this.config.applyConsentChoices(choices);
      } catch (e) {
        console.warn('Error menjalankan applyConsentChoices:', e);
      }
    }

    if (accepted && typeof this.config.onConsentGiven === 'function') {
      this.config.onConsentGiven();
    } else if (!accepted && typeof this.config.onConsentRejected === 'function') {
      this.config.onConsentRejected();
    }

    this.updateCheckboxState();
    console.debug('Pilihan cookie disimpan:', choices);
  }

  /**
   * Membuat banner cookie dengan konten yang ditentukan dalam konfigurasi.
   * @returns {void}
   */
  createBanner() {
    this.banner = this.createWrapperChild(this.getBannerContent(), 'mB');

    if (this.banner && this.config.position?.banner) {
      const validPositions = ['bottomLeft'];
      if (validPositions.includes(this.config.position.banner)) {
        this.banner.classList.add(this.config.position.banner);
      } else {
        console.warn(`Posisi banner tidak valid: ${this.config.position.banner}. Menggunakan default.`);
        this.banner.classList.add('bottomLeft');
      }
    }

    if (this.banner && typeof this.config.onBannerOpen === 'function') {
      this.config.onBannerOpen();
    }
  }

  // Fungsi lainnya tetap sama seperti versi sebelumnya
  createWrapper() {
    this.wrapper = document.createElement('div');
    this.wrapper.id = 'mccW';
    document.body.insertBefore(this.wrapper, document.body.firstChild);
  }

  updateCheckboxState(saveToStorage = false) {
    const preferencesSection = this.modal.querySelector('#cookie-preferences');
    const checkboxes = preferencesSection.querySelectorAll('input[type="checkbox"]');

    const cookieTypeMap = new Map(this.config.cookieTypes.map(type => [type.id, type]));

    checkboxes.forEach((checkbox) => {
      const [, cookieId] = checkbox.id.split(`cookies-`)[1].split(`-${this.randomSuffix}`);
      const cookieType = cookieTypeMap.get(cookieId);
      
      if (!cookieType) {
        console.warn(`Cookie type ${cookieId} tidak ditemukan`);
        return;
      }

      if (saveToStorage) {
        const currentState = checkbox.checked;
        
        if (cookieType.required) {
          localStorage.setItem(
            `mcc_${cookieId}${this.getBannerSuffix()}`,
            'true'
          );
        } else {
          localStorage.setItem(
            `mcc_${cookieId}${this.getBannerSuffix()}`,
            currentState.toString()
          );
          
          if (currentState && typeof cookieType.onAccept === 'function') {
            try {
              cookieType.onAccept();
            } catch (e) {
              console.warn(`Error menjalankan onAccept untuk ${cookieId}:`, e);
            }
          } else if (!currentState && typeof cookieType.onReject === 'function') {
            try {
              cookieType.onReject();
            } catch (e) {
              console.warn(`Error menjalankan onReject untuk ${cookieId}:`, e);
            }
          }
        }
      } else {
        if (cookieType.required) {
          checkbox.checked = true;
          checkbox.disabled = true;
        } else {
          const storedValue = localStorage.getItem(
            `mcc_${cookieId}${this.getBannerSuffix()}`
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

  getModalContent() {
    const preferencesTitle =
      this.config.text?.preferences?.title || 'Manage Consent Preferences';

    const preferencesDescription =
      this.config.text?.preferences?.description ||
      '<p>Kami menghormati hak privasi Anda. Anda dapat memilih untuk tidak mengizinkan beberapa jenis cookie. Preferensi cookie Anda akan berlaku di seluruh situs web kami.</p>';

    const closeModalButton = `<button class="modal-close" aria-label="Close Preferences Modal">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.4081 3.41559C20.189 2.6347 20.189 1.36655 19.4081 0.585663C18.6272 -0.195221 17.3591 -0.195221 16.5782 0.585663L10 7.17008L3.41559 0.59191C2.6347 -0.188974 1.36655 -0.188974 0.585663 0.59191C-0.195221 1.37279 -0.195221 2.64095 0.585663 3.42183L7.17008 10L0.59191 16.5844C-0.188974 17.3653 -0.188974 18.6335 0.59191 19.4143C1.37279 20.1952 2.64095 20.1952 3.42183 19.4143L10 12.8299L16.5844 19.4081C17.3653 20.189 18.6335 20.189 19.4143 19.4081C20.1952 18.6272 20.1952 17.3591 19.4143 16.5782L12.8299 10L19.4081 3.41559Z"/>
      </svg>
    </button>`;

    const cookieTypes = this.config.cookieTypes || [];
    const acceptedCookieMap = this.getAcceptedCookies();

    const acceptAllButtonText = this.config.text?.banner?.acceptAllButtonText || 'Terima';
    const acceptAllButtonLabel = this.config.text?.banner?.acceptAllButtonAccessibleLabel;
    const acceptAllButton = `<button class="accept-all st-button st-button--primary"${
      acceptAllButtonLabel && acceptAllButtonLabel !== acceptAllButtonText 
        ? ` aria-label="${acceptAllButtonLabel}"` 
        : ''
    }>${acceptAllButtonText}</button>`;

    const rejectNonEssentialButtonText = this.config.text?.banner?.rejectNonEssentialButtonText || 'Tolak';
    const rejectNonEssentialButtonLabel = this.config.text?.banner?.rejectNonEssentialButtonLabel;
    const rejectNonEssentialButton = `<button class="reject-all st-button st-button--secondary"${
      rejectNonEssentialButtonLabel && rejectNonEssentialButtonLabel !== rejectNonEssentialButtonText 
        ? ` aria-label="${rejectNonEssentialButtonLabel}"` 
        : ''
    }>${rejectNonEssentialButtonText}</button>`;

    const savePreferencesText = 'Simpan preferensi';
    const savePreferencesButton = `<button class="save-preferences st-button st-button--secondary">${savePreferencesText}</button>`;

    this.randomSuffix = Math.random().toString(36).substr(2, 6);

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
                <label class="switch" for="cookies-${type.id}-${this.randomSuffix}">
                  <input type="checkbox" id="cookies-${type.id}-${this.randomSuffix}" ${
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

  setupModalEventListeners() {
    const closeButton = this.modal.querySelector('.modal-close');
    const acceptAllButton = this.modal.querySelector('.accept-all');
    const rejectAllButton = this.modal.querySelector('.reject-all');
    const savePreferencesButton = this.modal.querySelector('.save-preferences');

    this.modalEventListeners = [];

    const addListener = (element, event, handler) => {
      if (element) {
        element.addEventListener(event, handler);
        this.modalEventListeners.push({ element, event, handler });
      }
    };

    addListener(closeButton, 'click', () => {
      this.toggleModal(false);
      const hasMadeFirstChoice = this.hasSetInitialCookieChoices();

      if (hasMadeFirstChoice) {
        this.runStoredCookiePreferenceCallbacks();
      } else {
        this.handleClosedWithNoChoice();
      }
    });

    addListener(acceptAllButton, 'click', () => this.handleCookieChoice(true));
    addListener(rejectAllButton, 'click', () => this.handleCookieChoice(false));

    addListener(savePreferencesButton, 'click', () => {
      const newChoices = {};

      this.config.cookieTypes.forEach((type) => {
        const checkbox = document.getElementById(`cookies-${type.id}-${this.randomSuffix}`);
        if (!checkbox) {
          console.warn(`Checkbox untuk cookie ${type.id} tidak ditemukan`);
          return;
        }
        newChoices[type.id] = type.required ? true : checkbox.checked;

        localStorage.setItem(
          `mcc_${type.id}${this.getBannerSuffix()}`,
          newChoices[type.id].toString()
        );
      });

      if (typeof this.config.saveConsentChoices === 'function') {
        try {
          this.config.saveConsentChoices(newChoices);
        } catch (e) {
          console.warn('Error menjalankan saveConsentChoices:', e);
        }
      }

      if (typeof this.config.applyConsentChoices === 'function') {
        try {
          this.config.applyConsentChoices(newChoices);
        } catch (e) {
          console.warn('Error menjalankan applyConsentChoices:', e);
        }
      }

      this.toggleModal(false);
      console.debug('Preferensi disimpan dari modal:', newChoices);
    });

    const preferencesSection = this.modal.querySelector('#cookie-preferences');
    const checkboxes = preferencesSection.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      const handler = (event) => {
        const [, cookieId] = event.target.id.split(`cookies-`)[1].split(`-${this.randomSuffix}`);
        const isAccepted = event.target.checked;
        const previousValue = localStorage.getItem(
          `mcc_${cookieId}${this.getBannerSuffix()}`
        ) === 'true';

        if (isAccepted !== previousValue) {
          const cookieType = this.config.cookieTypes.find(type => type.id === cookieId);
          if (cookieType) {
            localStorage.setItem(
              `mcc_${cookieId}${this.getBannerSuffix()}`,
              isAccepted.toString()
            );

            if (isAccepted && typeof cookieType.onAccept === 'function') {
              try {
                cookieType.onAccept();
              } catch (e) {
                console.warn(`Error menjalankan onAccept untuk ${cookieId}:`, e);
              }
            } else if (!isAccepted && typeof cookieType.onReject === 'function') {
              try {
                cookieType.onReject();
              } catch (e) {
                console.warn(`Error menjalankan onReject untuk ${cookieId}:`, e);
              }
            }
          }
        }
      };
      checkbox.addEventListener('change', handler);
      this.modalEventListeners.push({ element: checkbox, event: 'change', handler });
    });

    this.setupFocusTrap(this.modal, closeButton);
  }

  destroyCookieBanner() {
    if (this.modalEventListeners) {
      this.modalEventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
      this.modalEventListeners = null;
    }

    if (this.bannerEventListeners) {
      this.bannerEventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
      this.bannerEventListeners = null;
    }

    if (this.cookieIconEventListener) {
      this.cookieIcon.removeEventListener('click', this.cookieIconEventListener);
      this.cookieIconEventListener = null;
    }

    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }

    this.allowBodyScroll();

    this.wrapper = null;
    this.banner = null;
    this.modal = null;
    this.cookieIcon = null;
    this.backdrop = null;
    this.randomSuffix = null;
  }

  createWrapperChild(htmlContent, id) {
    const child = document.createElement('div');
    child.id = id;
    child.innerHTML = htmlContent;

    if (!this.wrapper || !document.body.contains(this.wrapper)) {
      this.createWrapper();
    }

    this.wrapper.appendChild(child);
    return child;
  }

  createBackdrop() {
    this.backdrop = this.createWrapperChild(null, 'mBD');
  }

  showBackdrop() {
    if (this.backdrop) {
      this.backdrop.style.display = 'block';
    }
    if (typeof this.config.onBackdropOpen === 'function') {
      this.config.onBackdropOpen();
    }
  }

  hideBackdrop() {
    if (this.backdrop) {
      this.backdrop.style.display = 'none';
    }
    if (typeof this.config.onBackdropClose === 'function') {
      this.config.onBackdropClose();
    }
  }

  shouldShowBackdrop() {
    return this.config?.background?.showBackground || false;
  }

  setInitialCookieChoiceMade() {
    window.localStorage.setItem(`MCB_IC${this.getBannerSuffix()}`, 1);
  }

  getAcceptedCookies() {
    return (this.config.cookieTypes || []).reduce((acc, cookieType) => {
      acc[cookieType.id] =
        localStorage.getItem(`mcc_${cookieType.id}${this.getBannerSuffix()}`) ===
        'true';
      return acc;
    }, {});
  }

  runAcceptedCookieCallbacks() {
    if (!this.config.cookieTypes) return;

    const acceptedCookies = this.getAcceptedCookies();
    this.config.cookieTypes.forEach((type) => {
      if (type.required) return;
      if (acceptedCookies[type.id] && typeof type.onAccept === 'function') {
        try {
          type.onAccept();
        } catch (e) {
          console.warn(`Error menjalankan onAccept untuk ${type.id}:`, e);
        }
      }
    });
  }

  runRejectedCookieCallbacks() {
    if (!this.config.cookieTypes) return;

    const rejectedCookies = this.getRejectedCookies();
    this.config.cookieTypes.forEach((type) => {
      if (rejectedCookies[type.id] && typeof type.onReject === 'function') {
        try {
          type.onReject();
        } catch (e) {
          console.warn(`Error menjalankan onReject untuk ${type.id}:`, e);
        }
      }
    });
  }

  runStoredCookiePreferenceCallbacks() {
    this.config.cookieTypes.forEach((type) => {
      const accepted =
        localStorage.getItem(`mcc_${type.id}${this.getBannerSuffix()}`) === 'true';
      if (accepted && typeof type.onAccept === 'function') {
        try {
          type.onAccept();
        } catch (e) {
          console.warn(`Error menjalankan onAccept untuk ${type.id}:`, e);
        }
      } else if (!accepted && typeof type.onReject === 'function') {
        try {
          type.onReject();
        } catch (e) {
          console.warn(`Error menjalankan onReject untuk ${type.id}:`, e);
        }
      }
    });
  }

  loadRequiredCookies() {
    if (!this.config.cookieTypes) return;
    this.config.cookieTypes.forEach((cookie) => {
      if (cookie.required && typeof cookie.onAccept === 'function') {
        try {
          cookie.onAccept();
        } catch (e) {
          console.warn(`Error menjalankan onAccept untuk ${cookie.id}:`, e);
        }
      }
    });
  }

  getBannerContent() {
	const bannerTitle =
	  this.config.text?.banner?.title || 'Privasi Anda penting bagi kami.';
	  
    const bannerDescription =
      this.config.text?.banner?.description ||
      `Kami memproses informasi pribadi Anda untuk mengukur dan meningkatkan situs dan layanan kami, untuk membantu kampanye pemasaran kami, dan untuk menyediakan konten dan iklan yang dipersonalisasi. Untuk informasi lebih lanjut, lihat <a href="/p/privacy-policy.html" target="_blank">Kebijakan Privasi</a> kami.`;

    const acceptAllButtonText = this.config.text?.banner?.acceptAllButtonText || 'Terima';
    const acceptAllButtonLabel = this.config.text?.banner?.acceptAllButtonAccessibleLabel;
    const acceptAllButton = `<button class="accept-all st-button st-button--primary"${
      acceptAllButtonLabel && acceptAllButtonLabel !== acceptAllButtonText 
        ? ` aria-label="${acceptAllButtonLabel}"` 
        : ''
    }>${acceptAllButtonText}</button>`;
    
    const rejectNonEssentialButtonText = this.config.text?.banner?.rejectNonEssentialButtonText || 'Tolak';
    const rejectNonEssentialButtonLabel = this.config.text?.banner?.rejectNonEssentialButtonAccessibleLabel;
    const rejectNonEssentialButton = `<button class="reject-all st-button st-button--secondary"${
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
    return !!localStorage.getItem(`MCB_IC${this.getBannerSuffix()}`);
  }

  removeBanner() {
    if (this.banner && this.banner.parentNode) {
      this.banner.parentNode.removeChild(this.banner);
      this.banner = null;

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
      localStorage.getItem(`MCB_IC${this.getBannerSuffix()}`) === null
    );
  }

  createModal() {
    this.modal = this.createWrapperChild(this.getModalContent(), 'mM');
  }

  toggleModal(show) {
    if (!this.modal) return;

    this.modal.style.display = show ? 'flex' : 'none';

    if (show) {
      this.showBackdrop();
      this.hideCookieIcon();
      this.removeBanner();
      this.preventBodyScroll();

      const modalCloseButton = this.modal.querySelector('.modal-close');
      modalCloseButton.focus();

      if (typeof this.config.onPreferencesOpen === 'function') {
        this.config.onPreferencesOpen();
      }

      this.updateCheckboxState(false);
    } else {
      this.setInitialCookieChoiceMade();
      
      this.updateCheckboxState(true);

      this.hideBackdrop();
      this.showCookieIcon();
      this.allowBodyScroll();

      if (typeof this.config.onPreferencesClose === 'function') {
        this.config.onPreferencesClose();
      }
    }
  }

  getCookieIconContent() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="none"><path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z"/></svg>
    `;
  }

  createCookieIcon() {
    this.cookieIcon = document.createElement('button');
    this.cookieIcon.id = 'mCI';
    this.cookieIcon.innerHTML = this.getCookieIconContent();

    if (this.config.text?.banner?.preferencesButtonAccessibleLabel) {
      this.cookieIcon.ariaLabel = this.config.text?.banner?.preferencesButtonAccessibleLabel;
    }

    if (!this.wrapper || !document.body.contains(this.wrapper)) {
      this.createWrapper();
    }

    this.wrapper.appendChild(this.cookieIcon);

    if (this.cookieIcon && this.config.cookieIcon?.position) {
      this.cookieIcon.classList.add(this.config.cookieIcon.position);
    }

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

  handleClosedWithNoChoice() {
    const choices = {};
    this.config.cookieTypes.forEach((type) => {
      let accepted = type.required || type.defaultValue;
      choices[type.id] = accepted;
      localStorage.setItem(
        `mcc_${type.id}${this.getBannerSuffix()}`,
        accepted.toString()
      );

      if (accepted && typeof type.onAccept === 'function') {
        try {
          type.onAccept();
        } catch (e) {
          console.warn(`Error menjalankan onAccept untuk ${type.id}:`, e);
        }
      } else if (!accepted && typeof type.onReject === 'function') {
        try {
          type.onReject();
        } catch (e) {
          console.warn(`Error menjalankan onReject untuk ${type.id}:`, e);
        }
      }
    });

    if (typeof this.config.saveConsentChoices === 'function') {
      try {
        this.config.saveConsentChoices(choices);
      } catch (e) {
        console.warn('Error menjalankan saveConsentChoices:', e);
      }
    }

    if (typeof this.config.applyConsentChoices === 'function') {
      try {
        this.config.applyConsentChoices(choices);
      } catch (e) {
        console.warn('Error menjalankan applyConsentChoices:', e);
      }
    }

    this.setInitialCookieChoiceMade();
    this.updateCheckboxState();
    console.debug('Pilihan default disimpan saat modal ditutup:', choices);
  }

  getFocusableElements(element) {
    return element.querySelectorAll(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
  }

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

    this.bannerEventListeners = [];

    const addListener = (element, event, handler) => {
      if (element) {
        element.addEventListener(event, handler);
        this.bannerEventListeners.push({ element, event, handler });
      }
    };

    addListener(acceptButton, 'click', () => {
      this.handleCookieChoice(true);
      if (typeof this.config.onClickAccept === 'function') {
        this.config.onClickAccept();
      }
    });

    addListener(rejectButton, 'click', () => {
      this.handleCookieChoice(false);
      if (typeof this.config.onClickReject === 'function') {
        this.config.onClickReject();
      }
    });

    addListener(preferencesButton, 'click', () => {
      this.showBackdrop();
      this.toggleModal(true);
      if (typeof this.config.onClickPreferences === 'function') {
        this.config.onClickPreferences();
      }
    });

    const focusableElements = this.getFocusableElements(this.banner);
    const firstFocusableEl = focusableElements[0];
    const lastFocusableEl = focusableElements[focusableElements.length - 1];

    const focusTrapHandler = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstFocusableEl) {
          lastFocusableEl.focus();
          e.preventDefault();
        } else if (document.activeElement === lastFocusableEl) {
          firstFocusableEl.focus();
          e.preventDefault();
        }
      }
    };

    this.banner.addEventListener('keydown', focusTrapHandler);
    this.bannerEventListeners.push({ element: this.banner, event: 'keydown', handler: focusTrapHandler });

    if (this.config.mode !== 'wizard') {
      acceptButton?.focus();
    }
  }

  setupCookieIconEventListener() {
    const handler = () => {
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
    };

    this.cookieIcon.addEventListener('click', handler);
    this.cookieIconEventListener = handler;
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
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
  }

  allowBodyScroll() {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
  }

  getRejectedCookies() {
    return (this.config.cookieTypes || []).reduce((acc, cookieType) => {
      acc[cookieType.id] =
        localStorage.getItem(`mcc_${cookieType.id}${this.getBannerSuffix()}`) ===
        'false';
      return acc;
    }, {});
  }
}

(function () {
  window.MCBManager = {};

  let config = {};
  let cookieBanner;

  /**
   * Memperbarui konfigurasi banner cookie dan menginisialisasi ulang banner jika diperlukan.
   * @param {Object} [userConfig={}] Konfigurasi pengguna untuk memperbarui pengaturan banner.
   * @returns {void}
   */
  function updateCookieBannerConfig(userConfig = {}) {
    config = { ...config, ...userConfig };

    if (cookieBanner) {
      if (typeof cookieBanner.destroyCookieBanner === 'function') {
        cookieBanner.destroyCookieBanner();
      }
      cookieBanner = null;
    }

    if (document.body) {
      initCookieBanner();
    } else {
      document.addEventListener('DOMContentLoaded', initCookieBanner, { once: true });
    }
  }

  /**
   * Menginisialisasi banner cookie dengan konfigurasi saat ini.
   * Membuat instance MCB jika belum ada dan menyiapkan observer untuk callback onConsentGiven.
   * @returns {void}
   */
  function initCookieBanner() {
    if (!cookieBanner) {
      if (!config.cookieTypes || !Array.isArray(config.cookieTypes)) {

        return;
      }
      cookieBanner = new MCB(config);
      console.debug('Banner cookie diinisialisasi dengan konfigurasi:', config);

      if (typeof config.onConsentGiven === 'function') {
        const bannerSuffix = cookieBanner.getBannerSuffix();
        const observer = new MutationObserver(() => {
          const consentKeys = [
            `mcc_analytics${bannerSuffix}`,
            `mcc_marketing${bannerSuffix}`,
            `mcc_necessary${bannerSuffix}`,
            `mcc_functionality${bannerSuffix}`
          ];
          const hasConsent = consentKeys.some(k => localStorage.getItem(k) !== null);
          if (hasConsent) {
            try {
              config.onConsentGiven();
            } catch (e) {
              console.warn('Error menjalankan onConsentGiven:', e);
            }
            observer.disconnect();
          }
        });

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

  window.MCBManager.initCookieBanner = initCookieBanner;
  window.MCBManager.updateCookieBannerConfig = updateCookieBannerConfig;
  window.MCBManager.injectScript = injectScript;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieBanner, { once: true });
  } else {
    initCookieBanner();
  }
})();