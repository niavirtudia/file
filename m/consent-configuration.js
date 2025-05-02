(function () {
  // Fungsi untuk mendapatkan nilai cookie
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  // Fungsi untuk memperbarui Google Consent Mode
  function updateConsentMode(choices) {
    window.gtag = window.gtag || function() { (window.dataLayer = window.dataLayer || []).push(arguments); };
    const consentConfig = {
      analytics_storage: choices.analytical ? 'granted' : 'denied',
      ad_storage: choices.advertising ? 'granted' : 'denied',
      ad_user_data: choices.advertising ? 'granted' : 'denied',
      ad_personalization: choices.advertising ? 'granted' : 'denied'
    };
    gtag('consent', 'update', consentConfig);
    console.debug('Google Consent Mode diperbarui:', consentConfig);
  }

  // Fungsi untuk menyimpan pilihan consent
  function saveConsentChoices(choices) {
    const bannerSuffix = window.MCBManager?.cookieBanner?.getBannerSuffix() || '';
    Object.entries(choices).forEach(([key, value]) => {
      localStorage.setItem(`mcc_${key}${bannerSuffix}`, value.toString());
    });

    console.debug('Menyimpan pilihan consent:', choices, 'dengan suffix:', bannerSuffix);

    // Perbarui Google Consent Mode
    updateConsentMode(choices);

    // Kirim pilihan consent ke server untuk memperbarui cookie_consent
    fetch('https://www.modenyania.com/set-consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        necessary: choices.necessary,
        analytical: choices.analytical,
        advertising: choices.advertising
      }),
      credentials: 'include'
    })
      .then(response => response.json())
      .then(data => {
        console.debug('Consent berhasil dikirim ke server:', data);
      })
      .catch(error => {
        console.error('Error mengirim consent ke server:', error);
      });

    // Mendorong event granular ke dataLayer
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'consent_updated',
      consent_necessary: true,
      consent_analytical: choices.analytical === true,
      consent_advertising: choices.advertising === true
    });
  }

  // Fungsi untuk menerapkan pilihan consent
  function applyConsentChoices(choices) {
    const cookieTypes = window.MCBManager?.cookieBanner?.config?.cookieTypes || [];
    cookieTypes.forEach(type => {
      const accepted = choices[type.id];
      if (accepted && typeof type.onAccept === 'function') {
        try {
          type.onAccept();
          console.debug(`onAccept dipanggil untuk ${type.id}`);
        } catch (e) {
          console.warn(`Error menjalankan onAccept untuk ${type.id}:`, e);
        }
      } else if (!accepted && typeof type.onReject === 'function') {
        try {
          type.onReject();
          console.debug(`onReject dipanggil untuk ${type.id}`);
        } catch (e) {
          console.warn(`Error menjalankan onReject untuk ${type.id}:`, e);
        }
      }
    });
    console.debug('Pilihan consent diterapkan:', choices);
  }

  // Fungsi untuk sinkronisasi consent dari cookie
  function syncConsentFromCookie() {
    const cookieConsent = getCookie('cookie_consent');
    if (cookieConsent) {
      try {
        const consent = JSON.parse(cookieConsent);
        const bannerSuffix = window.MCBManager?.cookieBanner?.getBannerSuffix() || '';
        // Sinkronkan ke localStorage
        localStorage.setItem(`mcc_necessary${bannerSuffix}`, 'true');
        localStorage.setItem(`mcc_analytical${bannerSuffix}`, consent.analytical ? 'true' : 'false');
        localStorage.setItem(`mcc_advertising${bannerSuffix}`, consent.advertising ? 'true' : 'false');

        // Perbarui Google Consent Mode
        updateConsentMode(consent);

        // Dorong ke dataLayer
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: 'consent_synced_from_cookie',
          consent_necessary: true,
          consent_analytical: consent.analytical === true,
          consent_advertising: consent.advertising === true
        });

        console.debug('Consent disinkronkan dari cookie:', consent);
      } catch (error) {
        console.error('Error parsing cookie_consent:', error);
      }
    }
  }

  // Dengarkan event consent_updated dan consent_given
  document.addEventListener('consent_updated', (e) => {
    const choices = e.detail;
    saveConsentChoices(choices);
    applyConsentChoices(choices);
  });

  document.addEventListener('consent_given', (e) => {
    const choices = e.detail;
    saveConsentChoices(choices);
    applyConsentChoices(choices);
  });

  // Inisialisasi Silktide Cookie Consent Manager
  (function waitForConsentManagerAndGtag() {
    if (
      window.MCBManager?.updateCookieBannerConfig &&
      window.gtag
    ) {
      // Sinkronkan consent dari cookie saat inisialisasi
      syncConsentFromCookie();

      window.MCBManager.updateCookieBannerConfig({
        onClickAccept: () => {
          console.debug('Accept all diklik');
        },
        onClickReject: () => {
          console.debug('Reject non-essential diklik');
        },
        onClickPreferences: () => {
          console.debug('Modal preferensi dibuka');
        },
        onConsentGiven: () => {
          console.debug('Consent diberikan');
          const bannerSuffix = window.MCBManager?.cookieBanner?.getBannerSuffix() || '';
          const consentNecessary = true;
          const consentAnalytical = localStorage.getItem(`mcc_analytical${bannerSuffix}`) === 'true';
          const consentAdvertising = localStorage.getItem(`mcc_advertising${bannerSuffix}`) === 'true';
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({
            event: 'consent_given',
            consent_necessary: consentNecessary,
            consent_analytical: consentAnalytical,
            consent_advertising: consentAdvertising
          });
          console.debug('Consent granular pushed:', {
            consent_necessary: consentNecessary,
            consent_analytical: consentAnalytical,
            consent_advertising: consentAdvertising
          });
        },
        saveConsentChoices,
        applyConsentChoices,
        cookieTypes: [
          {
            id: 'necessary',
            name: 'Necessary',
            description: '<p>Required for website functionality.</p>',
            required: true,
            onAccept: () => {
              console.debug('Necessary cookies diaktifkan');
            }
          },
          {
            id: 'analytical',
            name: 'Analytical',
            description: '<p>Helps analyze website usage.</p>',
            required: false,
            onAccept: () => {
              updateConsentMode({ analytical: true });
              console.debug('Analytical cookies diaktifkan');
            },
            onReject: () => {
              updateConsentMode({ analytical: false });
              console.debug('Analytical cookies ditolak');
            }
          },
          {
            id: 'advertising',
            name: 'Advertising',
            description: '<p>Used for personalized ads.</p>',
            required: false,
            onAccept: () => {
              updateConsentMode({ advertising: true });
              console.debug('Advertising cookies diaktifkan');
            },
            onReject: () => {
              updateConsentMode({ advertising: false });
              console.debug('Advertising cookies ditolak');
            }
          }
        ],
        text: {
          banner: {
            description: '<p>We use cookies to improve your experience</p>',
            acceptAllButtonText: 'Accept all',
            rejectNonEssentialButtonText: 'Reject non-essential',
            preferencesButtonText: 'Preferences'
          },
          preferences: {
            title: 'Cookie Preferences',
            description: '<p>Select which cookies to allow.</p>',
            creditLinkText: 'Powered by Silktide',
            creditLinkAccessibleLabel: 'Silktide Cookie Consent'
          }
        },
        position: {
          banner: 'bottomLeft'
        },
        background: {
          showBackground: true
        }
      });
      console.debug('Silktide Cookie Banner diinisialisasi');
    } else {
      setTimeout(waitForConsentManagerAndGtag, 50);
    }
  })();
})();