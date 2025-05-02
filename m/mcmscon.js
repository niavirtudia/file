function saveConsentChoices(choices) {
  const bannerSuffix = window.MCBManager?.cookieBanner?.getBannerSuffix() || '';
  Object.entries(choices).forEach(([key, value]) => {
    localStorage.setItem(`mcc_${key}${bannerSuffix}`, value.toString());
  });

  console.debug('Menyimpan pilihan consent:', choices, 'dengan suffix:', bannerSuffix);

  // Kirim pilihan consent ke server untuk memperbarui cookie_consent
  fetch('/set-consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      necessary: choices.necessary,
      analytical: choices.analytical,
      advertising: choices.advertising
    })
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

  // Memperbarui status consent di Google Analytics
  if (window.gtag) {
    window.gtag('consent', 'update', {
      analytics_storage: choices.analytical ? 'granted' : 'denied',
      ad_storage: choices.advertising ? 'granted' : 'denied',
      ad_user_data: choices.advertising ? 'granted' : 'denied',
      ad_personalization: choices.advertising ? 'granted' : 'denied'
    });
    console.debug('gtag consent diperbarui:', choices);
  } else {
    console.warn('gtag tidak tersedia, consent tidak diperbarui');
  }
}

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

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

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

      // Dorong ke dataLayer
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'consent_synced_from_cookie',
        consent_necessary: true,
        consent_analytical: consent.analytical === true,
        consent_advertising: consent.advertising === true
      });

      // Perbarui gtag
      if (window.gtag) {
        window.gtag('consent', 'update', {
          analytics_storage: consent.analytical ? 'granted' : 'denied',
          ad_storage: consent.advertising ? 'granted' : 'denied',
          ad_user_data: consent.advertising ? 'granted' : 'denied',
          ad_personalization: consent.advertising ? 'granted' : 'denied'
        });
        console.debug('Consent disinkronkan dari cookie:', consent);
      }
    } catch (error) {
      console.error('Error parsing cookie_consent:', error);
    }
  }
}

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
          name: 'Necessary Cookies',
          description: '<p>Cookie ini diperlukan agar situs web berfungsi dan tidak dapat dinonaktifkan di sistem kami. Cookie ini biasanya hanya disetel sebagai respons atas tindakan yang Anda lakukan yang sejenis dengan permintaan layanan. Anda dapat menyetel browser Anda agar memblokir atau memperingatkan Anda tentang cookie ini, tetapi beberapa bagian situs mungkin tidak berfungsi. <b>Cookie ini tidak menyimpan informasi pengenal pribadi apa pun</b>.</p>',
          required: true,
          onAccept: () => {
            console.debug('Necessary cookies diaktifkan');
          }
        },
        {
          id: 'analytical',
          name: 'Analytical',
          description: '<p>Cookie ini membantu kami memahami performa situs dengan menghitung kunjungan, melacak sumber lalu lintas, dan melihat halaman mana yang paling populer serta bagaimana pengguna bernavigasi. <b>Data yang dikumpulkan bersifat anonim dan digabungkan</b>. Jika Anda tidak mengizinkan cookie ini, kami tidak dapat memantau performa situs atau mengetahui kapan Anda mengunjunginya.</p>',
          required: false,
          onAccept: () => {
            if (window.gtag) {
              window.gtag('consent', 'update', { analytics_storage: 'granted' });
              console.debug('Analytical cookies diaktifkan');
            } else {
              console.warn('gtag tidak tersedia, analytical consent tidak diperbarui');
            }
          },
          onReject: () => {
            if (window.gtag) {
              window.gtag('consent', 'update', { analytics_storage: 'denied' });
              console.debug('Analytical cookies ditolak');
            } else {
              console.warn('gtag tidak tersedia, analytical consent tidak diperbarui');
            }
          }
        },
        {
          id: 'advertising',
          name: 'Advertising',
          description: '<p>Cookie ini digunakan untuk menyediakan iklan yang relevan dengan minat Anda. Kami, bersama mitra iklan kami, dapat mengumpulkan data seperti perilaku penelusuran, preferensi, dan lokasi untuk menyesuaikan iklan yang ditampilkan. Dengan mengizinkan cookie ini, Anda akan melihat iklan yang lebih sesuai dengan kebutuhan Anda, namun jika Anda menonaktifkannya, Anda tetap akan melihat iklan, tetapi iklan tersebut mungkin kurang relevan.</p>',
          required: false,
          onAccept: () => {
            if (window.gtag) {
              window.gtag('consent', 'update', {
                ad_storage: 'granted',
                ad_user_data: 'granted',
                ad_personalization: 'granted'
              });
              console.debug('Advertising cookies diaktifkan');
            } else {
              console.warn('gtag tidak tersedia, advertising consent tidak diperbarui');
            }
          },
          onReject: () => {
            if (window.gtag) {
              window.gtag('consent', 'update', {
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
              });
              console.debug('Advertising cookies ditolak');
            } else {
              console.warn('gtag tidak tersedia, advertising consent tidak diperbarui');
            }
          }
        }
      ],
		  text: {
			banner: {
			  title: 'Privasi Anda penting bagi kami.',
			  description: '<p>Kami memproses informasi pribadi Anda untuk mengukur dan meningkatkan situs dan layanan kami, untuk membantu kampanye pemasaran kami, dan untuk menyediakan konten dan iklan yang dipersonalisasi. Untuk informasi lebih lanjut, lihat Kebijakan Privasi kami.</p>',
			  acceptAllButtonText: 'Terima',
			  rejectNonEssentialButtonText: 'Tolak'
			},
			preferences: {
			  title: 'Manage Consent Preferences',
			  description: '<p>Kami menghormati hak privasi Anda. Anda dapat memilih untuk tidak mengizinkan beberapa jenis cookie. Preferensi cookie Anda akan berlaku di seluruh situs web kami.</p>'
			}
		  },
      position: {
        banner: 'bottomLeft'
      },
      background: {
        showBackground: true
      }
    });
    console.debug('Cookie Banner diinisialisasi');
  } else {
    setTimeout(waitForConsentManagerAndGtag, 50);
  }
})();